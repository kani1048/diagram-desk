import { parseOnionSource, validateOnionData } from './validation.mjs';

export function inferSector(component) {
  const kind = (component.kind || '').toLowerCase();
  if (['presentation', 'ui', 'controller', 'rest'].includes(kind) || component.socket === 'api') return 'presentation';
  return kind === 'test' ? 'test' : 'infrastructure';
}
function normalizeContext(raw) {
  return {
    id: raw.id,
    label: raw.label || raw.id,
    layers: raw.layers.map(layer => ({ ...layer, label: layer.label || layer.id }))
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)),
    components: raw.components.map(component => {
      const kind = component.kind || 'component';
      const socket = component.socket || (kind === 'port' ? 'spi' : '');
      return { ...component, label: component.label || component.id, kind, socket,
        sector: component.sector || inferSector({ kind, socket }), groupId: component.groupId || '' };
    }),
    relations: (raw.relations || []).map(relation => ({ ...relation, source: relation.source || 'declared', label: relation.label || '' })),
  };
}
function normalize(data) {
  return {
    schemaVersion: data.schemaVersion,
    contexts: (data.contexts || [{ ...data, id: data.id || 'main', label: data.label || 'Architecture' }]).map(normalizeContext),
    buses: (data.buses || []).map(bus => ({ ...bus, label: bus.label || bus.id })),
    links: (data.links || []).map(link => ({ ...link, label: link.label || link.kind })),
    ...(data.hubContextId ? { hubContextId: data.hubContextId } : {}),
  };
}
export function parseArchitectureModel(source) { return normalize(typeof source === 'string' ? parseOnionSource(source) : validateOnionData(source)); }
export function validateArchitectureModel(data) { return normalize(validateOnionData(data)); }
