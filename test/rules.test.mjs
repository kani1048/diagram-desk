import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { validateDiagram } from '../src/application/validate-diagram.mjs';
import { runRules } from '../validation/run.mjs';
import { RULESETS } from '../validation/index.mjs';
import { validateDDD } from '../validation/rulesets/ddd/rules.mjs';
import { analyzeOnion } from '../validation/adapters/onion.mjs';
const root = new URL('../', import.meta.url);
const architecture = JSON.parse(await readFile(new URL('../examples/ddd.onion.json', import.meta.url), 'utf8'));
const declarations = JSON.parse(await readFile(new URL('../examples/ddd.rules.json', import.meta.url), 'utf8'));
const configFile = 'ddd.rules.json';
const validate = (model = architecture, configuration = declarations.ddd, extra = {}) => validateDiagram('architecture.onion.json', JSON.stringify(model), {
  rules: ['ddd'], ruleConfigurations: { ddd: configuration }, configurationFile: configFile, ...extra,
});
const has = (result, code, path) => result.diagnostics.some(item => item.code === code && (path === undefined || item.path === path));

test('公開例は独立したDDD宣言で通り、基本検証だけの従来出力を変えない', async () => {
  const result = await validate();
  assert.equal(result.valid, true); assert.equal(result.ruleResults[0].status, 'passed');
  const basic = await validateDiagram('architecture.onion.json', JSON.stringify(architecture));
  assert.deepEqual(basic, { file: 'architecture.onion.json', format: 'onion', valid: true, diagnostics: [] });
  assert.equal((await validateDiagram('a.onion.json', JSON.stringify(architecture), { rules: ['ddd'] })).ruleResults[0].status, 'incomplete');
});

test('DDD集約宣言の違反は設定ファイルとPointerを指す', async () => {
  const cases = [
    [c => c.aggregates[0].root = 'sales:checkout', 'DDD_ROOT_NOT_ENTITY', '/ddd/aggregates/0/root'],
    [c => c.aggregates[0].members = ['sales:line'], 'DDD_ROOT_NOT_MEMBER', '/ddd/aggregates/0/root'],
    [c => c.aggregates[1].members.push('sales:line'), 'DDD_MULTIPLE_AGGREGATES', '/ddd/aggregates/1/members/1'],
    [c => { c.aggregates[0].members.push('delivery:shipment'); c.aggregates[1].members = ['sales:checkout']; }, 'DDD_AGGREGATE_CROSSES_BOUNDARY', '/ddd/aggregates/0/members/2'],
    [c => c.aggregates[0].root = 'missing', 'DDD_UNKNOWN_ROOT', '/ddd/aggregates/0/root'],
    [c => c.aggregates[0].members.push('sales:missing'), 'DDD_UNKNOWN_MEMBER', '/ddd/aggregates/0/members/2'],
    [c => c.aggregates[0].boundedContextId = 'missing', 'DDD_UNKNOWN_BOUNDARY', '/ddd/aggregates/0/boundedContextId'],
    [c => c.entities.push('sales:missing'), 'DDD_UNKNOWN_ENTITY', '/ddd/entities/3'],
    [c => c.boundedContexts[0].architectureContexts.push('missing'), 'DDD_UNKNOWN_CONTEXT', '/ddd/boundedContexts/0/architectureContexts/1'],
    [c => c.boundedContexts[1].architectureContexts.push('sales'), 'DDD_AMBIGUOUS_CONTEXT', '/ddd/boundedContexts/1/architectureContexts/1'],
    [c => c.aggregates[1].id = c.aggregates[0].id, 'DDD_DUPLICATE_AGGREGATE', '/ddd/aggregates/1/id'],
  ];
  for (const [edit, code, path] of cases) {
    const config = structuredClone(declarations.ddd); edit(config);
    const result = await validate(architecture, config);
    assert.equal(result.valid, false, code); assert.equal(result.ruleResults[0].status, 'failed', code);
    const item = result.diagnostics.find(item => item.code === code && item.path === path);
    assert.ok(item, code + JSON.stringify(result.diagnostics)); assert.equal(item.file, configFile); assert.equal(item.ruleset, 'ddd');
  }
});

