import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { Desk } from './application/desk.mjs';
import { JsonRegistry, GitRepositories, FileCatalog } from './infrastructure/filesystem.mjs';
export function createDesk() {
  return new Desk({ registry: new JsonRegistry(resolve(process.env.DIAGRAM_DESK_HOME || resolve(homedir(), '.local/share/diagram-desk'), 'repositories.json')), repositories: new GitRepositories(), catalog: new FileCatalog() });
}
