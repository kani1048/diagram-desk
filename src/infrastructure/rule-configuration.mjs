import { readFile } from 'node:fs/promises';
import { RULESETS } from '../../validation/index.mjs';
export async function readRuleConfiguration(file) {
  const failure = (code, path, message) => ({ configurations: null, diagnostics: [{ severity: 'error', category: 'configuration', code, file, path, message }] });
  let source;
  try { source = await readFile(file, 'utf8'); }
  catch (error) { return failure('RULES_CONFIG_READ_ERROR', '', error.message); }
  let data;
  try { data = JSON.parse(source); }
  catch { return failure('RULES_CONFIG_INVALID_JSON', '', 'ルール設定を JSON として読めません'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return failure('RULES_CONFIG_INVALID', '', 'ルール設定はルール ID をキーにしたオブジェクトで指定してください');
  const unknown = Object.keys(data).filter(id => !RULESETS.some(ruleset => ruleset.id === id));
  if (unknown.length) return { configurations: null, diagnostics: unknown.map(id => ({
    severity: 'error', category: 'configuration', code: 'UNKNOWN_RULESET', file,
    path: '/' + id.replaceAll('~', '~0').replaceAll('/', '~1'), message: `未登録のルール設定です: ${id}`,
  })) };
  return { configurations: data, diagnostics: [] };
}
