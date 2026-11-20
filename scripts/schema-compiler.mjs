import { readFile, writeFile } from 'node:fs/promises';
import Ajv from 'ajv';
import standalone from 'ajv/dist/standalone/index.js';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
export async function buildSchema(source, target, banner, check = false) {
  const schema = JSON.parse(await readFile(source, 'utf8'));
  const ajv = new Ajv({ allErrors: true, code: { source: true, esm: true }, strict: true, strictRequired: false });
  const code = standalone(ajv, ajv.compile(schema));
  const result = await build({ stdin: { contents: code, resolveDir: fileURLToPath(new URL('../', import.meta.url)), sourcefile: 'schema.mjs' }, bundle: true, format: 'esm', platform: 'neutral', minify: true, write: false });
  const output = banner + '\n' + result.outputFiles[0].text;
  if (check) {
    if (await readFile(target, 'utf8') !== output) throw new Error('Schema validator is stale: ' + target);
  } else await writeFile(target, output);
}
