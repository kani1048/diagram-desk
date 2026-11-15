import { loadMermaid } from './engine.mjs';
import { diagnostic } from '../diagnostics.mjs';
export const mermaidFormat = Object.freeze({
  id: 'mermaid', extension: '.mmd', label: 'Mermaid', editorLabel: 'Mermaidコード',
  documentation: '/formats/mermaid/README.md',
  kind(source) {
    const header = source.split(/\r?\n/).find(line => line.trim() && !line.trim().startsWith('%%')) || '';
    return header.trim().split(/\s/)[0];
  },
  async validate(source, { loadEngine = loadMermaid } = {}) {
    const engine = await loadEngine();
    try { await engine.parse(source); return []; }
    catch (error) {
      const item = diagnostic('MERMAID_SYNTAX', '', error.message || String(error));
      if (Number.isInteger(error.hash?.loc?.first_line)) item.line = error.hash.loc.first_line;
      return [item];
    }
  },
  loadRenderer: () => import('./renderer.mjs').then(module => module.mermaidRenderer),
});
