import { createHash } from 'node:crypto';
import { realpath, stat } from 'node:fs/promises';
import { dirname, basename } from 'node:path';
import { requireDiagramPath } from '../../shared/diagram-formats.mjs';
import { Desk } from '../application/desk.mjs';
import { FileCatalog } from './filesystem.mjs';
// One-file session: no persistent registry and no exposure of adjacent diagrams.
export async function createFileView(file) {
  const absolute = await realpath(file);
  if (!(await stat(absolute)).isFile()) throw new Error('図のファイルを指定してください');
  const path = requireDiagramPath(basename(absolute)), root = dirname(absolute);
  const repository = { id: createHash('sha256').update(absolute).digest('hex').slice(0, 16), path: root, name: path };
  const catalog = new FileCatalog();
  const check = value => { if (value !== path) throw new Error('Diagram not in this file session'); };
  const desk = new Desk({ registry: { list: async () => [repository] }, catalog: {
    list: async () => [path],
    read: async (root, value) => { check(value); return catalog.read(root, value); },
    save: async (root, value, ...args) => { check(value); return catalog.save(root, value, ...args); },
  } });
  return { desk, repository, path, file: absolute };
}
