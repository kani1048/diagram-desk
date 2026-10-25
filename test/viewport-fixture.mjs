import { JSDOM } from 'jsdom';
import { CanvasViewport } from '../public/canvas-viewport.mjs';
export function setup() {
 const dom = new JSDOM('<div id="canvas"><div id="graph"><svg viewBox="0 0 500 200"></svg></div><aside id="code-panel" hidden></aside></div><span id="zoom-level"></span><button id="zoom-in"></button><button id="zoom-out"></button><button id="zoom-reset"></button>', { pretendToBeVisual: true });
 const window = dom.window, document = window.document;
 const elements = Object.fromEntries(['canvas','graph','code-panel','zoom-level','zoom-in','zoom-out','zoom-reset'].map(id => [id, document.getElementById(id)]));
 const canvas = elements.canvas;
 Object.defineProperties(canvas, { clientWidth: {value: 1280}, clientHeight: {value: 720} });
 canvas.getBoundingClientRect = () => ({left:0,top:0,width:1280,height:720});
 Object.defineProperty(document.querySelector('svg'), 'viewBox', {value:{baseVal:{width:500,height:200}}});
 const viewport = new CanvasViewport(elements, () => ({observe(){}})); viewport.measure();
 const mouse = (type, x=500, y=300, target=canvas, options={}) => {
  const event = new window.MouseEvent(type, {view:window,bubbles:true,cancelable:true,clientX:x,clientY:y, ...options}); target.dispatchEvent(event); return event;
 };
 const wheel = options => { const event = new window.WheelEvent('wheel', { bubbles:true,cancelable:true,clientX:500,clientY:300,...options }); canvas.dispatchEvent(event); return event; };
 const touch = (type, points, changed=points) => {
  const event = new window.Event(type,{bubbles:true,cancelable:true});
  const asTouch = ([identifier,clientX,clientY]) => ({identifier,clientX,clientY,pageX:clientX,pageY:clientY,target:canvas});
  Object.defineProperties(event,{touches:{value:points.map(asTouch)},changedTouches:{value:changed.map(asTouch)}});canvas.dispatchEvent(event);return event;
 };
 return {viewport,canvas,elements,window,mouse,wheel,touch, close:()=>window.close()};
}
