import { findDiagramFormat } from '../../formats/index.mjs';
import { diagnostic } from '../../formats/diagnostics.mjs';
export async function validateDiagram(file, source, options) {
  const format = findDiagramFormat(file);
  const diagnostics = format ? await format.validate(source, options) : [diagnostic('UNSUPPORTED_FORMAT', '', '対応していない図の形式です')];
  return { file, format: format?.id ?? null, valid: diagnostics.length === 0, diagnostics: diagnostics.map(item => ({ ...item, file })) };
}
