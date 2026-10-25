import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Desk } from '../src/application/desk.mjs';
import { JsonRegistry, GitRepositories, FileCatalog } from '../src/infrastructure/filesystem.mjs';
import { serve } from '../src/interfaces/http.mjs';
import { frameSource, highlight, wrapNotes } from '../public/renderers/mermaid.mjs';
test('表示加工はソースを安全に色分けし、任意IDの枠を開閉する', () => {
 assert.ok(!highlight('<script>').includes('<script>'));
 const source = 'flowchart LR\nsubgraph Services[Services]\nA-->B\nend\nServices@{ view: collapsed }';
 const expanded = frameSource(source, new Map([['Services', false]]));
 assert.ok(!expanded.includes('view: collapsed')); assert.match(expanded, /Services@\{ view: expanded \}/);
 assert.match(wrapNotes('note for A "長い注釈を折り返して表示する"', 8), /<br\/>/);
});
test('保存トークン・競合拒否・外部変更通知・外部リンクへの書き込み拒否', async () => {
 const temp = await mkdtemp(join(tmpdir(), 'codex-work-'));
 let server;
 try {
  const root = join(temp, 'repo'); await mkdir(join(root, '.git'), { recursive: true });
  const path = join(root, 'a.mmd'); const original = 'flowchart LR\nA-->B'; await writeFile(path, original);
  const desk = new Desk({ registry: new JsonRegistry(join(temp, 'registry.json')), repositories: new GitRepositories(), catalog: new FileCatalog() });
  const repo = await desk.register(root); server = serve(desk, 0); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const endpoint = `${base}/repositories/${repo.id}/source?file=a.mmd`;
  const { token } = await (await fetch(base + '/session')).json();
  const save = (source, baseSource, key = token) => fetch(endpoint, { method: 'PUT', headers: { 'content-type': 'application/json', 'x-preview-token': key }, body: JSON.stringify({ source, baseSource }) });
  assert.equal((await save('wrong', original, '')).status, 403);
  assert.equal((await save('flowchart LR\nA-->C', original)).status, 200);
  assert.equal((await save('stale', original)).status, 409);
  const changed = 'flowchart LR\nA-->C'; assert.equal(await readFile(path, 'utf8'), changed);
  const responses = await Promise.all([save('first', changed), save('second', changed)]); assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  const abort = new AbortController();
  const stream = await fetch(`${base}/repositories/${repo.id}/events?file=a.mmd`, { signal: abort.signal });
  const reader = stream.body.getReader(); await reader.read();
  const external = 'flowchart LR\nA-->EXTERNAL'; await writeFile(path, external);
  let output = ''; const decoder = new TextDecoder();
  const timeout = setTimeout(() => abort.abort(), 5000);
  try { while (!output.includes('EXTERNAL')) { const { value, done } = await reader.read(); if (done) break; output += decoder.decode(value); } assert.match(output, /EXTERNAL/); }
  finally { clearTimeout(timeout); abort.abort(); }
  await writeFile(join(temp, 'outside.mmd'), original); await symlink(join(temp, 'outside.mmd'), join(root, 'escape.mmd'));
  await assert.rejects(() => desk.saveDiagram(repo.id, 'escape.mmd', 'bad', original), /outside/);
  assert.equal(await readFile(join(temp, 'outside.mmd'), 'utf8'), original);
 } finally { if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } await rm(temp, { recursive: true, force: true }); }
});
