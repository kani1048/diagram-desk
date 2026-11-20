import { parseOnionSource } from '../../formats/onion/validation.mjs';
// Integration boundary: preserve source pointers, expose no Onion layout details.
export function analyzeOnion(source) {
  const data = parseOnionSource(source);
  const contexts = (data.contexts || [{ ...data, id: data.id || 'main' }]).map((context, index) => ({
    ...context, path: data.contexts ? `/contexts/${index}` : '',
  }));
  return {
    contexts: contexts.map(context => ({ id: context.id, path: context.path })),
    nodes: [
      ...contexts.flatMap(context => context.components.map((component, i) => ({
        id: `${context.id}:${component.id}`, contextId: context.id, path: `${context.path}/components/${i}`,
      }))),
      ...(data.buses || []).map((bus, i) => ({ id: `bus:${bus.id}`, contextId: null, path: `/buses/${i}` })),
    ],
    edges: [
      ...contexts.flatMap(context => (context.relations || []).map((relation, i) => ({
        from: `${context.id}:${relation.from}`, to: `${context.id}:${relation.to}`, id: `${context.path}/relations/${i}`, path: `${context.path}/relations/${i}`,
      }))),
      ...(data.links || []).map((link, i) => ({ from: link.from, to: link.to, id: `/links/${i}`, path: `/links/${i}` })),
    ],
  };
}
