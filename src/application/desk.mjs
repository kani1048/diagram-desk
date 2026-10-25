import { Repository } from '../domain/repository.mjs';
import { describeDiagram, describeDiagramIndex, diagramPath } from '../domain/diagram.mjs';
export class Desk {
  constructor({ registry, repositories, catalog }) { Object.assign(this, { registry, repositories, catalog }); }
  async listRepositories() { return this.registry.list(); }
  async register(path, name) {
    const resolved = await this.repositories.resolve(path);
    const items = await this.registry.list();
    const found = items.find(item => item.path === resolved.path);
    if (found) return found;
    const item = new Repository({ ...resolved, name: name || resolved.name });
    await this.registry.save([...items, item]);
    return item;
  }
  async repository(id) {
    const item = (await this.registry.list()).find(item => item.id === id);
    if (!item) throw new Error('Repository not found');
    return item;
  }
  async listDiagramIndex(id) {
    const repository = await this.repository(id);
    const paths = await this.catalog.list(repository.path);
    return paths.map(describeDiagramIndex);
  }
  async listDiagrams(id) {
    const repository = await this.repository(id);
    const paths = await this.catalog.list(repository.path);
    return Promise.all(paths.map(async path => describeDiagram(path, await this.catalog.read(repository.path, path))));
  }
  async saveDiagram(id, path, source, baseSource) {
    diagramPath(path);
    if (typeof source !== 'string' || typeof baseSource !== 'string') throw new Error('Source and baseSource are required');
    const repository = await this.repository(id);
    await this.catalog.save(repository.path, path, source, baseSource);
    return describeDiagram(path, source);
  }
  async readDiagram(id, path) {
    diagramPath(path);
    const repository = await this.repository(id);
    return describeDiagram(path, await this.catalog.read(repository.path, path));
  }
}
