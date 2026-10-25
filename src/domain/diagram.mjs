import { diagramMetadata } from '../../shared/diagram-formats.mjs';
export { requireDiagramPath as diagramPath } from '../../shared/diagram-formats.mjs';
export function describeDiagram(path, source) {
  return { ...diagramMetadata(path, source), source };
}
export function describeDiagramIndex(path) { return diagramMetadata(path); }
