import test from 'node:test';
import assert from 'node:assert/strict';
import { onionRenderer } from '../public/renderers/onion.mjs';
import { sampleArchitectureModel, sampleContextsModel } from '../public/renderers/onion-model.mjs';
import { rendererFor } from '../public/renderers/index.mjs';
import { diagramMetadata } from '../shared/diagram-formats.mjs';
import { screenUrl, parseScreen } from '../public/routes.mjs';
import { Desk } from '../src/application/desk.mjs';
import { FileCatalog, GitRepositories, JsonRegistry } from '../src/infrastructure/filesystem.mjs';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test('Onionは単一・複数コンテキストと通信を描画し、SVGのIDを分離する', async () => {
 for (const model of [sampleArchitectureModel(), sampleContextsModel()]) {
  const source = JSON.stringify(model);
  const result = await onionRenderer.render(source, { id: 'preview1', state: onionRenderer.createState(), mode: 'preview' });
  assert.match(result.svg, /viewBox=/); assert.match(result.svg, /preview1-pattern-domain/);
  assert.doesNotMatch(result.svg, /url\(#pattern-/); assert.match(result.svg, /data-id="[^"]+"/);
  if (model.contexts) { assert.match(result.svg, /data-relation="request"/); assert.match(result.svg, /data-relation="publish"/); }
 }
 assert.equal(rendererFor('a.onion.json').id, 'onion');
 assert.equal(diagramMetadata('a.onion.json', '{}').name, 'a');
 assert.equal(parseScreen(screenUrl('abc', 'nested/a.onion.json')).diagram, 'nested/a.onion.json');
});
test('選択を強調して詳細を返し、不正モデルとHTMLを安全に扱う', async () => {
 const model = sampleArchitectureModel(); model.components[0].label = '<script>alert(1)</script>';
 const source = JSON.stringify(model), state = { kind: 'node', id: 'main:user' };
 const result = await onionRenderer.render(source, { id: 'detail1', state, mode: 'detail' });
 assert.match(result.svg, /selected/); assert.match(result.detail, /main:user/);
 assert.doesNotMatch(result.svg + result.detail + onionRenderer.highlight(source), /<script>/);
 await assert.rejects(() => onionRenderer.render('{', { id: 'x', state, mode: 'detail' }));
 model.relations[0].to = 'missing';
 await assert.rejects(() => onionRenderer.render(JSON.stringify(model), { id: 'x', state, mode: 'detail' }), /未定義/);
 assert.equal(onionRenderer.createState().id, '');
});
test('Onionも共通カタログで探索・読込・保存・競合拒否を行う', async () => {
 const temp = await mkdtemp(join(tmpdir(), 'codex-work-'));
 try {
  const root = join(temp, 'repo'); await mkdir(join(root, '.git'), { recursive: true });
  const source = JSON.stringify(sampleArchitectureModel()); await writeFile(join(root, 'a.onion.json'), source);
  const desk = new Desk({ registry: new JsonRegistry(join(temp, 'registry.json')), repositories: new GitRepositories(), catalog: new FileCatalog() });
  const repo = await desk.register(root);
  assert.equal((await desk.listDiagrams(repo.id))[0].path, 'a.onion.json');
  await desk.saveDiagram(repo.id, 'a.onion.json', source + '\n', source);
  assert.equal((await desk.readDiagram(repo.id, 'a.onion.json')).source, source + '\n');
  await assert.rejects(() => desk.saveDiagram(repo.id, 'a.onion.json', source, source), /外部変更/);
 } finally { await rm(temp, { recursive: true, force: true }); }
});
