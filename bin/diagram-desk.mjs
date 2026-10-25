#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { createDesk } from '../src/bootstrap.mjs';
import { serve } from '../src/interfaces/http.mjs';
const [command, action, ...args] = process.argv.slice(2);
const desk = createDesk();
try {
  let result;
  if (command === 'serve') { serve(desk, Number(process.env.PORT || 4310), process.env.HOST || '127.0.0.1'); }
  else if (command === 'repo' && action === 'add') result = await desk.register(args[0], args[1]);
  else if (command === 'repo' && action === 'list') result = await desk.listRepositories();
  else if (command === 'diagram' && action === 'list') result = (await desk.listDiagrams(args[0])).map(({ source, ...item }) => item);
  else if (command === 'diagram' && action === 'save') { const input = JSON.parse(await readFile(args[2], 'utf8')); result = await desk.saveDiagram(args[0], args[1], input.source, input.baseSource); }
  else if (command === 'diagram' && action === 'read') result = await desk.readDiagram(args[0], args[1]);
  else { console.log('diagram-desk serve | repo add <path> [name] | repo list | diagram list <repo-id> | diagram read <repo-id> <path> | diagram save <repo-id> <path> <json-file>'); if (command) process.exitCode = 1; }
  if (result !== undefined) console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(JSON.stringify({ error: error.message })); process.exitCode = 1; }