test('集約外から内部への永続オブジェクト参照を拒否し、根拠のある関係だけを評価する', async () => {
  const model = structuredClone(architecture), config = structuredClone(declarations.ddd);
  model.contexts[0].relations[0].to = 'line';
  config.references[0].to = 'sales:line';
  const result = await validate(model, config);
  assert.equal(result.ruleResults[0].status, 'failed');
  const item = result.diagnostics.find(item => item.code === 'DDD_EXTERNAL_MEMBER_REFERENCE');
  assert.equal(item.file, 'architecture.onion.json'); assert.equal(item.path, '/contexts/0/relations/0'); assert.equal(item.category, 'violation');
  config.references[0].semantics = 'transient';
  assert.equal((await validate(model, config)).valid, true);
  // Existing internal object reference and cross-context identity reference pass.
  assert.equal((await validate()).valid, true);
});

test('不足情報は違反と区別し、不完全な宣言から違反を導出しない', async () => {
  const cases = [
    [c => delete c.entities, 'DDD_INFORMATION_REQUIRED'],
    [c => c.aggregates = [], 'DDD_INFORMATION_REQUIRED'],
    [c => c.entities.push('sales:checkout'), 'DDD_ENTITY_WITHOUT_AGGREGATE'],
    [c => c.references.shift(), 'DDD_REFERENCE_SEMANTICS_REQUIRED'],
  ];
  for (const [edit, code] of cases) {
    const config = structuredClone(declarations.ddd); edit(config);
    const result = await validate(architecture, config);
    assert.equal(result.valid, false); assert.equal(result.ruleResults[0].status, 'incomplete', code);
    assert.ok(has(result, code)); assert.ok(result.diagnostics.every(item => item.category === 'information'));
  }
  const model = structuredClone(architecture), config = structuredClone(declarations.ddd);
  model.contexts.push({ id: 'other', layers: [{ id: 'domain', order: 0 }], components: [] });
  config.boundedContexts[1].architectureContexts = ['other'];
  const unmapped = await validate(model, config);
  assert.equal(unmapped.ruleResults[0].status, 'incomplete'); assert.ok(has(unmapped, 'DDD_CONTEXT_MAPPING_REQUIRED'));
  const bad = structuredClone(declarations.ddd); bad.entities = 'wrong';
  const result = await validate(architecture, bad);
  assert.equal(result.ruleResults[0].status, 'failed'); assert.ok(has(result, 'DDD_CONFIG_INVALID', '/ddd/entities'));
});

test('関係の参照が削除・重複・並べ替えされたら設定の修正を促す', async () => {
  const config = structuredClone(declarations.ddd);
  config.references[0].relation = '/missing';
  assert.ok(has(await validate(architecture, config), 'DDD_UNKNOWN_RELATION'));
  config.references[0] = { ...config.references[1], semantics: 'transient' };
  assert.ok(has(await validate(architecture, config), 'DDD_DUPLICATE_REFERENCE'));
  const model = structuredClone(architecture); model.contexts[0].relations.reverse();
  assert.ok(has(await validate(model), 'DDD_STALE_REFERENCE'));
});

test('ルールの対応宣言・複数選択・未知・未対応・構造不正・実行失敗を明示する', async () => {
  const base = { file: 'a.onion.json', format: 'onion', source: JSON.stringify(architecture), structurallyValid: true, configurations: declarations };
  assert.equal((await runRules({ ...base, rules: ['unknown'] }))[0].status, 'unknown');
  assert.equal((await runRules({ ...base, format: 'mermaid', rules: ['ddd'] }))[0].status, 'unsupported');
  assert.equal((await runRules({ ...base, structurallyValid: false, source: '{', rules: ['ddd'] }))[0].status, 'skipped');
  let calls = 0;
  const team = { id: 'team', supports: { onion: analyzeOnion }, validate: ({ graph }) => {
    calls++; assert.equal(graph.nodes.length, 4); return { status: 'passed', diagnostics: [] };
  } };
  const result = await validate(architecture, declarations.ddd, { rules: ['ddd', 'team', 'team'], rulesets: [...RULESETS, team] });
  assert.equal(result.valid, true); assert.equal(calls, 1); assert.deepEqual(result.ruleResults.map(item => item.id), ['ddd', 'team']);
  const broken = { ...team, validate() { throw new Error('unavailable'); } };
  const failed = await runRules({ ...base, rules: ['team', 'ddd'] }, [broken, ...RULESETS]);
  assert.deepEqual(failed.map(item => item.status), ['execution-error', 'passed']);
  const inconsistent = { ...team, validate: () => ({ status: 'passed', diagnostics: [{ severity: 'error', message: 'violation' }] }) };
  assert.equal((await runRules({ ...base, rules: ['team'] }, [inconsistent]))[0].status, 'execution-error');
  const invalidModel = structuredClone(architecture); invalidModel.contexts[0].relations[0].to = 'missing';
  const invalid = await validate(invalidModel);
  assert.equal(invalid.ruleResults[0].status, 'skipped'); assert.ok(has(invalid, 'UNKNOWN_COMPONENT'));
});

