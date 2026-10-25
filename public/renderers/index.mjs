import { findDiagramFormat, requireDiagramPath } from '../../shared/diagram-formats.mjs';
import { mermaidRenderer } from './mermaid.mjs';
import { onionRenderer } from './onion.mjs';
const renderers = new Map([[mermaidRenderer.id, mermaidRenderer], [onionRenderer.id, onionRenderer]]);
// render(source, {id, state, mode}) -> {svg}; state belongs to one open document.
// highlight(source) -> escaped HTML; handleEvent(...) -> whether to redraw.
export function rendererFor(path) {
  requireDiagramPath(path);
  const format = findDiagramFormat(path);
  const renderer = renderers.get(format.id);
  if (!renderer) throw new Error(`Renderer unavailable: ${format.id}`);
  return { ...renderer, label: format.label, editorLabel: format.editorLabel };
}
