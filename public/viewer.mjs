import { CanvasViewport } from './canvas-viewport.mjs';
const $ = id => document.getElementById(id);
export class Viewer {
  constructor({ rendererFor, api, onSaved }) {
    Object.assign(this, { rendererFor, api, onSaved });
    this.serial = 0; this.session = 0; this.dirty = false; this.saving = false; this.conflicted = false;
    this.canvasView = new CanvasViewport(Object.fromEntries(['canvas','graph','code-panel','zoom-level','zoom-in','zoom-out','zoom-reset'].map(id => [id, $(id)])));
    this.renderState = null;
    $('source').oninput = () => { this.dirty = $('source').value !== this.base; this.status(); this.color(); this.scheduleDraw(); };
    $('source').onscroll = () => { $('highlight').scrollTop = $('source').scrollTop; $('highlight').scrollLeft = $('source').scrollLeft; };
    $('show-code').onclick = () => this.editor(true); $('close-code').onclick = () => this.editor(false);
    $('save').onclick = () => this.save();
    $('reload-source').onclick = () => { if (this.canLeave()) this.reload(); };
    const canvas = $('canvas');
    for (const type of ['click', 'dblclick']) canvas.addEventListener(type, event => {
      if (!this.renderer || this.canvasView.dragged || event.target.closest('button,aside,#zoom-controls,#viewer-error')) return;
      const changed = this.renderer.handleEvent?.({ type, event, source: $('source').value, state: this.renderState, canvas, graph: $('graph') });
      if (changed) this.draw();
    });
    document.addEventListener('keydown', event => { if (document.body.classList.contains('detail-mode') && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); this.save(); } });
    window.addEventListener('beforeunload', event => { if (this.dirty || this.saving) { event.preventDefault(); event.returnValue = ''; } });
  }
  canLeave() { return !(this.dirty || this.saving) || window.confirm('未保存または保存中の変更があります。移動すると編集内容が失われる可能性があります。続けますか？'); }
  status(message) { $('save-state').textContent = message || (this.conflicted ? '外部変更あり' : this.dirty ? '未保存' : ''); $('save').disabled = !this.dirty || this.saving || this.conflicted; }
  color() { $('highlight').innerHTML = this.renderer.highlight($('source').value); }
  editor(open, update = true) {
    $('code-panel').hidden = !open; $('show-code').hidden = open;
    if (update) { const url = new URL(location.href); if (open) url.searchParams.set('editor', 'on'); else url.searchParams.delete('editor'); history.replaceState(null, '', url); }
  }
  close() { $('selection-detail').hidden = true; this.session++; this.serial++; clearTimeout(this.drawTimer); this.events?.close(); this.events = null; this.canvasView.reset(); this.dirty = false; this.saving = false; }
  async open(repo, path) {
    this.close(); const session = this.session; this.repo = repo; this.path = path; this.renderer = this.rendererFor(path); this.renderState = this.renderer.createState(); $('source').setAttribute('aria-label', this.renderer.editorLabel); this.dirty = false; this.saving = false; this.conflicted = false;
    this.editor(new URLSearchParams(location.search).get('editor') === 'on', false);
    $('viewer-error').hidden = true; $('conflict').hidden = true; $('graph').replaceChildren();
    try {
      const [item, auth] = await Promise.all([this.api(this.endpoint()), this.api('/api/session')]);
      if (session !== this.session) return;
      this.token = auth.token; this.accept(item.source);
      this.events = new EventSource(this.endpoint('events'));
      this.events.onmessage = event => {
        if (session !== this.session) return;
        const item = JSON.parse(event.data);
        if (item.error) { this.error(new Error(item.error)); return; }
        if (item.source === this.base) return;
        if (this.saving) { this.pendingExternal = item.source; return; }
        this.external(item.source);
      };
    } catch (error) { if (session === this.session) this.error(error); }
  }
  endpoint(type = 'source') { return `/api/repositories/${this.repo}/${type}?file=${encodeURIComponent(this.path)}`; }
  accept(source) { this.base = source; $('source').value = source; this.dirty = false; this.conflicted = false; this.pendingExternal = undefined; this.renderState = this.renderer.createState(); $('conflict').hidden = true; this.color(); this.status(); this.scheduleDraw(); this.onSaved(this.repo, this.path, source); }
  external(source) {
    if (!this.dirty) { this.accept(source); return; }
    this.conflicted = true; this.pendingExternal = source; $('external-source').textContent = source; $('conflict').hidden = false; this.status();
  }
  async reload() { try { const item = await this.api(this.endpoint()); this.accept(item.source); } catch (error) { this.error(error); } }
  scheduleDraw() { clearTimeout(this.drawTimer); this.drawTimer = setTimeout(() => this.draw(), 100); }
  async draw() {
    const serial = ++this.serial;
    try {
      const { svg, detail } = await this.renderer.render($('source').value, { id: 'viewer' + serial, state: this.renderState, mode: 'detail' });
      if (serial !== this.serial) return;
      $('viewer-error').hidden = true; $('graph').innerHTML = svg;
      $('selection-detail').innerHTML = detail || ''; $('selection-detail').hidden = !detail;
      this.canvasView.measure();
    } catch (error) { if (serial === this.serial) this.error(error); }
  }
  error(error) { $('viewer-error').hidden = false; $('viewer-error').textContent = error.message; }
  async save() {
    if (!this.dirty || this.saving || this.conflicted) return;
    const session = this.session, submitted = $('source').value, baseSource = this.base;
    this.saving = true; this.status('保存中…');
    try {
      const response = await fetch(this.endpoint(), { method: 'PUT', headers: { 'content-type': 'application/json', 'x-preview-token': this.token }, body: JSON.stringify({ source: submitted, baseSource }) });
      const result = await response.json();
      if (session !== this.session) return;
      if (!response.ok) { if (response.status === 409) { const latest = await this.api(this.endpoint()); if (session === this.session) this.external(latest.source); } throw new Error(result.error); }
      this.base = submitted; this.dirty = $('source').value !== submitted; this.onSaved(this.repo, this.path, submitted);
      this.saving = false;
      if (this.pendingExternal !== undefined && this.pendingExternal !== submitted && this.pendingExternal !== baseSource) this.external(this.pendingExternal);
      this.pendingExternal = undefined; this.status(this.dirty || this.conflicted ? undefined : '保存済み');
    } catch (error) { if (session === this.session) { this.error(error); this.status('保存失敗'); } }
    finally { if (session === this.session) { this.saving = false; this.status(this.dirty || this.conflicted ? undefined : $('save-state').textContent); } }
  }
}
