export class Repository {
  constructor({ id, name, path }) {
    if (!id || !name || !path) throw new Error('Repository requires id, name and path');
    Object.assign(this, { id, name, path });
  }
}
