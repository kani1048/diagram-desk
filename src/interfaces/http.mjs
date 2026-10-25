import { parseScreen, screenUrl } from '../../public/routes.mjs';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import { randomBytes, createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const compress = promisify(gzip);
const publicRoot = fileURLToPath(new URL('../../public/', import.meta.url));
const vendorRoot = fileURLToPath(new URL('../../node_modules/mermaid/dist/', import.meta.url));
export function serve(desk, port = 4310, host = '127.0.0.1') {
  const token = randomBytes(32).toString('hex');
  const assets = new Map(); let assetBytes = 0;
  const server = createServer(async (req, res) => {
    const send = (status, body, type = 'application/json') => { res.writeHead(status, { 'content-type': type + '; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); res.end(type === 'application/json' ? JSON.stringify(body) : body); };
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/session' && req.method === 'GET') return send(200, { token });
      const sourceRoute = url.pathname.match(/^\/api\/repositories\/([a-f0-9]+)\/(source|events)$/);
      if (sourceRoute) {
        const id = sourceRoute[1], path = url.searchParams.get('file');
        if (req.method === 'PUT' && sourceRoute[2] === 'source') {
          if (req.headers['x-preview-token'] !== token) return send(403, { error: 'Invalid save token' });
          if (!String(req.headers['content-type']).startsWith('application/json')) return send(415, { error: 'JSON required' });
          const chunks = []; let size = 0;
          for await (const chunk of req) { size += chunk.length; if (size > 5 * 1024 * 1024) return send(413, { error: 'Source too large' }); chunks.push(chunk); }
          const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          return send(200, await desk.saveDiagram(id, path, input.source, input.baseSource));
        }
        if (req.method !== 'GET') return send(405, { error: 'Method not allowed' });
        const initial = await desk.readDiagram(id, path);
        if (sourceRoute[2] === 'source') return send(200, initial);
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
        let last = initial.source, busy = false, closed = false;
        const emit = data => { if (!closed) res.write(`data: ${JSON.stringify(data)}\n\n`); };
        emit(initial);
        const timer = setInterval(async () => {
          if (busy || closed) return; busy = true;
          try { const next = await desk.readDiagram(id, path); if (next.source !== last) { last = next.source; emit(next); } else res.write(': heartbeat\n\n'); }
          catch (error) { emit({ error: error.message }); }
          finally { busy = false; }
        }, 1000);
        res.on('close', () => { closed = true; clearInterval(timer); });
        return;
      }
      if (req.method !== 'GET') return send(405, { error: 'Method not allowed' });
      if (url.pathname === '/api/repositories') return send(200, await desk.listRepositories());
      const match = url.pathname.match(/^\/api\/repositories\/([a-f0-9]+)\/diagrams$/);
      if (match) return send(200, await (url.searchParams.get('metadata') === '1' ? desk.listDiagramIndex(match[1]) : desk.listDiagrams(match[1])));
      if (url.pathname.startsWith('/api/')) return send(404, { error: 'Not found' });
      if (url.pathname === '/') {
        const target = screenUrl(url.searchParams.get('repo') || '', url.searchParams.get('diagram') || '');
        res.writeHead(302, { location: target }); res.end(); return;
      }
      const screen = parseScreen(url.pathname);
      const vendor = url.pathname.startsWith('/vendor/');
      const shared = url.pathname === '/shared/diagram-formats.mjs';
      const root = shared ? fileURLToPath(new URL('../../shared/', import.meta.url)) : vendor ? vendorRoot : publicRoot;
      const path = resolve(root, '.' + (shared ? '/diagram-formats.mjs' : vendor ? url.pathname.slice(7) : screen ? '/index.html' : url.pathname));
      if (!path.startsWith(resolve(root) + sep)) return send(404, { error: 'Not found' });
      const info = await stat(path);
      const signature = `${info.mtimeMs}:${info.ctimeMs}:${info.size}`;
      let asset = assets.get(path);
      if (!asset || asset.signature !== signature) {
        const content = await readFile(path);
        const zipped = content.length > 1024 ? await compress(content) : null;
        asset = { signature, content, zipped, etag: '"' + createHash('sha256').update(content).digest('hex') + '"' };
        if (assets.has(path)) { const old = assets.get(path); assetBytes -= old.content.length + (old.zipped?.length || 0); assets.delete(path); }
        const bytes = content.length + (zipped?.length || 0);
        while (assetBytes + bytes > 32 * 1024 * 1024 && assets.size) { const key = assets.keys().next().value; const old = assets.get(key); assetBytes -= old.content.length + (old.zipped?.length || 0); assets.delete(key); }
        if (bytes <= 32 * 1024 * 1024) { assets.set(path, asset); assetBytes += bytes; }
      }
      const headers = { 'cache-control': 'no-cache', etag: asset.etag, vary: 'Accept-Encoding', 'content-type': path.endsWith('.html') ? 'text/html; charset=utf-8' : path.endsWith('.css') ? 'text/css' : 'text/javascript', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'" };
      if (req.headers['if-none-match']?.split(/,\s*/).includes(asset.etag)) { res.writeHead(304, headers); res.end(); return; }
      const acceptsGzip = String(req.headers['accept-encoding'] || '').split(',').some(part => { const [name, ...options] = part.trim().split(';'); return name === 'gzip' && !options.some(option => /^\s*q=0(?:\.0*)?\s*$/.test(option)); });
      const zipped = acceptsGzip && asset.zipped;
      if (zipped) headers['content-encoding'] = 'gzip';
      res.writeHead(200, headers);
      res.end(zipped || asset.content);
    } catch (error) { send(error.status || (error.code === 'ENOENT' ? 404 : 400), { error: error.message }); }
  });
  server.listen(port, host, () => console.log(JSON.stringify({ url: `http://${host}:${server.address().port}` })));
  return server;
}
