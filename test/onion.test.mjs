import test from 'node:test';
import assert from 'node:assert/strict';
import { onionRenderer } from '../public/renderers/onion.mjs';
import { sampleArchitectureModel, sampleContextsModel, placeContextCenters, layoutArchitecture } from '../public/renderers/onion-model.mjs';
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

test('3境界は重ならない三角形になり、1・2境界の横並びと4境界のハブを維持する', () => {
 const radii = [240, 360, 480], margin = 180;
 const points = placeContextCenters(radii, { contextMargin: margin, hubIndex: 1 });
 assert.deepEqual(points, placeContextCenters(radii, { contextMargin: margin, hubIndex: 1 }));
 const [a,b,c] = points;
 assert.ok(Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)) > 1);
 for (let i=0;i<3;i++) for(let j=i+1;j<3;j++) assert.ok(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y) >= radii[i]+radii[j]+margin-1e-8);
 assert.ok(points[1].y < points[0].y);
 assert.equal(placeContextCenters([120]).length, 1);
 const row = placeContextCenters([120,240]); assert.equal(row[0].y,row[1].y);
 const hub = placeContextCenters([120,120,120,120]); assert.deepEqual(hub[0],{x:0,y:0});
 const model = sampleContextsModel();
 model.contexts.push({...structuredClone(model.contexts[0]),id:'third',label:'Third'});
 model.hubContextId='delivery';
 const layout = layoutArchitecture(model);
 const centers = layout.contexts.map(context => context.center);
 assert.equal(new Set(centers.map(point=>point.x)).size,3);
 assert.ok(centers[1].y < centers[0].y);
});

test('外部資源は全Onionの外に置き、参照と説明を検証して安全に表示する', async () => {
 const model = sampleContextsModel();
 model.contexts[0].components[0].description = '<script>component</script>';
 model.resources = [
  {id:'records',label:'GitHub records',kind:'store',contextId:'sales',side:'left',description:'<script>resource</script>'},
  {id:'state',label:'Local state',kind:'state',contextId:'sales',side:'left'}
 ];
 model.links.push({from:'sales:shipping-adapter',to:'resource:records',kind:'runtime-call',label:'read records'});
 const layout=layoutArchitecture(model);
 const external=layout.nodes.filter(node=>node.shape==='resource'); assert.equal(external.length,2);
 for(const node of external) for(const context of layout.contexts) assert.ok(node.x + node.width/2 < context.center.x-context.outerRadius);
 assert.ok(Math.abs(external[0].y-external[1].y)>=100);
 const result=await onionRenderer.render(JSON.stringify(model),{id:'resources',state:{kind:'node',id:'resource:records'},mode:'detail'});
 assert.ok(result.svg.lastIndexOf('data-kind="edge"') < result.svg.indexOf('data-id="sales:shipping-adapter"'));
 assert.match(result.svg,/data-shape="resource"/); assert.match(result.detail,/external resource/);
 assert.match(result.detail,/&lt;script&gt;resource/); assert.doesNotMatch(result.svg+result.detail,/<script>/);
 const component=await onionRenderer.render(JSON.stringify(model),{id:'component',state:{kind:'node',id:'sales:order'},mode:'detail'});
 assert.match(component.detail,/&lt;script&gt;component/);
 for(const mutate of [
  m=>m.resources.push({...m.resources[0]}),
  m=>m.resources[0].contextId='missing',
  m=>m.resources[0].kind='unknown',
  m=>m.links[0].to='resource:missing'
 ]) {const bad=structuredClone(model);mutate(bad);assert.throws(()=>layoutArchitecture(bad));}
});
