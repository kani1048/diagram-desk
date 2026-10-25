import { findDiagramFormat } from '../../shared/diagram-formats.mjs';
import { readFile, writeFile, mkdir, readdir, realpath, stat, rename } from 'node:fs/promises';
import { join, dirname, relative, basename, resolve, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { diagramPath } from '../domain/diagram.mjs';
export class JsonRegistry {
  constructor(file) { this.file = file; }
  async list() { try { return JSON.parse(await readFile(this.file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return []; throw error; } }
  async save(items) {
    await mkdir(dirname(this.file), { recursive: true });
    const temporary = this.file + '.' + randomUUID();
    await writeFile(temporary, JSON.stringify(items, null, 2), { mode: 0o600 });
    await rename(temporary, this.file);
  }
}
export class GitRepositories {
  async resolve(path) {
    const root = await realpath(resolve(path));
    await stat(join(root, '.git'));
    return { id: createHash('sha256').update(root).digest('hex').slice(0, 16), path: root, name: basename(root) };
  }
}
export class FileCatalog {
  locks = new Map();
  async save(root, path, source, baseSource) {
    diagramPath(path);
    if (Buffer.byteLength(source) > 2 * 1024 * 1024) throw new Error('Diagram is too large');
    const realRoot = await realpath(root);
    const target = await realpath(join(realRoot, path));
    const back = relative(realRoot, target);
    if (back.startsWith('..' + sep) || back === '..') throw new Error('Diagram outside repository');
    const previous = this.locks.get(target) || Promise.resolve();
    const operation = previous.catch(() => {}).then(async () => {
      const current = await this.read(realRoot, path);
      if (current !== baseSource) { const error = new Error('外部変更があります。内容を確認してから保存してください。'); error.status = 409; throw error; }
      const temporary = join(dirname(target), '.diagram-desk-' + randomUUID());
      const info = await stat(target);
      await writeFile(temporary, source, { mode: info.mode });
      await rename(temporary, target);
    });
    this.locks.set(target, operation);
    try { await operation; } finally { if (this.locks.get(target) === operation) this.locks.delete(target); }
  }
  async list(root) {
    const paths = [];
    async function walk(dir) {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (['.git', 'node_modules', '.data'].includes(entry.name) || entry.isSymbolicLink()) continue;
        const path = join(dir, entry.name);
        if (entry.isDirectory()) await walk(path);
        else if (entry.isFile() && findDiagramFormat(entry.name)) paths.push(relative(root, path).split(sep).join('/'));
      }
    }
    await walk(root);
    return paths.sort();
  }
  async read(root, path) {
    diagramPath(path);
    const realRoot = await realpath(root);
    const target = await realpath(join(realRoot, path));
    const back = relative(realRoot, target);
    if (back.startsWith('..' + sep) || back === '..') throw new Error('Diagram outside repository');
    const info = await stat(target);
    if (!info.isFile() || info.size > 2 * 1024 * 1024) throw new Error('Invalid or oversized diagram');
    return readFile(target, 'utf8');
  }
}
