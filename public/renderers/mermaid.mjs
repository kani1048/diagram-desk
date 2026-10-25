import mermaid from '../mermaid.mjs';
const escape = text => String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function highlight(text) {
  return text.split(/(%%[^\n]*|"[^"\n]*"|\b(?:flowchart|graph|classDiagram|sequenceDiagram|subgraph|end|class|note|participant|actor|direction|style|classDef|linkStyle)\b)/g).map((part, index) => index % 2 ? `<span class="tok-${part.startsWith('%%') ? 'comment' : part.startsWith('"') ? 'string' : 'keyword'}">${escape(part)}</span>` : escape(part)).join('');
}
export function wrapNotes(source, width = 34) {
  return source.split('\n').map(line => line.replace(/^(\s*note\s+(?:for\s+\S+\s+)?")(.*)("\s*)$/, (_, start, text, end) => {
    if (text.includes('<br')) return start + text + end;
    let used = 0, result = '';
    for (const char of text) { const size = /[\u0020-\u007e\uff61-\uff9f]/.test(char) ? 1 : 2; if (used + size > width) { result += '<br/>'; used = 0; } result += char; used += size; }
    return start + result + end;
  })).join('\n');
}
export function frameSource(source, overrides) {
  const ids = [...source.matchAll(/^\s*subgraph\s+([A-Za-z_][A-Za-z0-9_-]*)(?=\s|\[|$)/gm)].map(match => match[1]);
  let result = source;
  for (const [id, collapsed] of overrides) {
    if (!ids.includes(id)) continue;
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp('^\\s*' + escaped + '@\\{\\s*view:\\s*(?:collapsed|expanded)\\s*\\}\\s*$', 'gm'), '');
    result += `\n${id}@{ view: ${collapsed ? 'collapsed' : 'expanded'} }`;
  }
  return result;
}

export const mermaidRenderer = {
  id: 'mermaid',
  createState: () => new Map(),
  highlight,
  async render(source, { id, state, mode }) {
    const shown = mode === 'detail' ? wrapNotes(frameSource(source, state)) : source;
    return mermaid.render(id, shown);
  },
  handleEvent({ type, event, source, state, canvas }) {
    if (type !== 'dblclick') return false;
    let element = canvas.ownerDocument.elementFromPoint(event.clientX, event.clientY) || event.target;
    const ids = [...source.matchAll(/^\s*subgraph\s+([A-Za-z_][A-Za-z0-9_-]*)(?=\s|\[|$)/gm)].map(match => match[1]).sort((a,b) => b.length - a.length);
    while (element && element !== canvas) {
      const frame = ids.find(id => element.id === id || element.id.endsWith('-' + id) || element.id.includes('-' + id + '-'));
      if (frame) { const escaped = frame.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const declared = new RegExp('^\\s*' + escaped + '@\\{\\s*view:\\s*collapsed\\s*\\}', 'm').test(source); state.set(frame, !(state.get(frame) ?? declared)); return true; }
      element = element.parentElement;
    }
    return false;
  },
};
