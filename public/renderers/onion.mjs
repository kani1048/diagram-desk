import { layoutArchitecture, parseArchitectureModel, escapeHtml, svgSafeId, architecturePatternDefs, annularSectorPath, SECTOR_FILL, brokenEdgePaths, FLOW_KINDS } from './onion-model.mjs';
export const onionRenderer = {
  id: 'onion',
  createState: () => ({ kind: '', id: '' }),
  highlight: source => escapeHtml(source).replace(/(&quot;(?:[^&]|&(?!quot;))*&quot;)(\s*:)?|\b(true|false|null|[0-9]+)\b/g, (match, string, colon) => '<span class="tok-' + (colon ? 'keyword' : string ? 'string' : 'keyword') + '">' + match + '</span>'),
  async render(source, { id, state, mode }) {
    const layout = layoutArchitecture(parseArchitectureModel(source));
    const selectedKind = mode === 'detail' ? state.kind : '', selectedId = mode === 'detail' ? state.id : '';
    const graphEl = {}, detailEl = { hidden: true, innerHTML: '' };
    paint(); showSelectionDetail();
    const prefix = svgSafeId(id) + '-';
    // Namespace only real SVG IDs, never data-id attributes used for selection.
    return { svg: graphEl.innerHTML.replace(/(?<![\w-])id="([^"]+)"/g, (_, value) => 'id="' + prefix + value + '"').replace(/url\(#([^)]+)\)/g, (_, value) => 'url(#' + prefix + value + ')'), detail: detailEl.hidden ? '' : detailEl.innerHTML };
function attrs(map) {
  return Object.entries(map).map(([key, value]) => {
    if (value == null || value === "") return "";
    return " " + key + '="' + escapeHtml(String(value)) + '"';
  }).join("");
}

function nodeMarkup(node, dim, selected) {
  const hot = selected === " selected" || selected === " neighbor";
  const cls = "node " + escapeHtml(node.kind) + selected + (dim ? " dim" : "") + (hot && selected === " selected" ? " hot" : "");
  const id = "node-" + svgSafeId(node.id);
  const common = attrs({
    id,
    class: cls,
    "data-kind": "component",
    "data-id": node.id,
    "data-label": node.label,
    "data-layer-id": node.layerId || "",
    "data-sector": node.sector || "",
    "data-socket": node.socket || "",
    "data-context-id": node.contextId || "",
    "data-shape": node.shape || "card",
  });
  const title = "<title>" + escapeHtml(node.label + " (" + node.id + ")") + "</title>";
  if (node.shape === "socket") {
    const sock = (node.socket || "spi").toUpperCase();
    return "<g" + common + ">" + title +
      '<rect x="' + (node.x - 28) + '" y="' + (node.y - 14) + '" width="56" height="28" rx="4" fill="#d4d4d4" stroke="#212322" stroke-width="2"></rect>' +
      '<text x="' + node.x + '" y="' + (node.y + 4) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#111">' + escapeHtml(sock) + '</text>' +
      '<text x="' + node.x + '" y="' + (node.y + 28) + '" text-anchor="middle" font-size="10" fill="#334155">' + escapeHtml(node.label) + '</text></g>';
  }
  if (node.shape === "bus") {
    return "<g" + common + ">" + title +
      '<rect x="' + (node.x - 48) + '" y="' + (node.y - 18) + '" width="96" height="36" rx="18" fill="#fff" stroke="#111827" stroke-width="2"></rect>' +
      '<text x="' + node.x + '" y="' + (node.y + 5) + '" text-anchor="middle" font-size="12" font-weight="700">' + escapeHtml(node.label) + '</text></g>';
  }
  const w = Math.max(72, Math.min(120, node.label.length * 8 + 24));
  return "<g" + common + ">" + title +
    '<rect x="' + (node.x - w / 2) + '" y="' + (node.y - 16) + '" width="' + w + '" height="32" rx="6" fill="#fff" stroke="#334155" stroke-width="2"></rect>' +
    '<text x="' + node.x + '" y="' + (node.y + 5) + '" text-anchor="middle" font-size="11" font-weight="600">' + escapeHtml(node.label) + '</text></g>';
}

function ringLabelMarkup(context, ring, outerLayerId) {
  if (ring.layerId === outerLayerId) return "";
  const cx = context.center.x;
  const cy = context.center.y;
  // ドメイン（最内）は円の中心
  if (!(Number(ring.innerRadius) > 0)) {
    return '<text class="ring-label ring-label-center" x="' + cx + '" y="' + cy + '" text-anchor="middle" dominant-baseline="middle">' +
      escapeHtml(ring.label) + "</text>";
  }
  // ユースケースなどは帯の内側寄り（上側）
  const band = Math.max(0, Number(ring.radius) - Number(ring.innerRadius));
  const labelR = Number(ring.innerRadius) + band * 0.28;
  return '<text class="ring-label" x="' + cx + '" y="' + (cy - labelR) + '" text-anchor="middle">' +
    escapeHtml(ring.label) + "</text>";
}

function paint() {
  if (!layout) return;
  const neighbors = new Set();
  if (selectedKind === "node" && selectedId) {
    neighbors.add(selectedId);
    for (const edge of layout.edges) {
      if (edge.from === selectedId || edge.to === selectedId) {
        neighbors.add(edge.from);
        neighbors.add(edge.to);
      }
    }
  } else if (selectedKind === "edge" && selectedId) {
    const edge = layout.edges.find((item) => item.id === selectedId);
    if (edge) {
      neighbors.add(edge.from);
      neighbors.add(edge.to);
    }
  } else if (selectedKind === "layer" && selectedId) {
    for (const node of layout.nodes) {
      if ((node.contextId + ":" + node.layerId) === selectedId) neighbors.add(node.id);
    }
  } else if (selectedKind === "sector" && selectedId) {
    for (const node of layout.nodes) {
      if ((node.contextId + ":" + node.sector) === selectedId) neighbors.add(node.id);
    }
  } else if (selectedKind === "context" && selectedId) {
    for (const node of layout.nodes) {
      if (node.contextId === selectedId) neighbors.add(node.id);
    }
  }
  const hasSelection = Boolean(selectedKind && selectedId);

  const contextMarkup = (layout.contexts || []).map((context) => {
    const ctxId = "context-" + svgSafeId(context.id);
    const ctxHot = selectedKind === "context" && selectedId === context.id ? " hot" : "";
    const contextRings = (layout.rings || []).filter((ring) => ring.contextId === context.id);
    const outerLayerId = contextRings[contextRings.length - 1]?.layerId || "";
    const rings = [...contextRings]
      .reverse()
      .map((ring) => {
        const key = context.id + ":" + ring.layerId;
        const hot = selectedKind === "layer" && selectedId === key ? " hot" : "";
        const id = "layer-" + svgSafeId(key);
        return "<g" + attrs({
          id,
          class: "arch-layer" + hot,
          "data-kind": "layer",
          "data-id": key,
          "data-layer-id": ring.layerId,
          "data-context-id": context.id,
          "data-label": ring.label,
        }) + "><title>" + escapeHtml(ring.label + " / " + context.label) + "</title>" +
          '<circle cx="' + context.center.x + '" cy="' + context.center.y + '" r="' + ring.radius + '" fill="' + ring.fill + '" stroke="#64748b" stroke-width="2.2"></circle>' +
          ringLabelMarkup(context, ring, outerLayerId) + "</g>";
      }).join("");
    const sectors = (layout.sectors || [])
      .filter((sector) => sector.contextId === context.id)
      .map((sector) => {
        const key = context.id + ":" + sector.id;
        const hot = selectedKind === "sector" && selectedId === key ? " hot" : "";
        const id = "sector-" + svgSafeId(key);
        const x1 = sector.cx + Math.cos(sector.from) * sector.innerRadius;
        const y1 = sector.cy + Math.sin(sector.from) * sector.innerRadius;
        const x2 = sector.cx + Math.cos(sector.from) * sector.outerRadius;
        const y2 = sector.cy + Math.sin(sector.from) * sector.outerRadius;
        return "<g" + attrs({
          id,
          class: "arch-sector" + hot,
          "data-kind": "sector",
          "data-id": key,
          "data-sector": sector.id,
          "data-context-id": context.id,
          "data-label": sector.label,
        }) + "><title>" + escapeHtml(sector.label + " / " + context.label) + "</title>" +
          '<path class="sector-fill" d="' + annularSectorPath(sector.cx, sector.cy, sector.innerRadius, sector.outerRadius, sector.from, sector.to) + '" fill="' + (sector.fill || SECTOR_FILL[sector.id] || "#e5e7eb") + '"></path>' +
          '<line class="sector-line" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"></line>' +
          '<text class="sector-label" x="' + sector.labelX + '" y="' + sector.labelY + '" text-anchor="middle">' + escapeHtml(sector.label) + "</text></g>";
      }).join("");
    const contextEdges = (layout.edges || [])
      .filter((edge) => edge.scope === "context" && (edge.from.startsWith(context.id + ":") || edge.to.startsWith(context.id + ":")))
      .map((edge) => edgeMarkup(edge, hasSelection, neighbors))
      .join("");
    const contextNodes = (layout.nodes || [])
      .filter((node) => node.contextId === context.id)
      .map((node) => {
        const selected = node.id === selectedId && selectedKind === "node"
          ? " selected"
          : neighbors.has(node.id) ? " neighbor" : "";
        return nodeMarkup(node, false, selected);
      }).join("");
    return "<g" + attrs({
      id: ctxId,
      class: "arch-context" + ctxHot,
      "data-kind": "context",
      "data-id": context.id,
      "data-label": context.label,
    }) + "><title>" + escapeHtml(context.label) + "</title>" +
      rings + sectors +
      '<text class="context-label" x="' + context.center.x + '" y="' + (context.center.y - context.outerRadius - 16) + '" text-anchor="middle">' + escapeHtml(context.label) + "</text>" +
      contextEdges + contextNodes +
      "</g>";
  }).join("");

  const linkEdges = (layout.edges || [])
    .filter((edge) => edge.scope !== "context")
    .map((edge) => edgeMarkup(edge, hasSelection, neighbors))
    .join("");
  const busNodes = (layout.nodes || [])
    .filter((node) => !node.contextId)
    .map((node) => {
      const selected = node.id === selectedId && selectedKind === "node" ? " selected" : neighbors.has(node.id) ? " neighbor" : "";
      return nodeMarkup(node, false, selected);
    }).join("");

  const width = layout.width || layout.size;
  const height = layout.height || layout.size;
  graphEl.innerHTML = '<svg id="architecture-diagram" data-kind="diagram" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">' +
    "<defs>" + architecturePatternDefs() +
    '<marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#334155"></path></marker>' +
    '<marker id="arrow-hot" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#e67e22"></path></marker></defs>' +
    contextMarkup + linkEdges + busNodes + "</svg>";


}
function edgeMarkup(edge, hasSelection, neighbors) {
  const hot = (selectedKind === "edge" && selectedId === edge.id)
    || (selectedKind === "node" && (edge.from === selectedId || edge.to === selectedId))
    || (hasSelection && neighbors.has(edge.from) && neighbors.has(edge.to) && selectedKind !== "edge" && selectedKind !== "node");
  const broken = brokenEdgePaths(edge, edge.label || "");
  const flow = FLOW_KINDS.has(edge.kind) ? " flow" : "";
  const pathCls = "edge " + edge.kind + flow + (hot ? " hot" : "");
  const tip = hot ? "url(#arrow-hot)" : "url(#arrow)";
  const paths = broken.paths.map((d, index) => {
    const marker = index === broken.paths.length - 1 ? ' marker-end="' + tip + '"' : ' marker-end="none"';
    return '<path class="' + pathCls + '" d="' + d + '"' + marker + "></path>";
  }).join("");
  const label = broken.label
    ? '<text class="edge-label' + (hot ? " hot" : "") + '" x="' + broken.mx + '" y="' + (broken.my + 4) + '" text-anchor="middle">' + escapeHtml(broken.label) + "</text>"
    : "";
  return "<g" + attrs({
    id: "edge-" + svgSafeId(edge.id),
    class: "arch-edge" + (hot ? " hot" : ""),
    "data-kind": "edge",
    "data-id": edge.id,
    "data-from": edge.from,
    "data-to": edge.to,
    "data-relation": edge.kind,
    "data-label": edge.label || edge.kind,
  }) + "><title>" + escapeHtml((edge.label || edge.kind) + ": " + edge.from + " → " + edge.to) + "</title>" +
    paths + label + "</g>";
}

function showSelectionDetail() {
  if (!layout || !selectedKind || !selectedId) {
    detailEl.hidden = true;
    return;
  }
  if (selectedKind === "node") {
    const node = layout.nodes.find((item) => item.id === selectedId);
    if (!node) {
      detailEl.hidden = true;
      return;
    }
    const related = layout.edges.filter((edge) => edge.from === selectedId || edge.to === selectedId);
    detailEl.hidden = false;
    detailEl.innerHTML = "<h2>" + escapeHtml(node.label) + "</h2>" +
      "<p>kind: component</p>" +
      "<p>id: " + escapeHtml(node.id) + "</p>" +
      (node.contextLabel ? "<p>context: " + escapeHtml(node.contextLabel) + "</p>" : "") +
      (node.layerId ? "<p>layer: " + escapeHtml(node.layerId) + "</p>" : "") +
      "<p>componentKind: " + escapeHtml(node.kind) + "</p>" +
      (node.socket ? "<p>socket: " + escapeHtml(node.socket) + "</p>" : "") +
      (node.sector ? "<p>sector: " + escapeHtml(node.sector) + "</p>" : "") +
      "<ul>" + related.map((edge) => "<li>" + escapeHtml(edge.kind) + ": " + escapeHtml(edge.from) + " → " + escapeHtml(edge.to) + "</li>").join("") + "</ul>";
    return;
  }
  if (selectedKind === "layer") {
    const ring = (layout.rings || []).find((item) => item.contextId + ":" + item.layerId === selectedId);
    const context = (layout.contexts || []).find((item) => item.id === (ring && ring.contextId));
    const members = layout.nodes.filter((node) => node.contextId + ":" + node.layerId === selectedId);
    detailEl.hidden = false;
    detailEl.innerHTML = "<h2>" + escapeHtml((ring && ring.label) || selectedId) + "</h2>" +
      "<p>kind: layer</p>" +
      "<p>id: " + escapeHtml(selectedId) + "</p>" +
      (context ? "<p>context: " + escapeHtml(context.label) + "</p>" : "") +
      "<ul>" + members.map((node) => "<li>" + escapeHtml(node.label) + " (" + escapeHtml(node.id) + ")</li>").join("") + "</ul>";
    return;
  }
  if (selectedKind === "sector") {
    const sector = (layout.sectors || []).find((item) => item.contextId + ":" + item.id === selectedId);
    const members = layout.nodes.filter((node) => node.contextId + ":" + node.sector === selectedId);
    detailEl.hidden = false;
    detailEl.innerHTML = "<h2>" + escapeHtml((sector && sector.label) || selectedId) + "</h2>" +
      "<p>kind: sector</p>" +
      "<p>id: " + escapeHtml(selectedId) + "</p>" +
      "<ul>" + members.map((node) => "<li>" + escapeHtml(node.label) + " (" + escapeHtml(node.id) + ")</li>").join("") + "</ul>";
    return;
  }
  if (selectedKind === "edge") {
    const edge = layout.edges.find((item) => item.id === selectedId);
    if (!edge) {
      detailEl.hidden = true;
      return;
    }
    detailEl.hidden = false;
    detailEl.innerHTML = "<h2>" + escapeHtml(edge.label || edge.kind) + "</h2>" +
      "<p>kind: edge</p>" +
      "<p>id: " + escapeHtml(edge.id) + "</p>" +
      "<p>relation: " + escapeHtml(edge.kind) + "</p>" +
      "<p>from: " + escapeHtml(edge.from) + "</p>" +
      "<p>to: " + escapeHtml(edge.to) + "</p>";
    return;
  }
  if (selectedKind === "context") {
    const context = (layout.contexts || []).find((item) => item.id === selectedId);
    const members = layout.nodes.filter((node) => node.contextId === selectedId);
    detailEl.hidden = false;
    detailEl.innerHTML = "<h2>" + escapeHtml((context && context.label) || selectedId) + "</h2>" +
      "<p>kind: context</p>" +
      "<p>id: " + escapeHtml(selectedId) + "</p>" +
      "<ul>" + members.map((node) => "<li>" + escapeHtml(node.label) + " (" + escapeHtml(node.id) + ")</li>").join("") + "</ul>";
  }
}

  },
  handleEvent({ type, event, state, graph }) {
    if (type !== 'click') return false;
    const target = (graph.ownerDocument.elementFromPoint?.(event.clientX, event.clientY) || event.target).closest('[data-kind]');
    const kind = target && graph.contains(target) ? target.getAttribute('data-kind') : '';
    state.kind = kind === 'component' ? 'node' : kind === 'diagram' ? '' : kind;
    state.id = state.kind ? target.getAttribute('data-id') || '' : '';
    return true;
  },
};
