import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { join } from 'node:path';
import Ajv from 'ajv';
import { DIAGRAM_FORMATS } from '../formats/index.mjs';
import { validateDiagram } from '../src/application/validate-diagram.mjs';
import { parseArchitectureModel } from '../formats/onion/model.mjs';
import { onionRenderer } from '../formats/onion/renderer.mjs';
import { rendererFor } from '../public/renderers/index.mjs';
import { createFileView } from '../src/infrastructure/file-view.mjs';
const root = new URL('../', import.meta.url);
const single = JSON.parse(await readFile(new URL('../examples/sample.onion.json', import.meta.url), 'utf8'));
const multi = JSON.parse(await readFile(new URL('../examples/contexts.onion.json', import.meta.url), 'utf8'));
const schema = JSON.parse(await readFile(new URL('../formats/onion/schema.json', import.meta.url), 'utf8'));
const checkSchema = new Ajv({ strictRequired: false }).compile(schema);
const source = value => JSON.stringify(value);
const diagnose = async value => (await validateDiagram('a.onion.json', source(value))).diagnostics;

test('各形式の登録から書式・検証・描画へ到達し、公開サンプルはSchemaと描画の両方に通る', async () => {
  assert.deepEqual(DIAGRAM_FORMATS.map(format => format.id), ['onion', 'mermaid']);
  for (const format of DIAGRAM_FORMATS) {
    assert.equal(typeof format.validate, 'function');
    assert.ok((await readFile(new URL('..' + format.documentation, import.meta.url), 'utf8')).length);
    assert.equal((await format.loadRenderer()).id, format.id);
  }
  for (const model of [single, multi]) {
    assert.equal(checkSchema(model), true, JSON.stringify(checkSchema.errors));
    assert.equal((await diagnose(model)).length, 0);
    const renderer = rendererFor('a.onion.json'); await renderer.ready();
    assert.match((await renderer.render(source(model), { id: 'test', state: renderer.createState(), mode: 'detail' })).svg, /<svg/);
  }
});

test('Onionの構造エラーは公開Schemaで拒否し、フィールドへのPointerを返す', async () => {
  const cases = [
    [model => delete model.schemaVersion, '/schemaVersion', 'SCHEMA_REQUIRED'],
    [model => model.schemaVersion = '99', '/schemaVersion', 'SCHEMA_ENUM'],
    [model => model.layers[0].order = '0', '/layers/0/order', 'SCHEMA_TYPE'],
    [model => model.components[0] = null, '/components/0', 'SCHEMA_TYPE'],
    [model => model.layers = [], '/layers', 'SCHEMA_MINITEMS'],
    [model => model.relations = {}, '/relations', 'SCHEMA_TYPE'],
    [model => model.components[0].socket = 'typo', '/components/0/socket', 'SCHEMA_ENUM'],
    [model => model.components[0].layerID = 'domain', '/components/0/layerID', 'SCHEMA_ADDITIONALPROPERTIES'],
  ];
  for (const [edit, path, code] of cases) {
    const model = structuredClone(single); edit(model);
    assert.equal(checkSchema(model), false);
    assert.ok((await diagnose(model)).some(item => item.path === path && item.code === code), path);
  }
  assert.equal((await validateDiagram('a.onion.json', '{')).diagnostics[0].code, 'INVALID_JSON');
});

test('CLIと描画はID重複・層・関係・通信・hubの参照について同じ診断を返す', async () => {
  const cases = [
    [single, m => m.layers.push(m.layers[0]), '/layers/3/id', 'DUPLICATE_ID'],
    [single, m => m.components.push(m.components[0]), '/components/6/id', 'DUPLICATE_ID'],
    [single, m => m.components[2].layerId = 'missing', '/components/2/layerId', 'UNKNOWN_LAYER'],
    [single, m => m.relations[0].to = 'missing', '/relations/0/to', 'UNKNOWN_COMPONENT'],
    [multi, m => m.contexts.push(m.contexts[0]), '/contexts/2/id', 'DUPLICATE_ID'],
    [multi, m => m.buses.push(m.buses[0]), '/buses/1/id', 'DUPLICATE_ID'],
    [multi, m => m.links[0].to = 'missing:id', '/links/0/to', 'UNKNOWN_ENDPOINT'],
    [multi, m => m.hubContextId = 'missing', '/hubContextId', 'UNKNOWN_CONTEXT'],
  ];
  for (const [original, edit, path, code] of cases) {
    const model = structuredClone(original); edit(model);
    const diagnostics = await diagnose(model);
    assert.ok(diagnostics.some(item => item.path === path && item.code === code), path);
    assert.throws(() => parseArchitectureModel(source(model)), error => {
      assert.deepEqual(error.diagnostics, diagnostics.map(({ file, ...item }) => item)); return true;
    });
    await assert.rejects(onionRenderer.render(source(model), { id: 'bad', state: {}, mode: 'detail' }), error => error.diagnostics.some(item => item.code === code));
  }
});

