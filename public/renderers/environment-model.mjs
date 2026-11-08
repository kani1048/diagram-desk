export const NODE_KINDS = Object.freeze({ host: 'ホスト', sbx: 'SBX境界', container: 'コンテナ', daemon: 'Docker daemon', role: 'ロール', config: 'ユーザー構成', workspace: '作業データ', service: '外部サービス' });
export const LINK_KINDS = Object.freeze({ config: '設定参照', mount: 'マウント', docker: 'Docker操作', network: '通信', manages: '管理' });
export const STATUSES = Object.freeze({ proposed: '設計案', confirmed: '確認済み', unknown: '未確認' });
const own = (map, key) => Object.hasOwn(map, key);
const text = (value, label, required = false) => {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.length > 4000 || (required && !value.trim())) throw new Error(`${label}: 文字列が必要です（最大4000文字）`);
  return value;
};
const object = value => value && typeof value === 'object' && !Array.isArray(value);
function common(item, label) {
  if (!object(item)) throw new Error(`${label}: オブジェクトが必要です`);
  const id = text(item.id, `${label}.id`, true);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$/.test(id)) throw new Error(`${label}.id: 英数字と _.:- のみ指定できます`);
  const status = item.status ?? 'unknown';
  if (!own(STATUSES, status)) throw new Error(`${id}: 不正なstatus`);
  const evidence = text(item.evidence, `${id}.evidence`);
  if (status === 'confirmed' && !evidence.trim()) throw new Error(`${id}: 確認済みにはevidenceが必要です`);
  const refs = item.refs ?? [];
  if (!Array.isArray(refs) || refs.length > 20) throw new Error(`${id}: refsは20件までの文字列配列です`);
  return { id, status, evidence, refs: refs.map(ref => text(ref, `${id}.refs`, true)), notes: text(item.notes, `${id}.notes`) };
}
export function parseEnvironment(source) {
  let input; try { input = JSON.parse(source); } catch { throw new Error('環境関係図: JSONを読み込めません'); }
  if (!object(input) || input.version !== 1) throw new Error('環境関係図: version: 1 が必要です');
  if (!Array.isArray(input.nodes) || input.nodes.length < 1 || input.nodes.length > 100) throw new Error('nodesは1〜100件必要です');
  if (!Array.isArray(input.links) || input.links.length > 300) throw new Error('linksは300件までの配列です');
  const ids = new Set();
  const nodes = input.nodes.map(item => {
    const base = common(item, 'node');
    if (ids.has(base.id)) throw new Error(`重複id: ${base.id}`); ids.add(base.id);
    if (!own(NODE_KINDS, item.kind)) throw new Error(`${base.id}: 不正なnode kind`);
    return { ...base, kind: item.kind, label: text(item.label, `${base.id}.label`, true), parent: text(item.parent, `${base.id}.parent`) };
  });
  const byId = new Map(nodes.map(node => [node.id, node]));
  for (const node of nodes) {
    let current = node; const seen = new Set([node.id]);
    while (current.parent) {
      const parent = byId.get(current.parent);
      if (!parent) throw new Error(`${current.id}: 未定義のparent ${current.parent}`);
      if (!['host', 'sbx', 'container'].includes(parent.kind)) throw new Error(`${parent.id}: この種類は包含境界になれません`);
      if (seen.has(parent.id)) throw new Error(`${node.id}: 包含関係が循環しています`);
      seen.add(parent.id); if (seen.size > 12) throw new Error('包含は12階層までです');
      current = parent;
    }
  }
  const links = input.links.map(item => {
    const base = common(item, 'link');
    if (ids.has(base.id)) throw new Error(`重複id: ${base.id}`); ids.add(base.id);
    if (!own(LINK_KINDS, item.kind)) throw new Error(`${base.id}: 不正なlink kind`);
    if (!byId.has(item.from) || !byId.has(item.to)) throw new Error(`${base.id}: 未定義の接続先`);
    if (item.kind === 'mount' && !['ro', 'rw'].includes(item.access)) throw new Error(`${base.id}: mountにはaccess: ro / rw が必要です`);
    return { ...base, kind: item.kind, from: item.from, to: item.to, label: text(item.label, `${base.id}.label`), access: item.kind === 'mount' ? item.access : '', target: text(item.target, `${base.id}.target`) };
  });
  return { version: 1, title: text(input.title, 'title', true), notes: text(input.notes, 'notes'), nodes, links };
}
export function layoutEnvironment(model) {
  const boxes = new Map(), children = parent => model.nodes.filter(node => node.parent === parent);
  function measure(node) {
    const nested = children(node.id).map(measure), columns = Math.min(2, nested.length);
    const widths = Array.from({ length: columns }, (_, column) => Math.max(...nested.filter((_, i) => i % columns === column).map(item => item.width)));
    const rows = []; for (let i = 0; i < nested.length; i += 2) rows.push(Math.max(...nested.slice(i, i + 2).map(item => item.height)));
    const box = { ...node, width: nested.length ? widths.reduce((a, b) => a + b, 0) + 64 + (columns - 1) * 44 : 280, height: nested.length ? rows.reduce((a, b) => a + b, 0) + 112 + (rows.length - 1) * 38 : 114, nested, widths, rows };
    boxes.set(node.id, box); return box;
  }
  const roots = children('').map(measure); let nextX = 32;
  function place(box, x, y) {
    Object.assign(box, { x, y });
    let rowY = y + 80;
    for (let i = 0; i < box.nested.length; i += 2) {
      place(box.nested[i], x + 32, rowY);
      if (box.nested[i + 1]) place(box.nested[i + 1], x + 32 + box.widths[0] + 44, rowY);
      rowY += box.rows[i / 2] + 38;
    }
  }
  for (const root of roots) { place(root, nextX, 104); nextX += root.width + 52; }
  return { nodes: model.nodes.map(node => boxes.get(node.id)), width: Math.max(700, nextX), height: Math.max(...roots.map(root => root.y + root.height)) + 100 };
}
export function selectionFor(model, state) {
  const item = state.kind === 'node' ? model.nodes.find(node => node.id === state.id) : state.kind === 'link' ? model.links.find(link => link.id === state.id) : null;
  const links = !item ? [] : state.kind === 'link' ? [item] : model.links.filter(link => link.from === item.id || link.to === item.id);
  return { item, links, related: new Set(links.flatMap(link => [link.from, link.to])) };
}
export const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
