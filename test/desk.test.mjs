import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Desk } from '../src/application/desk.mjs';
import { JsonRegistry, GitRepositories, FileCatalog } from '../src/infrastructure/filesystem.mjs';
import { diagramPath } from '../src/domain/diagram.mjs';
test('拒否すべき図のパス', () => { for (const path of ['../x.mmd','/x.mmd','a/../x.mmd','x.md','a\\x.mmd']) assert.throws(() => diagramPath(path)); });
test('登録、重複排除、一覧、取得、外部リンク拒否', async () => {
 const temp = await mkdtemp(join(tmpdir(), 'codex-work-'));
 try {
  const root = join(temp, 'repo'); await mkdir(join(root, '.git'), { recursive: true });
  await writeFile(join(root, 'model.mmd'), 'classDiagram\nclass Repository');
  await writeFile(join(temp, 'outside.mmd'), 'flowchart LR\nA-->B');
  await symlink(join(temp, 'outside.mmd'), join(root, 'escape.mmd'));
  await symlink(root, join(root, 'loop'));
  const desk = new Desk({ registry: new JsonRegistry(join(temp, 'registry.json')), repositories: new GitRepositories(), catalog: new FileCatalog() });
  const repo = await desk.register(root);
  assert.equal((await desk.register(root)).id, repo.id);
  assert.equal((await desk.listRepositories()).length, 1);
  assert.deepEqual((await desk.listDiagrams(repo.id)).map(item => item.path), ['model.mmd']);
  assert.equal((await desk.readDiagram(repo.id, 'model.mmd')).kind, 'classDiagram');
  await assert.rejects(() => desk.readDiagram(repo.id, 'escape.mmd'), /outside/);
  await assert.rejects(() => desk.listDiagrams('missing'), /not found/);
 } finally { await rm(temp, { recursive: true, force: true }); }
});

test('詳細用の索引はソースを読まず、従来の一覧はソースを返す', async () => {
 let reads = 0;
 const desk = new Desk({ registry: { async list() { return [{ id: 'abc', path: '/repo' }]; } }, catalog: { async list() { return ['nested/a.mmd']; }, async read() { reads++; return 'flowchart LR\nA-->B'; } } });
 assert.deepEqual(await desk.listDiagramIndex('abc'), [{ path: 'nested/a.mmd', name: 'a' }]); assert.equal(reads, 0);
 const full = await desk.listDiagrams('abc'); assert.equal(full[0].source, 'flowchart LR\nA-->B'); assert.equal(reads, 1);
});
