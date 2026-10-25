// Pure format definitions shared by domain rules, routes and browser adapters.
// Register a format only when its renderer is available.
export const DIAGRAM_FORMATS = Object.freeze([
  Object.freeze({ id: 'onion', extension: '.onion.json', label: 'Onion Architecture', editorLabel: 'Onion JSON', kind: () => 'Onion Architecture' }),
  Object.freeze({ id: 'mermaid', extension: '.mmd', label: 'Mermaid', editorLabel: 'Mermaidコード', kind: mermaidKind }),
]);
export function findDiagramFormat(path) {
  return typeof path === 'string' ? DIAGRAM_FORMATS.find(format => path.endsWith(format.extension)) || null : null;
}
export function requireDiagramPath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0') || value.startsWith('/') || value.split('/').some(part => !part || part === '.' || part === '..') || !findDiagramFormat(value)) throw new Error('Invalid diagram path');
  return value;
}
export function diagramMetadata(path, source) {
  requireDiagramPath(path);
  const format = findDiagramFormat(path);
  const metadata = { path, name: path.split('/').at(-1).slice(0, -format.extension.length) };
  if (source !== undefined) {
    metadata.kind = format.kind(source);
  }
  return metadata;
}

function mermaidKind(source) {
  const header = source.split(/\r?\n/).find(line => line.trim() && !line.trim().startsWith('%%')) || '';
  return header.trim().split(/\s/)[0];
}
