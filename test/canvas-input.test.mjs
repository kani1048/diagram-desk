import test from 'node:test';
import assert from 'node:assert/strict';
import { mermaidRenderer, frameSource } from '../public/renderers/mermaid.mjs';
import { setup } from './viewport-fixture.mjs';
test('D3は手ぶれとドラッグを区別して、次のクリックを回復する', () => {
 const f=setup(); const {viewport:v,mouse,window}=f; const x=v.x;
 mouse('mousedown'); mouse('mousemove',502,300,window); mouse('mouseup',502,300,window); assert.equal(v.dragged,false);
 mouse('mousedown'); mouse('mousemove',510,300,window); mouse('mouseup',510,300,window); assert.equal(v.dragged,true); assert.equal(v.x,x+12);
 mouse('mousedown'); mouse('mouseup',500,300,window); assert.equal(v.dragged,false); f.close();
});
test('スクロールはパン、Ctrl/Meta wheelはズームし、UIの入力を奪わない', () => {
 const f=setup(); const {viewport:v,wheel,mouse,elements,window}=f; const {x,y,scale}=v;
 assert.equal(wheel({deltaX:20,deltaY:30}).defaultPrevented,true);assert.equal(v.x,x-20);assert.equal(v.y,y-30);assert.equal(v.scale,scale);
 wheel({ctrlKey:true,deltaY:-10});assert.ok(v.scale>scale);
 const before=v.scale; mouse('dblclick');assert.equal(v.scale,before);
 const event=new window.WheelEvent('wheel',{bubbles:true,cancelable:true,ctrlKey:true,deltaY:-100});elements['code-panel'].dispatchEvent(event);assert.equal(v.scale,before);assert.equal(event.defaultPrevented,false);f.close();
});
test('2本指を同方向へ動かすとパンし、広げるとズームする', () => {
 const f=setup();const {viewport:v,touch}=f;const x=v.x,scale=v.scale;
 touch('touchstart',[[1,100,200],[2,200,200]]);
 touch('touchmove',[[1,130,220],[2,230,220]]); assert.ok(Math.abs(v.x-x-30)<.001);assert.equal(v.scale,scale);
 touch('touchmove',[[1,130,220],[2,280,220]]); assert.ok(Math.abs(v.scale-scale*1.5)<.001);
 touch('touchend',[[1,130,220]],[[2,280,220]]);const next=v.x;
 touch('touchmove',[[1,140,220]]);assert.ok(Math.abs(v.x-next-10)<.001);
 touch('touchend',[],[[1,140,220]]);f.close();
});
test('SafariのGestureEventはD3のタッチ・wheelと二重にズームしない', () => {
 const f=setup();const {viewport:v,canvas,window,wheel,touch}=f;
 const gesture=(type,scale=1)=>{const e=new window.Event(type,{cancelable:true});Object.defineProperties(e,{scale:{value:scale},clientX:{value:500},clientY:{value:300}});canvas.dispatchEvent(e);return e;};
 const initial=v.scale;assert.equal(gesture('gesturestart').defaultPrevented,true);gesture('gesturechange',1.5);assert.equal(v.scale,initial*1.5);
 wheel({ctrlKey:true,deltaY:-100});assert.equal(v.scale,initial*1.5);gesture('gestureend');
 touch('touchstart',[[1,100,200],[2,200,200]]);gesture('gesturestart');assert.equal(v.gesture,null);
 const base=v.scale;gesture('gesturechange',2);assert.equal(v.scale,base);touch('touchend',[],[[1,100,200],[2,200,200]]);f.close();
});
test('座標から枠を拾い、ハイフン付きIDと空白が異なる宣言でも開閉する', () => {
  const source = 'flowchart LR\nsubgraph g-services[Services]\nA-->B\nend\ng-services@{view:collapsed}';
  const canvas = {}, frame = { id: 'flowchart-g-services-0', parentElement: canvas };
  const label = { id: '', parentElement: frame };
  canvas.ownerDocument = { elementFromPoint() { return label; } };
  const state = mermaidRenderer.createState();
  const event = { target: canvas, clientX: 50, clientY: 60 };
  assert.equal(mermaidRenderer.handleEvent({ type: 'dblclick', source, state, canvas, event }), true);
  assert.equal(state.get('g-services'), false);
  assert.match(frameSource(source, state), /view: expanded/);
  assert.ok(!frameSource(source, state).includes('view:collapsed'));
  assert.equal(mermaidRenderer.handleEvent({ type: 'dblclick', source, state, canvas, event }), true);
  assert.equal(state.get('g-services'), true);
});

test('D3のダブルタップは枠開閉イベントになり、ズームしない', () => {
 const f=setup();const {viewport:v,touch,canvas}=f;const scale=v.scale;let doubleClicks=0;
 canvas.addEventListener('dblclick',()=>doubleClicks++);
 touch('touchstart',[[1,100,200]]);touch('touchend',[],[[1,100,200]]);
 touch('touchstart',[[2,101,201]]);touch('touchend',[],[[2,101,201]]);
 assert.equal(doubleClicks,1);assert.equal(v.scale,scale);f.close();
});
