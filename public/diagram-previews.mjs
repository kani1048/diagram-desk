// Cache belongs to previews, not to any particular rendering engine.
export class DiagramPreviews {
  constructor(rendererFor, limit = 100) { this.rendererFor = rendererFor; this.limit = limit; this.cache = new Map(); }
  async render({ repo, path, source, id }) {
    const renderer = this.rendererFor(path);
    const key = JSON.stringify([repo, path]);
    const cached = this.cache.get(key);
    if (cached?.source === source && cached.rendererId === renderer.id) return cached.svg;
    const { svg } = await renderer.render(source, { id, state: renderer.createState(), mode: 'preview' });
    if (this.limit > 0) {
      this.cache.delete(key);
      if (this.cache.size >= this.limit) this.cache.delete(this.cache.keys().next().value);
      this.cache.set(key, { source, svg, rendererId: renderer.id });
    }
    return svg;
  }
}
