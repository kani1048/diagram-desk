import { runRules } from '../../validation/run.mjs';
import { findDiagramFormat } from '../../formats/index.mjs';
import { diagnostic } from '../../formats/diagnostics.mjs';
export async function validateDiagram(file, source, options = {}) {
  const format = findDiagramFormat(file);
  const diagnostics = format ? await format.validate(source, options) : [diagnostic('UNSUPPORTED_FORMAT', '', '対応していない図の形式です')];
  const base = { file, format: format?.id ?? null, valid: diagnostics.length === 0, diagnostics: diagnostics.map(item => ({ ...item, file })) };
  if (!options.rules?.length) return base;
  const ruleResults = await runRules({ file, format: base.format, source, rules: options.rules,
    configurations: options.ruleConfigurations, configurationFile: options.configurationFile, structurallyValid: base.valid }, options.rulesets);
  return { ...base, valid: base.valid && ruleResults.every(result => result.status === 'passed'),
    diagnostics: [...base.diagnostics, ...ruleResults.flatMap(result => result.diagnostics)], ruleResults };
}
