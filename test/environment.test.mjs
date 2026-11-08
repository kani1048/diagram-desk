import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { JSDOM } from 'jsdom';
import { parseEnvironment, layoutEnvironment } from '../public/renderers/environment-model.mjs';
import { environmentRenderer } from '../public/renderers/environment.mjs';
import { rendererFor } from '../public/renderers/index.mjs';
import { diagramMetadata } from '../shared/diagram-formats.mjs';
import { Desk } from '../src/application/desk.mjs';
import { FileCatalog, GitRepositories, JsonRegistry } from '../src/infrastructure/filesystem.mjs';
const sample = JSON.parse(await readFile(new URL('../examples/role-designer.environment.json', import.meta.url), 'utf8'));
const parse = model => parseEnvironment(JSON.stringify(model));
const render = (model, state = {}, mode = 'detail', id = 'test') => environmentRenderer.render(JSON.stringify(model), { id, state, mode });

test('境界の循環・参照切れ・重複ID・不明な型を拒否し、確認済みには記録を要求する', () => {
 const cases = [
  [m => m.nodes.push({ ...m.nodes[0] }), /重複/],
  [m => m.links[0].to = 'missing', /未定義/],
  [m => m.nodes[0].parent = 'inner', /循環/],
  [m => m.nodes[1].parent = 'config', /包含境界/],
  [m => m.nodes[0].kind = '__proto__', /kind/],
  [m => m.links[0].kind = 'constructor', /kind/],
  [m => m.nodes[0].status = 'confirmed', /evidence/],
  [m => m.links[2].access = 'write', /access/],
  [m => m.nodes[0].refs = 'file', /refs/],
 ];
 for (const [mutate, expected] of cases) { const m = structuredClone(sample); mutate(m); assert.throws(() => parse(m), expected); }
 const m = structuredClone(sample); m.nodes[0].status = 'confirmed'; m.nodes[0].evidence = '2026-11-08 手動確認（試験データ）'; assert.equal(parse(m).nodes[0].status, 'confirmed');
 const unknown = structuredClone(sample); delete unknown.nodes[0].status; assert.equal(parse(unknown).nodes[0].status, 'unknown');
});

test('入力上限と深さを制限し、全ての子要素を親の内側に重ならず配置する', () => {
 const model = parse(sample), layout = layoutEnvironment(model), byId = new Map(layout.nodes.map(n => [n.id, n]));
 for (const node of layout.nodes) {
  assert.ok(Number.isFinite(node.x) && Number.isFinite(node.y));
  if (!node.parent) continue;
  const parent = byId.get(node.parent);
  assert.ok(node.x > parent.x && node.y >= parent.y + 80);
  assert.ok(node.x + node.width < parent.x + parent.width);
  assert.ok(node.y + node.height < parent.y + parent.height);
 }
 for (const a of layout.nodes) for (const b of layout.nodes) {
  if (a.id >= b.id || a.parent !== b.parent) continue;
  assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
 }
 assert.throws(() => parse({ ...sample, nodes: Array(101).fill(sample.nodes[0]) }), /100/);
 const deep = { version: 1, title: 'deep', nodes: Array.from({ length: 13 }, (_, i) => ({ id: 'n' + i, kind: 'sbx', label: 'scope', ...(i ? { parent: 'n' + (i - 1) } : {}) })), links: [] };
 assert.throws(() => parse(deep), /12階層/);
});

test('詳細・マウントro/rw・状態・参照を表示し、HTMLをエスケープしてSVG IDを分離する', async () => {
 const model = structuredClone(sample); model.nodes[0].label = '<script>alert(1)</script>'; model.links[2].access = 'ro'; model.links[2].refs = ['<img src=x onerror=alert(1)>'];
 const result = await render(model, { kind: 'link', id: 'workspace-mount' });
 assert.match(result.detail, /アクセス: ro/); assert.match(result.detail, /接続先パス: \/workspace/); assert.match(result.detail, /設計案/); assert.match(result.detail, /参照元/);
 assert.doesNotMatch(result.svg + result.detail + environmentRenderer.highlight(JSON.stringify(model)), /<script>|<img/);
 assert.match(result.svg, /stroke-dasharray/);
 const second = await render(model, {}, 'preview', 'another');
 const firstDoc = new JSDOM(result.svg), secondDoc = new JSDOM(second.svg);
 const firstId = firstDoc.window.document.querySelector('marker').id, secondId = secondDoc.window.document.querySelector('marker').id;
 assert.notEqual(firstId, secondId); assert.equal(second.detail, ''); assert.match(result.svg, /aria-label=/);
 firstDoc.window.close(); secondDoc.window.close();
});

test('クリック・キーボードで要素と線の詳細を開き、背景で選択解除する', async () => {
 const result = await render(sample), dom = new JSDOM(`<div id="graph">${result.svg}</div>`), graph = dom.window.document.querySelector('#graph');
 const state = environmentRenderer.createState();
 const node = graph.querySelector('[data-env-id="people"] text');
 assert.equal(environmentRenderer.handleEvent({ type: 'click', event: { target: node }, graph, state }), true);
 assert.deepEqual(state, { kind: 'node', id: 'people' });
 assert.match((await render(sample, state)).detail, /イメージ構築・検証/);
 let prevented = false; const link = graph.querySelector('[data-env-id="workspace-mount"]');
 environmentRenderer.handleEvent({ type: 'keydown', event: { target: link, key: 'Enter', preventDefault() { prevented = true; } }, graph, state });
 assert.equal(prevented, true); assert.equal(state.kind, 'link');
 environmentRenderer.handleEvent({ type: 'click', event: { target: graph.querySelector('svg') }, graph, state });
 assert.deepEqual(state, { kind: '', id: '' }); dom.window.close();
});

test('共通カタログから環境図を探索・読込・保存し、外部変更時は保存を拒否する', async () => {
 const temp = await mkdtemp(join(tmpdir(), 'codex-work-'));
 try {
  const root = join(temp, 'repo'); await mkdir(join(root, '.git'), { recursive: true });
  const source = JSON.stringify(sample), path = 'roles.environment.json'; await writeFile(join(root, path), source);
  const desk = new Desk({ registry: new JsonRegistry(join(temp, 'registry.json')), repositories: new GitRepositories(), catalog: new FileCatalog() });
  const repo = await desk.register(root);
  assert.equal((await desk.listDiagrams(repo.id))[0].path, path);
  assert.equal(rendererFor(path).id, 'environment'); assert.equal(diagramMetadata(path, source).kind, 'ロール環境の関係図');
  await desk.saveDiagram(repo.id, path, source + '\n', source);
  assert.equal((await desk.readDiagram(repo.id, path)).source, source + '\n');
  await assert.rejects(() => desk.saveDiagram(repo.id, path, source, source), /外部変更/);
 } finally { await rm(temp, { recursive: true, force: true }); }
});
