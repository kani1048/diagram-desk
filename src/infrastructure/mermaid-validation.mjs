// Mermaid's parser uses DOMPurify even without rendering. Keep its DOM in this
// Node-only adapter; importing the browser format registry never loads jsdom.
let engine;
export function loadMermaidForValidation() {
  return engine ??= (async () => {
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM('');
    globalThis.window = dom.window;
    const { default: mermaid } = await import('mermaid');
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
    return mermaid;
  })();
}
