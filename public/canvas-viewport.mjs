import { select, zoom, zoomIdentity } from './lib/viewport.mjs';
export class CanvasViewport {
  constructor(elements, observeResize = callback => new ResizeObserver(callback)) {
    this.elements = elements;
    this.scale = 1; this.x = 0; this.y = 0; this.width = 0; this.height = 0; this.dragged = false;
    const canvas = this.element('canvas');
    this.createBackground();
    this.selection = select(canvas);
    this.behavior = zoom().extent(() => [[0, 0], [canvas.clientWidth, canvas.clientHeight]])
      .touchable(() => true).scaleExtent([.1, 8]).clickDistance(4).tapDistance(12)
      .filter(event => {
        const accepted = !this.isControl(event.target) && !this.gesture && !event.button && (event.type !== 'wheel' || event.ctrlKey || event.metaKey);
        this.trace('d3.filter', event, { accepted });
        return accepted;
      })
      .on('start', event => {
        if (!event.sourceEvent) return;
        this.start = { x: this.x, y: this.y, scale: this.scale };
        this.dragged = false;
        this.touching = event.sourceEvent.type.startsWith('touch');
        this.trace('d3.start', event.sourceEvent);
      })
      .on('zoom', event => {
        const { x, y, k } = event.transform;
        this.trace('d3.zoom', event.sourceEvent, { transform: { x, y, k } });
        if (event.sourceEvent && this.start && (Math.hypot(x - this.start.x, y - this.start.y) >= 4 || Math.abs(k - this.start.scale) > .001)) this.dragged = true;
        this.x = x; this.y = y; this.scale = k; this.viewport();
        canvas.classList.toggle('dragging', Boolean(event.sourceEvent && this.dragged));
      })
      .on('end', event => { this.trace('d3.end', event.sourceEvent); this.touching = false; canvas.classList.remove('dragging'); });
    this.selection.call(this.behavior).on('dblclick.zoom', event => {
      // D3 recognizes double taps. Keep desktop double clicks for renderer actions.
      if (event.type !== 'touchend') return;
      const touch = event.changedTouches[0];
      canvas.dispatchEvent(new canvas.ownerDocument.defaultView.MouseEvent('dblclick', { bubbles: true, clientX: touch.clientX, clientY: touch.clientY }));
    });
    canvas.addEventListener('wheel', event => {
      if (this.isControl(event.target)) { this.trace('control.ignored', event); return; }
      event.preventDefault();
      if (event.ctrlKey || event.metaKey || this.gesture) { this.trace('wheel.pan-skipped', event); return; }
      this.trace('wheel.pan', event);
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
      this.apply(this.x - event.deltaX * unit, this.y - event.deltaY * unit);
    }, { passive: false });
    // Safari trackpad fallback. Touchscreen gestures belong exclusively to D3.
    canvas.addEventListener('gesturestart', event => {
      if (this.isControl(event.target)) { this.trace('control.ignored', event); return; }
      event.preventDefault();
      if (!this.touching) this.gesture = { scale: this.scale };
      this.trace('safari.start', event, { accepted: !this.touching });
    }, { passive: false });
    canvas.addEventListener('gesturechange', event => {
      if (this.isControl(event.target)) { this.trace('control.ignored', event); return; }
      event.preventDefault();
      this.trace('safari.change', event, { accepted: Boolean(this.gesture) });
      if (!this.gesture) return;
      const rect = canvas.getBoundingClientRect();
      const x = Number.isFinite(event.clientX) ? event.clientX : rect.left + rect.width / 2;
      const y = Number.isFinite(event.clientY) ? event.clientY : rect.top + rect.height / 2;
      if (Number.isFinite(event.scale) && event.scale > 0) { this.zoom(this.gesture.scale * event.scale, x, y); this.dragged = true; }
    }, { passive: false });
    canvas.addEventListener('gestureend', event => {
      if (this.isControl(event.target)) { this.trace('control.ignored', event); return; }
      this.trace('safari.end', event);
      event.preventDefault(); this.gesture = null;
    }, { passive: false });
    this.element('zoom-in').onclick = () => this.zoomCenter(1.2);
    this.element('zoom-out').onclick = () => this.zoomCenter(1 / 1.2);
    this.element('zoom-reset').onclick = () => this.fit();
    this.resizeObserver = observeResize(() => { if (this.width && canvas.getClientRects().length) this.viewport(); });
    this.resizeObserver.observe(canvas);
  }
  element(id) { return this.elements[id]; }
  isControl(target) { return Boolean(target.closest('button,aside,#zoom-controls,#viewer-error')); }
  createBackground() {
    const canvas = this.element('canvas'), doc = canvas.ownerDocument;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = doc.createElementNS(ns, 'svg');
    svg.classList.add('canvas-background'); svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
    const defs = doc.createElementNS(ns, 'defs'), pattern = doc.createElementNS(ns, 'pattern');
    const id = 'canvas-dots-' + (doc.defaultView.crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
    pattern.id = id; pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    pattern.setAttribute('width', '20'); pattern.setAttribute('height', '20');
    const dot = doc.createElementNS(ns, 'circle');
    dot.setAttribute('cx', '10'); dot.setAttribute('cy', '10'); dot.setAttribute('r', '1'); dot.setAttribute('fill', '#dce2ea');
    pattern.append(dot); defs.append(pattern);
    const surface = doc.createElementNS(ns, 'rect');
    surface.setAttribute('width', '100%'); surface.setAttribute('height', '100%'); surface.setAttribute('fill', `url(#${id})`);
    svg.append(defs, surface); canvas.prepend(svg);
    this.backgroundPattern = pattern; this.backgroundDot = dot;
  }
  backgroundState() {
    return { renderer: 'svg-pattern', transform: this.backgroundPattern.getAttribute('patternTransform'),
      tileSize: 20, dotRadius: Number(this.backgroundDot.getAttribute('r')) };
  }
  trace(type, event, details = {}) {
    const diagnostic = this.element('canvas').ownerDocument.defaultView.__wslPreviewDiagnostics;
    if (!diagnostic?.active) return;
    const touches = event?.touches ? Array.from(event.touches, t => ({ id: t.identifier, x: t.clientX, y: t.clientY })) : [];
    const midpoint = touches.length === 2 ? { x: (touches[0].x + touches[1].x) / 2, y: (touches[0].y + touches[1].y) / 2 } : null;
    diagnostic.record('canvas.' + type, { eventType: event?.type || 'programmatic', eventTime: event?.timeStamp,
      x: event?.clientX, y: event?.clientY, gestureScale: event?.scale, touches, midpoint,
      state: { x: this.x, y: this.y, scale: this.scale, touching: Boolean(this.touching), safariGesture: Boolean(this.gesture) }, ...details });
  }
  recordFrame() {
    const canvas = this.element('canvas'), view = canvas.ownerDocument.defaultView;
    const diagnostic = view.__wslPreviewDiagnostics;
    if (!diagnostic?.active) return;
    this.trace('applied', null, { graphTransform: this.element('graph').style.transform, background: this.backgroundState() });
    if (this.diagnosticFrame) return;
    this.diagnosticFrame = view.requestAnimationFrame(() => {
      this.diagnosticFrame = 0;
      if (!diagnostic.active) return;
      const graph = this.element('graph'), style = view.getComputedStyle(graph);
      const rect = canvas.getBoundingClientRect(), bounds = graph.getBoundingClientRect();
      diagnostic.record('canvas.frame', { state: { x: this.x, y: this.y, scale: this.scale },
        graph: { transform: style.transform, origin: style.transformOrigin, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
        background: this.backgroundState(),
        canvas: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        visualViewport: view.visualViewport ? { scale: view.visualViewport.scale, x: view.visualViewport.offsetLeft, y: view.visualViewport.offsetTop } : null });
    });
  }
  reset() { this.width = 0; this.height = 0; this.gesture = null; this.dragged = false; this.touching = false; this.apply(0, 0, 1); }
  measure() {
    const svg = this.element('graph').querySelector('svg');
    const box = svg.viewBox.baseVal, first = !this.width;
    this.width = box.width; this.height = box.height;
    if (first) this.fit(); else this.viewport();
  }
  viewport() {
    const svg = this.element('graph').querySelector('svg');
    if (svg) { svg.style.width = this.width + 'px'; svg.style.height = this.height + 'px'; }
    this.element('graph').style.transform = `translate(${this.x}px,${this.y}px) scale(${this.scale})`;
    this.backgroundPattern.setAttribute('patternTransform', `translate(${this.x} ${this.y}) scale(${this.scale})`);
    // Preserve the existing one-screen-pixel dot radius for this renderer comparison.
    this.backgroundDot.setAttribute('r', String(1 / this.scale));
    this.element('zoom-level').textContent = Math.round(this.scale * 100) + '%';
    this.recordFrame();
  }
  apply(x, y, scale = this.scale) { this.selection.call(this.behavior.transform, zoomIdentity.translate(x, y).scale(scale)); }
  zoom(scale, clientX, clientY) {
    const rect = this.element('canvas').getBoundingClientRect();
    this.selection.call(this.behavior.scaleTo, scale, [clientX - rect.left, clientY - rect.top]);
  }
  zoomCenter(factor) { const rect = this.element('canvas').getBoundingClientRect(); this.zoom(this.scale * factor, rect.left + rect.width / 2, rect.top + rect.height / 2); }
  fit() { if (!this.width) return; const rect = this.element('canvas').getBoundingClientRect(); const panel = this.element('code-panel').hidden ? 0 : this.element('code-panel').clientWidth + 24; const top = 128, bottom = 72; const width = Math.max(120, rect.width - panel - 48), height = Math.max(120, rect.height - top - bottom); this.scale = Math.max(.1, Math.min(width / this.width, height / this.height, 1)); this.x = panel + 24 + (width - this.width * this.scale) / 2; this.y = top + (height - this.height * this.scale) / 2; this.apply(this.x, this.y, this.scale); }
}
