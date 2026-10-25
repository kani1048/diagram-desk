import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { screenUrl, parseScreen } from '../public/routes.mjs';
import { serve } from '../src/interfaces/http.mjs';
test('ネストされた URL は日本語・空白・予約文字を含む図のパスを保持する', () => {
  assert.equal(screenUrl(), '/workspaces');
  assert.equal(screenUrl('abc123'), '/workspaces/abc123/diagrams');
  const path = 'architecture/日本語 # ? %.mmd';
  assert.deepEqual(parseScreen(screenUrl('abc123', path)), { repo: 'abc123', diagram: path });
  for (const url of ['/workspaces/abc/diagrams/../x.mmd', '/workspaces/abc/diagrams/%2Fx.mmd', '/workspaces/abc/diagrams/%ZZ.mmd', '/workspaces/abc/diagrams/a.md']) assert.equal(parseScreen(url), null);
});
test('各画面への直接 GET と旧 URL の転送、未知のファイルは404', async () => {
  const server = serve({}, 0);
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of ['/workspaces', '/workspaces/abc123/diagrams', screenUrl('abc123', 'examples/日本語 #.mmd')]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200); assert.match(await response.text(), /id="workspaces"/);
    }
    const old = await fetch(base + '/?repo=abc123&diagram=examples%2Farchitecture.mmd', { redirect: 'manual' });
    assert.equal(old.status, 302); assert.equal(old.headers.get('location'), '/workspaces/abc123/diagrams/examples/architecture.mmd');
    assert.equal((await fetch(base + '/missing.js')).status, 404);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('圧縮・ETagで配信内容を保ち、APIはキャッシュしない', async () => {
 const server = serve({ async listRepositories() { return []; } }, 0); await once(server, 'listening');
 const base = `http://127.0.0.1:${server.address().port}`;
 try {
  const plain = await fetch(base + '/app.js', { headers: { 'accept-encoding': 'identity' } });
  const viewport = await fetch(base + '/lib/viewport.mjs');
  assert.equal(viewport.status, 200); assert.match(await viewport.text(), /export/);
  const shared = await fetch(base + '/shared/diagram-formats.mjs');
  assert.equal(shared.status, 200); assert.match(await shared.text(), /DIAGRAM_FORMATS/);
  assert.equal((await fetch(base + '/shared/other.mjs')).status, 404);
  const text = await plain.text(); assert.equal(plain.headers.get('content-encoding'), null);
  const zipped = await fetch(base + '/app.js', { headers: { 'accept-encoding': 'gzip' } });
  assert.equal(zipped.headers.get('content-encoding'), 'gzip'); assert.equal(await zipped.text(), text);
  assert.equal(zipped.headers.get('vary'), 'Accept-Encoding');
  const unchanged = await fetch(base + '/app.js', { headers: { 'if-none-match': plain.headers.get('etag') } });
  assert.equal(unchanged.status, 304); assert.equal(await unchanged.text(), '');
  const disabled = await fetch(base + '/app.js', { headers: { 'accept-encoding': 'gzip;q=0' } });
  assert.equal(disabled.headers.get('content-encoding'), null); assert.equal(await disabled.text(), text);
  const api = await fetch(base + '/api/repositories'); assert.equal(api.headers.get('cache-control'), 'no-store');
 } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
