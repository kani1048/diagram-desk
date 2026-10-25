import test from 'node:test';
import assert from 'node:assert/strict';
import { DiagramPreviews } from '../public/diagram-previews.mjs';
import { setup } from './viewport-fixture.mjs';
import { findDiagramFormat, requireDiagramPath, diagramMetadata } from '../shared/diagram-formats.mjs';
import { describeDiagram, describeDiagramIndex } from '../src/domain/diagram.mjs';
import { mermaidRenderer } from '../public/renderers/mermaid.mjs';

test('ブラウザとドメインで同じ図形式・パス・メタデータを使用する', () => {
  const source = '%% comment\nclassDiagram\nclass User';
  assert.equal(findDiagramFormat('nested/model.mmd').id, 'mermaid');
  assert.deepEqual(describeDiagramIndex('nested/model.mmd'), { path: 'nested/model.mmd', name: 'model' });
  assert.deepEqual(describeDiagram('nested/model.mmd', source), { ...diagramMetadata('nested/model.mmd', source), source });
  assert.equal(diagramMetadata('nested/model.mmd', source).kind, 'classDiagram');
  for (const path of ['../x.mmd', 'a/../x.mmd', '/x.mmd', 'a\\x.mmd', 'x.unsupported.json']) assert.throws(() => requireDiagramPath(path));
  const first = mermaidRenderer.createState(), second = mermaidRenderer.createState();
  first.set('Services', true); assert.equal(second.has('Services'), false);
});

test('プレビューは任意の描画アダプターを呼び、内容・形式が変わったら再描画する', async () => {
  let calls = 0, rendererId = 'first'; const states = new Set();
  const previews = new DiagramPreviews(() => ({
    id: rendererId,
    createState() { const state = {}; states.add(state); return state; },
    async render(source, { id, state, mode }) { calls++; assert.equal(mode, 'preview'); assert.ok(states.has(state)); return { svg: `<svg id="${id}">${source}</svg>` }; },
  }), 2);
  const input = { repo: 'one', path: 'a.diagram', source: 'original', id: 'first' };
  const first = await previews.render(input);
  assert.equal(await previews.render({ ...input, id: 'second' }), first); assert.equal(calls, 1);
  await previews.render({ ...input, source: 'edited' }); assert.equal(calls, 2);
  rendererId = 'second'; await previews.render({ ...input, source: 'edited' }); assert.equal(calls, 3);
  await previews.render({ ...input, repo: 'two' }); assert.equal(calls, 4);
  await previews.render({ ...input, path: 'b.diagram' }); assert.equal(previews.cache.size, 2);
  await previews.render({ ...input, source: 'edited' }); assert.equal(calls, 6);
});

test('SVGを差し替えてもズーム中心と表示位置を維持する', () => {
 const f=setup();const v=f.viewport;
 const center={x:(640-v.x)/v.scale,y:(360-v.y)/v.scale};v.zoom(2,640,360);
 assert.equal((640-v.x)/v.scale,center.x);assert.equal((360-v.y)/v.scale,center.y);
 const before={x:v.x,y:v.y,scale:v.scale};v.measure();assert.deepEqual({x:v.x,y:v.y,scale:v.scale},before);
 assert.match(f.elements.graph.style.transform,/scale\(2\)/);assert.equal(f.elements.graph.querySelector('svg').style.width,'500px');
 v.reset();assert.equal(v.width,0);assert.equal(v.scale,1);f.close();
});

test('無限背景は画面全体を覆い、端までパンしても図と同じ変換で繰り返す', () => {
 const f=setup(), v=f.viewport;
 v.apply(-123456,98765,.375);
 assert.equal(v.backgroundPattern.getAttribute('patternTransform'),'translate(-123456 98765) scale(0.375)');
 const layer=f.canvas.querySelector('.canvas-background');
 assert.equal(layer.getAttribute('width'),'100%');assert.equal(layer.getAttribute('height'),'100%');
 assert.equal(layer.querySelector('rect').getAttribute('width'),'100%');
 assert.equal(v.backgroundPattern.getAttribute('width'),'20');
 assert.equal(Number(v.backgroundDot.getAttribute('r'))*.375,1);
 v.reset();assert.equal(v.backgroundPattern.getAttribute('patternTransform'),'translate(0 0) scale(1)');f.close();
});
