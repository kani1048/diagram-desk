import { DIAGRAM_FORMATS, findDiagramFormat } from '../formats/index.mjs';
export { DIAGRAM_FORMATS, findDiagramFormat };
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