function cli(...args) {
  try { return { status: 0, output: JSON.parse(execFileSync(process.execPath, ['bin/diagram-desk.mjs', ...args], { cwd: root, encoding: 'utf8' })) }; }
  catch (error) { return { status: error.status, output: JSON.parse(error.stdout) }; }
}
test('CLIは複数ファイルの正常・不正・未対応・読込失敗をJSONと終了コードで返す', async () => {
  const directory = await mkdtemp('/tmp/codex-work-');
  try {
    const file = join(directory, 'bad.onion.json');
    const model = structuredClone(single); model.components[0].layerId = 'missing';
    await writeFile(file, source(model));
    const result = cli('validate', 'examples/sample.onion.json', file);
    assert.equal(result.status, 1); assert.equal(result.output.valid, false);
    assert.equal(result.output.results[0].valid, true);
    assert.equal(result.output.results[1].diagnostics[0].file, file);
    assert.equal(result.output.results[1].diagnostics[0].path, '/components/0/layerId');
    await writeFile(join(directory, 'bad.txt'), 'hello');
    assert.equal(cli('validate', join(directory, 'bad.txt')).output.results[0].diagnostics[0].code, 'UNSUPPORTED_FORMAT');
    assert.equal(cli('validate', join(directory, 'missing.onion.json')).status, 1);
    assert.equal(cli('show', file).status, 1);
    assert.equal(cli('validate', 'examples/sample.onion.json', 'examples/contexts.onion.json').status, 0);
    assert.equal(cli('formats').output.find(item => item.id === 'onion').schema, '/formats/onion/schema.json');
    assert.deepEqual(cli('schema', 'onion').output, schema);
  } finally { await rm(directory, { recursive: true }); }
});

test('Mermaid CLI検証は実エンジンでラベルを含む複数の図を解析する', async () => {
  const directory = await mkdtemp('/tmp/codex-work-');
  try {
    const file = join(directory, 'diagram.mmd');
    for (const text of ['flowchart LR\nA[顧客]-->B[注文]', 'classDiagram\nclass Customer', 'sequenceDiagram\nA->>B: hello']) {
      await writeFile(file, text); assert.equal(cli('validate', file).status, 0, text);
    }
    await writeFile(file, 'flowchart LR\nA[broken');
    const result = cli('validate', file);
    assert.equal(result.status, 1); assert.equal(result.output.results[0].diagnostics[0].code, 'MERMAID_SYNTAX');
  } finally { await rm(directory, { recursive: true }); }
});

test('showはGit登録なしで指定ファイルだけを公開し、外部更新を通知する', async () => {
  const directory = await mkdtemp('/tmp/codex-work-');
  let child;
  try {
    const file = join(directory, '日本語 #.onion.json'); await writeFile(file, source(single));
    await writeFile(join(directory, 'other.onion.json'), source(single));
    const view = await createFileView(file);
    assert.equal((await view.desk.listDiagrams(view.repository.id)).length, 1);
    await assert.rejects(view.desk.readDiagram(view.repository.id, 'other.onion.json'), /file session/);
    child = spawn(process.execPath, ['bin/diagram-desk.mjs', 'show', file], { cwd: root, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let errors = ''; child.stderr.on('data', chunk => { errors += chunk; });
    const info = await new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error('show did not start: ' + errors)), 10000);
      child.stdout.on('data', chunk => { output += chunk; try { const result = JSON.parse(output); clearTimeout(timeout); resolve(result); } catch {} });
      child.once('exit', code => { clearTimeout(timeout); reject(new Error('show exited: ' + code + errors)); });
    });
    assert.equal((await fetch(info.url)).status, 200);
    const base = new URL(info.url).origin;
    const endpoint = base + `/api/repositories/${view.repository.id}/source?file=${encodeURIComponent(view.path)}`;
    assert.equal((await (await fetch(endpoint)).json()).source, source(single));
    const controller = new AbortController();
    const response = await fetch(endpoint.replace('/source?', '/events?'), { signal: controller.signal });
    const reader = response.body.getReader(); await reader.read();
    const changed = structuredClone(single); changed.components[0].label = '外部更新'; await writeFile(file, source(changed));
    let output = ''; const timeout = setTimeout(() => controller.abort(), 5000);
    try { while (!output.includes('外部更新')) { const { value } = await reader.read(); output += new TextDecoder().decode(value); } }
    finally { clearTimeout(timeout); controller.abort(); }
    assert.match(output, /外部更新/);
    for (const [path, type] of [['/formats/onion/schema.json', 'application/json'], ['/formats/onion/README.md', 'text/plain'], ['/formats/onion/style.css', 'text/css'], ['/formats/onion/schema-validator.mjs', 'text/javascript']]) {
      const asset = await fetch(base + path); assert.equal(asset.status, 200, path); assert.match(asset.headers.get('content-type'), new RegExp(type));
    }
  } finally {
    if (child && child.exitCode === null) { child.kill(); await once(child, 'exit'); }
    await rm(directory, { recursive: true });
  }
});
