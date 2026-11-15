import { onionFormat } from './onion/format.mjs';
import { mermaidFormat } from './mermaid/format.mjs';
// One registration supplies discovery, documentation, validation and rendering.
export const DIAGRAM_FORMATS = Object.freeze([onionFormat, mermaidFormat]);
export function findDiagramFormat(path) {
  return typeof path === 'string' ? DIAGRAM_FORMATS.find(format => path.endsWith(format.extension)) || null : null;
}
