import checkSchema from './schema-validator.mjs';
import { DiagramValidationError, diagnostic } from '../diagnostics.mjs';
const pointer = value => String(value).replaceAll('~', '~0').replaceAll('/', '~1');
export function validateOnionData(data) {
  if (!checkSchema(data)) {
    throw new DiagramValidationError(checkSchema.errors.filter(error => error.keyword !== 'if').map(error => {
      const property = error.params.missingProperty ?? error.params.additionalProperty;
      const path = error.instancePath + (property === undefined ? '' : '/' + pointer(property));
      return diagnostic('SCHEMA_' + error.keyword.toUpperCase(), path, error.message);
    }));
  }
  const errors = [];
  const add = (code, path, message) => errors.push(diagnostic(code, path, message));
  function unique(items, path) {
    const ids = new Set();
    items.forEach((item, index) => {
      if (ids.has(item.id)) add('DUPLICATE_ID', `${path}/${index}/id`, `id が重複しています: ${item.id}`);
      ids.add(item.id);
    });
    return ids;
  }
  const contexts = data.contexts || [{ ...data, id: data.id || 'main' }];
  if (data.contexts) unique(contexts, '/contexts');
  const endpoints = new Set();
  contexts.forEach((context, index) => {
    const path = data.contexts ? `/contexts/${index}` : '';
    if (context.id === 'bus') add('RESERVED_ID', `${path}/id`, 'context id の bus は通信バス用の予約語です');
    const layers = unique(context.layers, path + '/layers');
    const components = unique(context.components, path + '/components');
    context.components.forEach((component, i) => {
      if (!layers.has(component.layerId)) add('UNKNOWN_LAYER', `${path}/components/${i}/layerId`, `未定義の layerId です: ${component.layerId}`);
      endpoints.add(`${context.id}:${component.id}`);
    });
    (context.relations || []).forEach((relation, i) => {
      for (const side of ['from', 'to']) if (!components.has(relation[side])) add('UNKNOWN_COMPONENT', `${path}/relations/${i}/${side}`, `参照先が未定義です: ${relation[side]}`);
    });
  });
  unique(data.buses || [], '/buses');
  (data.buses || []).forEach(bus => endpoints.add(`bus:${bus.id}`));
  (data.links || []).forEach((link, i) => {
    for (const side of ['from', 'to']) if (!endpoints.has(link[side])) add('UNKNOWN_ENDPOINT', `/links/${i}/${side}`, `参照先が未定義です: ${link[side]}`);
  });
  if (data.hubContextId && !contexts.some(context => context.id === data.hubContextId)) add('UNKNOWN_CONTEXT', '/hubContextId', `hubContextId が未定義です: ${data.hubContextId}`);
  if (errors.length) throw new DiagramValidationError(errors);
  return data;
}
export function parseOnionSource(source) {
  let data;
  try { data = JSON.parse(source); }
  catch { throw new DiagramValidationError([diagnostic('INVALID_JSON', '', 'JSON として読めません')]); }
  return validateOnionData(data);
}
export function validateOnion(source) {
  try { parseOnionSource(source); return []; }
  catch (error) { if (error instanceof DiagramValidationError) return error.diagnostics; throw error; }
}
