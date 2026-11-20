import { RULESETS } from './index.mjs';
const escape = value => String(value).replaceAll('~', '~0').replaceAll('/', '~1');
export async function runRules({ file, format, source, rules = [], configurations = {}, configurationFile, structurallyValid }, registry = RULESETS) {
  const results = [], graphs = new Map();
  for (const id of new Set(rules)) {
    const ruleset = registry.find(item => item.id === id);
    let result;
    if (!ruleset) result = { status: 'unknown', diagnostics: [{ code: 'UNKNOWN_RULESET', message: `未登録のルールセットです: ${id}` }] };
    else if (!Object.hasOwn(ruleset.supports, format)) result = { status: 'unsupported', diagnostics: [{ code: 'UNSUPPORTED_RULESET', message: `${id} は ${format} に対応していません` }] };
    else if (!structurallyValid) result = { status: 'skipped', diagnostics: [] };
    else {
      try {
        const analyze = ruleset.supports[format];
        if (!graphs.has(analyze)) graphs.set(analyze, await analyze(source));
        result = await ruleset.validate({ graph: graphs.get(analyze), configuration: configurations[id] });
        if (!result || !['passed', 'failed', 'incomplete'].includes(result.status) || !Array.isArray(result.diagnostics)
          || (result.status === 'passed') !== (result.diagnostics.length === 0)) {
          throw new Error('ルールセットが不整合な検証結果を返しました');
        }
      } catch (error) {
        result = { status: 'execution-error', diagnostics: [{ code: 'RULESET_EXECUTION_ERROR', category: 'execution', message: error.message }] };
      }
    }
    results.push({ id, status: result.status, diagnostics: result.diagnostics.map(({ target, ...item }) => ({
      severity: 'error', category: 'configuration', path: '', ...item, ruleset: id,
      file: target === 'configuration' ? configurationFile || file : file,
      ...(target === 'configuration' ? { path: '/' + escape(id) + item.path, source: 'configuration' } : {}),
    })) });
  }
  return results;
}
