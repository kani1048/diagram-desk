import { findDiagramFormat, requireDiagramPath } from '../../shared/diagram-formats.mjs';
const stylesheets = new Map();
function loadStylesheet(href) {
  if (!href || typeof document === 'undefined') return;
  if (!stylesheets.has(href)) stylesheets.set(href, new Promise((resolve, reject) => {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href;
    link.onload = resolve;
    link.onerror = () => { stylesheets.delete(href); link.remove(); reject(new Error(`Stylesheet unavailable: ${href}`)); };
    document.head.append(link);
  }));
  return stylesheets.get(href);
}
// Loading a format's renderer never imports another format's engine.
export function rendererFor(path) {
  requireDiagramPath(path);
  const format = findDiagramFormat(path);
  let renderer;
  const load = () => renderer ??= format.loadRenderer();
  // State and synchronous events are provided once open() has awaited ready().
  let loaded;
  return {
    ...format,
    async ready() { [loaded] = await Promise.all([load(), loadStylesheet(format.stylesheet)]); },
    createState() { return loaded.createState(); },
    highlight(source) { return loaded.highlight(source); },
    render: async (...args) => (await load()).render(...args),
    handleEvent: (...args) => loaded?.handleEvent?.(...args),
  };
}
