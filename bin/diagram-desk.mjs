#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createDesk } from '../src/bootstrap.mjs';
import { serve } from '../src/interfaces/http.mjs';
import { validateDiagram } from '../src/application/validate-diagram.mjs';
import { createFileView } from '../src/infrastructure/file-view.mjs';
import { loadMermaidForValidation } from '../src/infrastructure/mermaid-validation.mjs';
import { DIAGRAM_FORMATS } from '../formats/index.mjs';
import { RULESETS, describeRulesets } from '../validation/index.mjs';
import { parseValidationArguments } from '../src/interfaces/validation-args.mjs';
import { readRuleConfiguration } from '../src/infrastructure/rule-configuration.mjs';
import { screenUrl } from '../public/routes.mjs';
const [command, action, ...args] = process.argv.slice(2);
const desk = createDesk();
const print = result => console.log(JSON.stringify(result, null, 2));
async function validateFile(file, options = {}) {
  try { return await validateDiagram(file, await readFile(file, 'utf8'), { ...options, loadEngine: loadMermaidForValidation }); }
  catch (error) { return { file, format: null, valid: false, diagnostics: [{ file, severity: 'error', code: 'READ_OR_VALIDATION_ERROR', path: '', message: error.message }] }; }
}
try {
  let result;
  if (command === 'validate') {
    let input;
    try { input = parseValidationArguments(process.argv.slice(3)); }
    catch (error) {
      result = { valid: false, results: [], diagnostics: [{ severity: 'error', category: 'configuration', code: 'INVALID_ARGUMENT', path: '', message: error.message }] };
    }
    if (input) {
      const configuration = input.configurationFile ? await readRuleConfiguration(input.configurationFile) : { configurations: {}, diagnostics: [] };
      if (configuration.diagnostics.length) result = { valid: false, results: [], diagnostics: configuration.diagnostics };
      else {
        const results = [];
        // Mermaid parsing shares an engine; validate sequentially.
        for (const file of input.files) results.push(await validateFile(file, { rules: input.rules, ruleConfigurations: configuration.configurations, configurationFile: input.configurationFile }));
        result = { valid: results.every(item => item.valid), results };
      }
    }
    if (!result.valid) process.exitCode = 1;
  }
  else if (command === 'rules') {
    if (!action) result = describeRulesets();
    else if (action === 'schema' && args.length === 1) {
      const ruleset = RULESETS.find(item => item.id === args[0]);
      if (!ruleset?.configurationSchema) throw new Error('このルールセットには設定 Schema がありません');
      result = JSON.parse(await readFile(new URL('../' + ruleset.configurationSchema, import.meta.url), 'utf8'));
    } else throw new Error('diagram-desk rules | rules schema <id>');
  }
  else if (command === 'formats') result = DIAGRAM_FORMATS.map(({ id, extension, label, documentation, schema }) => ({ id, extension, label, documentation, ...(schema ? { schema } : {}) }));
  else if (command === 'schema') {
    const format = DIAGRAM_FORMATS.find(format => format.id === action);
    if (!format?.schema) throw new Error('この形式には JSON Schema がありません');
    result = JSON.parse(await readFile(new URL('..' + format.schema, import.meta.url), 'utf8'));
  }
  else if (command === 'show') {
    if (!action || args.length) throw new Error('diagram-desk show <file>');
    const validation = await validateFile(action);
    if (!validation.valid) { result = validation; process.exitCode = 1; }
    else {
      const view = await createFileView(action);
      const server = serve(view.desk, Number(process.env.PORT || 4310), process.env.HOST || '127.0.0.1', {
        onListening: base => print({ file: view.file, format: validation.format, url: base + screenUrl(view.repository.id, view.path) }),
      });
      await once(server, 'listening');
    }
  }
  else if (command === 'serve') { const server = serve(desk, Number(process.env.PORT || 4310), process.env.HOST || '127.0.0.1'); await once(server, 'listening'); }
  else if (command === 'repo' && action === 'add') result = await desk.register(args[0], args[1]);
  else if (command === 'repo' && action === 'list') result = await desk.listRepositories();
  else if (command === 'diagram' && action === 'list') result = (await desk.listDiagrams(args[0])).map(({ source, ...item }) => item);
  else if (command === 'diagram' && action === 'save') { const input = JSON.parse(await readFile(args[2], 'utf8')); result = await desk.saveDiagram(args[0], args[1], input.source, input.baseSource); }
  else if (command === 'diagram' && action === 'read') result = await desk.readDiagram(args[0], args[1]);
  else { console.log('diagram-desk validate <file> [file ...] [--rules <id>] [--rules-config <file>] | rules [schema <id>] | show <file> | formats | schema <format-id> | serve | repo add <path> [name] | repo list | diagram list <repo-id> | diagram read <repo-id> <path> | diagram save <repo-id> <path> <json-file>'); if (command) process.exitCode = 1; }
  if (result !== undefined) print(result);
} catch (error) { console.error(JSON.stringify({ error: error.message })); process.exitCode = 1; }