test('DDD本体は別アーキテクチャの中立グラフにも変更なしで適用できる', async () => {
  const graph = analyzeOnion(JSON.stringify(architecture));
  const config = structuredClone(declarations);
  graph.edges.forEach((edge, index) => { edge.id = `relation-${index}`; edge.path = ''; config.ddd.references[index].relation = edge.id; });
  // The integration registers support; the policy only sees the graph contract.
  const other = { id: 'ddd', supports: { other: () => graph }, validate: validateDDD };
  const result = await runRules({ file: 'a.other', format: 'other', source: 'arbitrary', rules: ['ddd'], configurations: config, structurallyValid: true }, [other]);
  assert.equal(result[0].status, 'passed');
  const imports = await readFile(new URL('../validation/rulesets/ddd/rules.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(imports, /from ['"].*formats\//);
  for (const path of ['format.mjs', 'model.mjs', 'validation.mjs']) {
    assert.doesNotMatch(await readFile(new URL('../formats/onion/' + path, import.meta.url), 'utf8'), /from ['"].*(?:validation\/|rulesets|ddd)/i);
  }
});

function cli(...args) {
  const result = spawnSync(process.execPath, ['bin/diagram-desk.mjs', ...args], { cwd: root, encoding: 'utf8', timeout: 15000 });
  assert.ifError(result.error);
  return { status: result.status, output: JSON.parse(result.stdout || result.stderr) };
}
test('CLIでルール選択・設定・Schema・診断・終了コードを一貫して利用できる', async () => {
  const directory = await mkdtemp('/tmp/codex-work-');
  try {
    const file = join(directory, 'config.json');
    const args = ['validate', 'examples/ddd.onion.json', '--rules', 'ddd', '--rules-config', file];
    await writeFile(file, JSON.stringify(declarations));
    assert.equal(cli(...args).status, 0);
    const config = structuredClone(declarations); config.ddd.aggregates[0].members.push('delivery:shipment');
    await writeFile(file, JSON.stringify(config));
    const result = cli(...args);
    assert.equal(result.status, 1); assert.ok(result.output.results[0].diagnostics.some(item => item.code === 'DDD_AGGREGATE_CROSSES_BOUNDARY' && item.file === file));
    assert.equal(cli('validate', 'examples/ddd.onion.json', '--rules=ddd').output.results[0].ruleResults[0].status, 'incomplete');
    assert.equal(cli('validate', 'examples/ddd.onion.json', '--rules', 'typo').output.results[0].ruleResults[0].status, 'unknown');
    assert.equal(cli('validate', 'examples/architecture.mmd', '--rules', 'ddd').output.results[0].ruleResults[0].status, 'unsupported');
    assert.deepEqual(cli('rules').output[0].supports, ['onion']);
    assert.equal(cli('rules', 'schema', 'ddd').output.title, 'DDD declarations');
    for (const content of ['{', 'null', '{"typo":{}}']) {
      await writeFile(file, content); assert.equal(cli(...args).status, 1);
    }
    assert.equal(cli('validate', 'examples/ddd.onion.json', '--rules-config', file).status, 1);
    assert.equal(cli('validate', 'examples/ddd.onion.json', '--rules').status, 1);
    assert.equal(cli('validate', 'examples/ddd.onion.json', '--typo').status, 1);
  } finally { await rm(directory, { recursive: true }); }
});
