import checkSchema from './schema-validator.mjs';
const escape = value => String(value).replaceAll('~', '~0').replaceAll('/', '~1');
const finding = (code, path, message, category = 'violation', target = 'configuration') => ({
  code, path, message, category, target, severity: category === 'information' ? 'warning' : 'error',
});
const result = diagnostics => ({
  status: diagnostics.some(item => item.severity === 'error') ? 'failed' : diagnostics.length ? 'incomplete' : 'passed', diagnostics,
});
// Pure DDD policy. Consumes the common graph contract, never an Onion model.
export function validateDDD({ graph, configuration }) {
  if (configuration === undefined) return result([finding('DDD_DECLARATIONS_REQUIRED', '', 'DDD の境界・集約・実体・参照の意味を --rules-config で宣言してください', 'information', 'architecture')]);
  if (!checkSchema(configuration)) return result(checkSchema.errors.map(error => finding(
    ['required', 'minItems'].includes(error.keyword) ? 'DDD_INFORMATION_REQUIRED' : 'DDD_CONFIG_INVALID',
    error.instancePath + (error.params.missingProperty !== undefined ? '/' + escape(error.params.missingProperty) : error.params.additionalProperty !== undefined ? '/' + escape(error.params.additionalProperty) : ''),
    error.message, ['required', 'minItems'].includes(error.keyword) ? 'information' : 'configuration',
  )));

  const diagnostics = [];
  const add = (...args) => diagnostics.push(finding(...args));
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  const contextIds = new Set(graph.contexts.map(context => context.id));
  const boundaries = new Map(), contextOwners = new Map(), memberships = new Map();
  const aggregates = new Map(), entities = new Set(configuration.entities);
  configuration.boundedContexts.forEach((boundary, i) => {
    if (boundaries.has(boundary.id)) add('DDD_DUPLICATE_CONTEXT', `/boundedContexts/${i}/id`, `境界 ID が重複しています: ${boundary.id}`, 'configuration');
    boundaries.set(boundary.id, boundary);
    boundary.architectureContexts.forEach((id, j) => {
      const path = `/boundedContexts/${i}/architectureContexts/${j}`;
      if (!contextIds.has(id)) add('DDD_UNKNOWN_CONTEXT', path, `アーキテクチャのコンテキストが存在しません: ${id}`, 'configuration');
      if (contextOwners.has(id)) add('DDD_AMBIGUOUS_CONTEXT', path, `複数の境界へ割り当てられています: ${id}`, 'configuration');
      contextOwners.set(id, boundary.id);
    });
  });
  configuration.entities.forEach((id, i) => {
    if (!nodes.has(id)) add('DDD_UNKNOWN_ENTITY', `/entities/${i}`, `実体の要素が存在しません: ${id}`, 'configuration');
  });
  configuration.aggregates.forEach((aggregate, i) => {
    const path = `/aggregates/${i}`;
    if (aggregates.has(aggregate.id)) add('DDD_DUPLICATE_AGGREGATE', path + '/id', `集約 ID が重複しています: ${aggregate.id}`, 'configuration');
    aggregates.set(aggregate.id, aggregate);
    if (!boundaries.has(aggregate.boundedContextId)) add('DDD_UNKNOWN_BOUNDARY', path + '/boundedContextId', `宣言した境界が存在しません: ${aggregate.boundedContextId}`, 'configuration');
    if (!nodes.has(aggregate.root)) add('DDD_UNKNOWN_ROOT', path + '/root', `集約ルートの要素が存在しません: ${aggregate.root}`, 'configuration');
    if (!entities.has(aggregate.root)) add('DDD_ROOT_NOT_ENTITY', path + '/root', '集約ルートは entities に宣言した実体である必要があります');
    if (!aggregate.members.includes(aggregate.root)) add('DDD_ROOT_NOT_MEMBER', path + '/root', '集約ルートを members に含めてください');
    aggregate.members.forEach((id, j) => {
      const memberPath = `${path}/members/${j}`, node = nodes.get(id);
      if (!node) { add('DDD_UNKNOWN_MEMBER', memberPath, `集約の要素が存在しません: ${id}`, 'configuration'); return; }
      if (memberships.has(id)) add('DDD_MULTIPLE_AGGREGATES', memberPath, `要素が複数の集約に所属しています: ${id}`);
      memberships.set(id, aggregate);
      const owner = contextOwners.get(node.contextId);
      if (owner === undefined) add('DDD_CONTEXT_MAPPING_REQUIRED', memberPath, `要素のコンテキストと DDD の境界の対応が未宣言です: ${id}`, 'information');
      else if (owner !== aggregate.boundedContextId) add('DDD_AGGREGATE_CROSSES_BOUNDARY', memberPath, `集約の要素が別の境界に属しています: ${id}`);
    });
  });
  configuration.entities.forEach((id, i) => {
    if (nodes.has(id) && !memberships.has(id)) add('DDD_ENTITY_WITHOUT_AGGREGATE', `/entities/${i}`, `実体の所属集約が未宣言です: ${id}`, 'information');
  });
  const edges = new Map(graph.edges.map(edge => [edge.id, edge]));
  const semantics = new Map();
  configuration.references.forEach((reference, i) => {
    const path = `/references/${i}/relation`;
    const edge = edges.get(reference.relation);
    if (edge && (edge.from !== reference.from || edge.to !== reference.to)) add('DDD_STALE_REFERENCE', path, '関係の端点が宣言時と異なります。参照の意味を確認して宣言を更新してください', 'configuration');
    if (!edge) add('DDD_UNKNOWN_RELATION', path, `参照先の関係が存在しません: ${reference.relation}`, 'configuration');
    if (semantics.has(reference.relation)) add('DDD_DUPLICATE_REFERENCE', path, '同じ関係の意味が複数回宣言されています', 'configuration');
    semantics.set(reference.relation, reference.semantics);
  });
  // Do not derive design violations from contradictory or incomplete declarations.
  if (diagnostics.length) return result(diagnostics);
  for (const edge of graph.edges) {
    const targetAggregate = memberships.get(edge.to);
    if (!targetAggregate) continue;
    const mode = semantics.get(edge.id);
    if (!mode) { add('DDD_REFERENCE_SEMANTICS_REQUIRED', edge.path, '集約へ向かう関係が object / identity / transient のどれかを宣言してください', 'information', 'architecture'); continue; }
    if (mode === 'object' && edge.to !== targetAggregate.root && memberships.get(edge.from) !== targetAggregate) {
      add('DDD_EXTERNAL_MEMBER_REFERENCE', edge.path, `集約外から内部要素 ${edge.to} を参照しています。ルート ${targetAggregate.root} を経由してください`, 'violation', 'architecture');
    }
  }
  return result(diagnostics);
}
