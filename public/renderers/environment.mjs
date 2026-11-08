import { parseEnvironment, layoutEnvironment, selectionFor, escapeHtml as e, NODE_KINDS, LINK_KINDS, STATUSES } from './environment-model.mjs';
const colors = { host: '#e9edf4', sbx: '#edf3fc', container: '#eaf4ef', daemon: '#f8eee4', role: '#f3ecfa', config: '#fff5d9', workspace: '#e8f5f5', service: '#f2f2f2' };
const short = (value, length = 24) => Array.from(value).length > length ? Array.from(value).slice(0, length - 1).join('') + '…' : value;
function lines(value, width) {
  const rows = ['']; let used = 0;
  for (const char of value) {
    const size = /[\x00-\x7f]/.test(char) ? 9 : 16;
    if (used + size > width || char === '\n') {
      if (rows.length === 2) { rows[1] = rows[1].slice(0, -1) + '…'; break; }
      rows.push(''); used = 0;
    }
    if (char !== '\n') { rows[rows.length - 1] += char; used += size; }
  }
  return rows.filter(Boolean);
}
const statusColor = status => status === 'confirmed' ? '#287464' : status === 'proposed' ? '#a56829' : '#697586';
export const environmentRenderer = {
  id: 'environment',
  createState: () => ({ kind: '', id: '' }),
  highlight: source => e(source),
  async render(source, { id, state, mode }) {
    const model = parseEnvironment(source), layout = layoutEnvironment(model);
    const selected = selectionFor(model, mode === 'detail' ? state : {}), boxes = new Map(layout.nodes.map(node => [node.id, node]));
    const prefix = 'env-' + Array.from(String(id)).map(char => char.codePointAt(0).toString(16)).join('-');
    const interactive = (kind, item) => mode === 'detail' ? ` tabindex="0" role="button" aria-label="${e(item.label || LINK_KINDS[item.kind])}の詳細" data-env-kind="${kind}" data-env-id="${e(item.id)}"` : '';
    const nodes = layout.nodes.slice().sort((a, b) => b.width * b.height - a.width * a.height).map(node => {
      const hot = selected.item?.id === node.id, near = selected.related.has(node.id), scoped = node.nested.length > 0;
      const title = `${node.label} / ${NODE_KINDS[node.kind]} / ${STATUSES[node.status]}`;
      return `<g${interactive('node', node)}><title>${e(title)}</title><rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="12" fill="${colors[node.kind]}" stroke="${hot ? '#b64e26' : near ? '#c78545' : '#9baabd'}" stroke-width="${hot ? 3 : 1.5}" ${node.status !== 'confirmed' ? 'stroke-dasharray="7 4"' : ''}/><text x="${node.x + 16}" y="${node.y + 22}" fill="#58687c" font-size="11">${e(NODE_KINDS[node.kind])}</text><text x="${node.x + node.width - 16}" y="${node.y + 22}" text-anchor="end" fill="${statusColor(node.status)}" font-size="11">${e(STATUSES[node.status])}</text>${lines(node.label, node.width - 36).map((line, i) => `<text x="${node.x + 16}" y="${node.y + 45 + i * 19}" fill="#253247" font-size="16" font-weight="650">${e(line)}</text>`).join('')}${!scoped ? `<text x="${node.x + 16}" y="${node.y + 96}" fill="#697586" font-size="10">${e(short(node.refs[0] || node.id, 36))}</text>` : ''}</g>`;
    }).join('');
    const links = model.links.map((link, index) => {
      const from = boxes.get(link.from), to = boxes.get(link.to), hot = selected.links.some(item => item.id === link.id);
      const ancestor = (a, b) => { for (let current = b; current?.parent; current = boxes.get(current.parent)) if (current.parent === a.id) return true; return false; };
      // Scope headers are endpoints when one boundary contains the other endpoint.
      const ax = from.x + from.width - 12, ay = from.y + (from.nested.length ? 65 : 76), bx = to.x + to.width - 12, by = to.y + (to.nested.length ? 65 : 76);
      const right = Math.max(ax, bx) + 18 + (index % 5) * 9;
      const d = ancestor(from, to) || ancestor(to, from) || Math.abs(ay - by) > 120 ? `M${ax} ${ay} H${right} V${by} H${bx}` : `M${ax} ${ay} C${ax + 36} ${ay} ${bx + 36} ${by} ${bx} ${by}`;
      const label = `${link.label || LINK_KINDS[link.kind]}${link.access ? ' · ' + link.access : ''}`;
      return `<g${interactive('link', { ...link, label })}><title>${e(label + ': ' + from.label + ' → ' + to.label + ' / ' + STATUSES[link.status])}</title><path d="${d}" fill="none" stroke="transparent" stroke-width="16"/><path d="${d}" fill="none" stroke="${hot ? '#b64e26' : '#5c7892'}" stroke-width="${hot ? 3 : 1.6}" ${link.status !== 'confirmed' ? 'stroke-dasharray="5 4"' : ''} marker-end="url(#${prefix}-arrow)"/><text x="${ax - 8}" y="${ay - 7 - (index % 2) * 2}" text-anchor="end" fill="${hot ? '#a54320' : '#445d75'}" stroke="white" stroke-width="3" paint-order="stroke" font-size="10">${e(short(label, 24))}</text></g>`;
    }).join('');
    let detail = '';
    if (selected.item) {
      const item = selected.item, label = item.label || LINK_KINDS[item.kind];
      const list = values => '<ul>' + values.map(value => `<li>${e(value)}</li>`).join('') + '</ul>';
      const name = key => boxes.get(key)?.label || key;
      detail = `<h2>${e(label)}</h2><p>${e(state.kind === 'node' ? NODE_KINDS[item.kind] : LINK_KINDS[item.kind])} · ${e(STATUSES[item.status])}</p><p>ID: ${e(item.id)}</p>${item.parent ? `<p>所属: ${e(name(item.parent))}</p>` : ''}${state.kind === 'link' ? `<p>${e(name(item.from))} → ${e(name(item.to))}</p>${item.access ? `<p>アクセス: ${e(item.access)}</p>` : ''}${item.target ? `<p>接続先パス: ${e(item.target)}</p>` : ''}` : ''}${item.notes ? `<p>${e(item.notes)}</p>` : ''}${item.evidence ? `<h3>確認記録</h3><p>${e(item.evidence)}</p>` : ''}${item.refs.length ? '<h3>参照元（自動読込なし）</h3>' + list(item.refs) : ''}${selected.links.length ? '<h3>接続</h3>' + list(selected.links.map(link => `${name(link.from)} → ${name(link.to)} / ${link.label || LINK_KINDS[link.kind]}${link.access ? ' / ' + link.access : ''} / ${STATUSES[link.status]}`)) : ''}`;
    }
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" class="environment-diagram" aria-label="${e(model.title)}"><defs><marker id="${prefix}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="#5c7892"/></marker></defs><text x="32" y="35" font-family="system-ui,sans-serif" font-size="22" font-weight="700" fill="#253247">${e(short(model.title, 60))}</text><text x="32" y="64" font-size="12" fill="#697586">枠＝所属 / 矢印＝接続　　破線＝設計案・未確認　実線＝確認記録あり</text><g font-family="system-ui,sans-serif">${nodes}${links}</g><text x="32" y="${layout.height - 32}" font-size="12" fill="#697586"><title>${e(model.notes)}</title>${e(short(model.notes || "要素・線を選択すると詳細を表示。確認状態は入力記録に基づきます。", 110))}</text></svg>`, detail: mode === 'detail' ? detail : '' };
  },
  handleEvent({ type, event, state, graph }) {
    if (!['click', 'keydown'].includes(type) || (type === 'keydown' && !['Enter', ' '].includes(event.key))) return false;
    const target = event.target.closest?.('[data-env-kind]');
    if (target && graph.contains(target)) { state.kind = target.dataset.envKind; state.id = target.dataset.envId; if (type === 'keydown') event.preventDefault(); }
    else { if (type === 'keydown') return false; state.kind = ''; state.id = ''; }
    return true;
  },
};
