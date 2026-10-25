// Adapted from kani1048/agent-harness, pilot/onion-preview, src/onion-preview/domain.mjs.
const RELATION_KINDS = new Set([
  "depends-on",
  "uses-port",
  "implements-port",
  "runtime-call",
  "violation",
  "request",
  "publish",
  "subscribe",
]);
/** 処理・通信の向き（from → to）へ破線を流す関係 */
export const FLOW_KINDS = new Set([
  "depends-on",
  "uses-port",
  "runtime-call",
  "request",
  "publish",
  "subscribe",
]);
const SOCKETS = new Set(["", "api", "spi"]);
// 内→外: 控えめな白黒パターン（SVG defs の id を参照）
export const LAYER_FILL = [
  "url(#pattern-domain)",
  "url(#pattern-usecase)",
  "url(#pattern-outer)",
];
const SECTOR_IDS = new Set(["presentation", "infrastructure", "test"]);
export const SECTOR_FILL = {
  presentation: "url(#pattern-sector-presentation)",
  infrastructure: "url(#pattern-sector-infrastructure)",
  test: "url(#pattern-sector-test)",
};

/** 層・扇形の塗り用パターン（白黒・控えめ） */
export function architecturePatternDefs() {
  return [
    '<pattern id="pattern-domain" patternUnits="userSpaceOnUse" width="5" height="5">',
    '<rect width="5" height="5" fill="#f3f4f0"/>',
    '<circle cx="1.2" cy="1.2" r="0.95" fill="#212322" fill-opacity="0.38"/>',
    "</pattern>",
    '<pattern id="pattern-usecase" patternUnits="userSpaceOnUse" width="8" height="8">',
    '<rect width="8" height="8" fill="#fafafa"/>',
    '<circle cx="2" cy="2" r="0.9" fill="#212322" fill-opacity="0.22"/>',
    "</pattern>",
    '<pattern id="pattern-outer" patternUnits="userSpaceOnUse" width="12" height="12">',
    '<rect width="12" height="12" fill="#ffffff"/>',
    '<circle cx="1" cy="1" r="0.7" fill="#212322" fill-opacity="0.12"/>',
    "</pattern>",
    '<pattern id="pattern-sector-presentation" patternUnits="userSpaceOnUse" width="6" height="6">',
    '<rect width="6" height="6" fill="#fff" fill-opacity="0.35"/>',
    '<path d="M0 3 H6" stroke="#212322" stroke-opacity="0.2" stroke-width="0.8"/>',
    "</pattern>",
    '<pattern id="pattern-sector-infrastructure" patternUnits="userSpaceOnUse" width="6" height="6">',
    '<rect width="6" height="6" fill="#fff" fill-opacity="0.35"/>',
    '<path d="M3 0 V6" stroke="#212322" stroke-opacity="0.22" stroke-width="0.9"/>',
    "</pattern>",
    '<pattern id="pattern-sector-test" patternUnits="userSpaceOnUse" width="6" height="6">',
    '<rect width="6" height="6" fill="#fff" fill-opacity="0.35"/>',
    '<path d="M0 0 L6 6" stroke="#212322" stroke-opacity="0.2" stroke-width="0.8"/>',
    "</pattern>",
  ].join("");
}
// 上=プレゼンテーション、右下=インフラ、左=テスト（上から反時計回りに3等分）
export const OUTER_SECTORS = [
  { id: "presentation", label: "プレゼンテーション層", from: (-5 * Math.PI) / 6, to: -Math.PI / 6 },
  { id: "infrastructure", label: "インフラ層", from: -Math.PI / 6, to: Math.PI / 2 },
  { id: "test", label: "テスト", from: Math.PI / 2, to: (7 * Math.PI) / 6 },
];

export function annularSectorPath(cx, cy, innerR, outerR, from, to) {
  const r0 = Math.max(0, Number(innerR) || 0);
  const r1 = Math.max(r0, Number(outerR) || 0);
  const a0 = Number(from) || 0;
  const a1 = Number(to) || 0;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const x0 = cx + Math.cos(a0) * r1;
  const y0 = cy + Math.sin(a0) * r1;
  const x1 = cx + Math.cos(a1) * r1;
  const y1 = cy + Math.sin(a1) * r1;
  const x2 = cx + Math.cos(a1) * r0;
  const y2 = cy + Math.sin(a1) * r0;
  const x3 = cx + Math.cos(a0) * r0;
  const y3 = cy + Math.sin(a0) * r0;
  return `M${x0},${y0} A${r1},${r1} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${large} 0 ${x3},${y3} Z`;
}

export function brokenEdgePaths(edge, label) {
  const x1 = Number(edge.x1) || 0;
  const y1 = Number(edge.y1) || 0;
  const x2 = Number(edge.x2) || 0;
  const y2 = Number(edge.y2) || 0;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const text = String(label || "").trim();
  if (!text) {
    return {
      paths: [`M${x1},${y1} L${x2},${y2}`],
      label: "",
      mx: (x1 + x2) / 2,
      my: (y1 + y2) / 2,
    };
  }
  const gap = Math.min(len * 0.42, Math.max(40, text.length * 7 + 28));
  const ux = dx / len;
  const uy = dy / len;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const ax = mx - (ux * gap) / 2;
  const ay = my - (uy * gap) / 2;
  const bx = mx + (ux * gap) / 2;
  const by = my + (uy * gap) / 2;
  return {
    paths: [`M${x1},${y1} L${ax},${ay}`, `M${bx},${by} L${x2},${y2}`],
    label: text,
    mx,
    my,
  };
}

export function escapeHtml(raw) {
  return String(raw ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** ブラウザ／AI が要素を指せるよう、安定した SVG id にする */
export function svgSafeId(raw) {
  const value = String(raw || "")
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return value || "item";
}

export function sampleArchitectureModel() {
  return {
    schemaVersion: "0.1",
    layers: [
      { id: "domain", label: "Domain", order: 0 },
      { id: "application", label: "Application", order: 1 },
      { id: "adapters", label: "Adapters", order: 2 },
    ],
    components: [
      { id: "user", label: "User", layerId: "domain", kind: "entity", groupId: "user" },
      { id: "create-user", label: "CreateUser", layerId: "application", kind: "usecase", groupId: "user" },
      {
        id: "user-repository-port",
        label: "UserRepository",
        layerId: "application",
        kind: "port",
        socket: "spi",
        groupId: "user",
      },
      {
        id: "user-api",
        label: "User API",
        layerId: "application",
        kind: "port",
        socket: "api",
        groupId: "user",
      },
      { id: "sql-user-repository", label: "SqlUserRepository", layerId: "adapters", kind: "adapter", groupId: "user" },
      { id: "rest-controller", label: "REST", layerId: "adapters", kind: "adapter", groupId: "user" },
    ],
    relations: [
      { from: "rest-controller", to: "user-api", kind: "depends-on", source: "declared" },
      { from: "user-api", to: "create-user", kind: "uses-port", source: "declared" },
      { from: "create-user", to: "user", kind: "depends-on", source: "declared" },
      { from: "create-user", to: "user-repository-port", kind: "uses-port", source: "declared" },
      { from: "sql-user-repository", to: "user-repository-port", kind: "implements-port", source: "declared" },
    ],
  };
}

export function sampleContextsModel() {
  return {
    schemaVersion: "0.2",
    contexts: [
      {
        id: "sales",
        label: "販売コンテキスト",
        layers: [
          { id: "domain", label: "ドメイン層", order: 0 },
          { id: "usecase", label: "ユースケース層", order: 1 },
          { id: "outer", label: "外側", order: 2 },
        ],
        components: [
          { id: "order", label: "Order", layerId: "domain", kind: "entity" },
          { id: "place-order", label: "PlaceOrder", layerId: "usecase", kind: "usecase" },
          { id: "sales-ui", label: "UI", layerId: "outer", kind: "presentation", sector: "presentation" },
          { id: "shipping-adapter", label: "Adapter", layerId: "outer", kind: "adapter", sector: "infrastructure" },
          { id: "event-adapter", label: "Adapter", layerId: "outer", kind: "adapter", sector: "infrastructure" },
          { id: "sales-test", label: "Test", layerId: "outer", kind: "test", sector: "test" },
        ],
        relations: [
          { from: "place-order", to: "order", kind: "depends-on" },
          { from: "sales-ui", to: "place-order", kind: "depends-on" },
          { from: "shipping-adapter", to: "place-order", kind: "depends-on" },
          { from: "event-adapter", to: "place-order", kind: "depends-on" },
          { from: "sales-test", to: "place-order", kind: "depends-on" },
        ],
      },
      {
        id: "delivery",
        label: "配送コンテキスト",
        layers: [
          { id: "domain", label: "ドメイン層", order: 0 },
          { id: "usecase", label: "ユースケース層", order: 1 },
          { id: "outer", label: "外側", order: 2 },
        ],
        components: [
          { id: "shipment", label: "Shipment", layerId: "domain", kind: "entity" },
          { id: "arrange-shipping", label: "ArrangeShipping", layerId: "usecase", kind: "usecase" },
          { id: "shipping-api", label: "API", layerId: "outer", kind: "port", socket: "api", sector: "presentation" },
          { id: "shipping-worker", label: "Worker", layerId: "outer", kind: "adapter", sector: "infrastructure" },
          { id: "delivery-test", label: "Test", layerId: "outer", kind: "test", sector: "test" },
        ],
        relations: [
          { from: "arrange-shipping", to: "shipment", kind: "depends-on" },
          { from: "shipping-api", to: "arrange-shipping", kind: "uses-port" },
          { from: "shipping-worker", to: "arrange-shipping", kind: "depends-on" },
          { from: "delivery-test", to: "arrange-shipping", kind: "depends-on" },
        ],
      },
    ],
    buses: [{ id: "order-message", label: "Message" }],
    links: [
      { from: "sales:shipping-adapter", to: "delivery:shipping-api", kind: "request", label: "Request" },
      { from: "sales:event-adapter", to: "bus:order-message", kind: "publish", label: "publish" },
      { from: "delivery:shipping-worker", to: "bus:order-message", kind: "subscribe", label: "subscribe" },
    ],
  };
}

function normalizeSocket(kind, socketRaw) {
  const socket = String(socketRaw || "").trim().toLowerCase();
  if (!SOCKETS.has(socket)) throw new Error(`socket が不正です: ${socketRaw}`);
  if (kind === "port" && !socket) return "spi";
  return socket;
}

export function inferSector(component) {
  const kind = String(component?.kind || "").toLowerCase();
  const socket = String(component?.socket || "").toLowerCase();
  if (["presentation", "ui", "controller", "rest"].includes(kind) || socket === "api") return "presentation";
  if (kind === "test") return "test";
  return "infrastructure";
}

export function normalizeSector(component) {
  const raw = String(component?.sector || "").trim().toLowerCase();
  if (SECTOR_IDS.has(raw)) return raw;
  if (raw) throw new Error(`sector が不正です: ${component.sector}`);
  return inferSector(component);
}

export function angleInSector(sector, index, count) {
  const span = sector.to - sector.from;
  if (!count || count <= 1) return sector.from + span / 2;
  return sector.from + (span * (index + 0.5)) / count;
}

export function contextIdFromEndpoint(ref) {
  const value = String(ref || "");
  if (!value || value.startsWith("bus:")) return "";
  const split = value.indexOf(":");
  if (split < 1) return "";
  return value.slice(0, split);
}

export function chooseHubContextIndex(contextIds, links, preferredId = "") {
  const ids = Array.isArray(contextIds) ? contextIds : [];
  if (!ids.length) return 0;
  const preferred = String(preferredId || "").trim();
  if (preferred) {
    const index = ids.indexOf(preferred);
    if (index >= 0) return index;
  }
  const degree = ids.map(() => 0);
  for (const link of links || []) {
    for (const ref of [link.from, link.to]) {
      const contextId = contextIdFromEndpoint(ref);
      const index = ids.indexOf(contextId);
      if (index >= 0) degree[index] += 1;
    }
  }
  let best = 0;
  for (let index = 1; index < degree.length; index += 1) {
    if (degree[index] > degree[best]) best = index;
  }
  return best;
}

export function ringRadiusForHub(hubRadius, satelliteRadii, margin) {
  const hubR = Number(hubRadius) || 0;
  const gap = Number(margin) > 0 ? Number(margin) : 240;
  const sats = Array.isArray(satelliteRadii) && satelliteRadii.length
    ? satelliteRadii.map((value) => Number(value) || 0)
    : [0];
  const maxSat = Math.max(...sats);
  let ring = hubR + maxSat + gap;
  if (sats.length >= 2) {
    const sin = Math.sin(Math.PI / sats.length);
    if (sin > 1e-9) ring = Math.max(ring, (2 * maxSat + gap) / (2 * sin));
  }
  return ring;
}

/** コンテキスト中心の配置。2つ以下は横並び、3つ以上は中央ハブ＋多角形（既定）。 */
export function placeContextCenters(radii, options = {}) {
  const margin = Number(options.contextMargin) > 0 ? Number(options.contextMargin) : 240;
  const startY = Number(options.startY) > 0 ? Number(options.startY) : 320;
  const list = Array.isArray(radii) ? radii.map((value) => Number(value) || 0) : [];
  const mode = options.mode || (list.length >= 3 ? "hub" : "row");
  if (mode !== "hub" || list.length < 2) {
    const centers = [];
    for (let index = 0; index < list.length; index += 1) {
      if (index === 0) {
        centers.push({ x: list[index], y: startY });
        continue;
      }
      const x = centers[index - 1].x + list[index - 1] + list[index] + margin;
      centers.push({ x, y: startY });
    }
    return centers;
  }

  const hubIndex = Number.isInteger(options.hubIndex) && options.hubIndex >= 0 && options.hubIndex < list.length
    ? options.hubIndex
    : 0;
  const ringOrder = Array.isArray(options.ringOrder) && options.ringOrder.length
    ? options.ringOrder.filter((index) => index !== hubIndex && index >= 0 && index < list.length)
    : list.map((_, index) => index).filter((index) => index !== hubIndex);
  const ringR = ringRadiusForHub(
    list[hubIndex],
    ringOrder.map((index) => list[index]),
    margin,
  );
  const centers = list.map(() => ({ x: 0, y: 0 }));
  centers[hubIndex] = { x: 0, y: 0 };
  const count = ringOrder.length || 1;
  for (let slot = 0; slot < ringOrder.length; slot += 1) {
    const angle = -Math.PI / 2 + (Math.PI * 2 * slot) / count;
    centers[ringOrder[slot]] = {
      x: Math.cos(angle) * ringR,
      y: Math.sin(angle) * ringR,
    };
  }
  return centers;
}

/** 外周の並びを入れ替え、コンテキスト間の線交差が少ない順を選ぶ（完全最小は目指さない）。 */
export function bestRingOrderForCrossings(hubIndex, ringIndices, contextIds, links) {
  const list = Array.isArray(ringIndices) ? [...ringIndices] : [];
  if (list.length <= 1) return list;
  const pairs = [];
  for (const link of links || []) {
    const fromId = contextIdFromEndpoint(link.from);
    const toId = contextIdFromEndpoint(link.to);
    if (!fromId || !toId || fromId === toId) continue;
    const from = contextIds.indexOf(fromId);
    const to = contextIds.indexOf(toId);
    if (from < 0 || to < 0) continue;
    pairs.push([from, to]);
  }
  const scoreOrder = (order) => {
    const pos = new Map([[hubIndex, { x: 0, y: 0 }]]);
    const count = order.length || 1;
    for (let slot = 0; slot < order.length; slot += 1) {
      const angle = -Math.PI / 2 + (Math.PI * 2 * slot) / count;
      pos.set(order[slot], { x: Math.cos(angle), y: Math.sin(angle) });
    }
    const edges = pairs.map(([from, to]) => {
      const a = pos.get(from);
      const b = pos.get(to);
      return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
    });
    return countEdgeCrossings(edges);
  };
  if (list.length > 7) return list;
  let best = list;
  let bestScore = Infinity;
  const head = list[0];
  for (const tail of permutations(list.slice(1))) {
    for (const order of [[head, ...tail], [head, ...[...tail].reverse()]]) {
      const score = scoreOrder(order);
      if (score < bestScore) {
        bestScore = score;
        best = order;
        if (bestScore === 0) return best;
      }
    }
  }
  return best;
}

function orient(ax, ay, bx, by, cx, cy) {
  const value = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  if (Math.abs(value) < 1e-9) return 0;
  return value > 0 ? 1 : -1;
}

function onSegment(ax, ay, bx, by, cx, cy) {
  return (
    Math.min(ax, bx) - 1e-9 <= cx &&
    cx <= Math.max(ax, bx) + 1e-9 &&
    Math.min(ay, by) - 1e-9 <= cy &&
    cy <= Math.max(ay, by) + 1e-9
  );
}

export function segmentsCross(a, b) {
  const o1 = orient(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1);
  const o2 = orient(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2);
  const o3 = orient(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1);
  const o4 = orient(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2);
  if (o1 !== o2 && o3 !== o4) {
    // 端点共有は交差しとみなさない
    const share =
      (a.x1 === b.x1 && a.y1 === b.y1) ||
      (a.x1 === b.x2 && a.y1 === b.y2) ||
      (a.x2 === b.x1 && a.y2 === b.y1) ||
      (a.x2 === b.x2 && a.y2 === b.y2);
    return !share;
  }
  if (o1 === 0 && onSegment(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1)) return false;
  if (o2 === 0 && onSegment(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2)) return false;
  if (o3 === 0 && onSegment(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1)) return false;
  if (o4 === 0 && onSegment(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2)) return false;
  return false;
}

export function countEdgeCrossings(edges) {
  const list = Array.isArray(edges) ? edges : [];
  let count = 0;
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      if (segmentsCross(list[i], list[j])) count += 1;
    }
  }
  return count;
}

export function rotatePoint(point, center, delta) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const cos = Math.cos(delta);
  const sin = Math.sin(delta);
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function syncEdgeEndpoints(edges, nodeById) {
  for (const edge of edges || []) {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    if (!from || !to) continue;
    edge.x1 = from.x;
    edge.y1 = from.y;
    edge.x2 = to.x;
    edge.y2 = to.y;
  }
}

function syncSectorLabels(layout) {
  const center = layout.center;
  for (const sector of layout.sectors || []) {
    const mid = (sector.from + sector.to) / 2;
    const labelR = (sector.innerRadius + sector.outerRadius) / 2;
    sector.cx = center.x;
    sector.cy = center.y;
    sector.labelX = center.x + Math.cos(mid) * labelR;
    sector.labelY = center.y + Math.sin(mid) * labelR;
  }
}

export function rotateContextLayout(layout, delta) {
  if (!layout || !delta) return layout;
  const center = layout.center;
  for (const node of layout.nodes || []) {
    const next = rotatePoint(node, center, delta);
    node.x = next.x;
    node.y = next.y;
    node.angle = (Number(node.angle) || 0) + delta;
  }
  for (const sector of layout.sectors || []) {
    sector.from += delta;
    sector.to += delta;
  }
  syncSectorLabels(layout);
  const nodeById = new Map((layout.nodes || []).map((node) => [node.id, node]));
  syncEdgeEndpoints(layout.edges, nodeById);
  return layout;
}

/** 左右反転（扇形の並びを鏡映）。回転と組み合わせて交差を減らす。 */
export function flipContextLayout(layout) {
  if (!layout) return layout;
  const center = layout.center;
  for (const node of layout.nodes || []) {
    node.x = 2 * center.x - node.x;
    node.angle = Math.atan2(node.y - center.y, node.x - center.x);
  }
  for (const sector of layout.sectors || []) {
    // 向きが反転するので、描画用の from→to（反時計）は端点を入れ替える
    const from = Math.PI - sector.to;
    const to = Math.PI - sector.from;
    sector.from = from;
    sector.to = to;
  }
  syncSectorLabels(layout);
  const nodeById = new Map((layout.nodes || []).map((node) => [node.id, node]));
  syncEdgeEndpoints(layout.edges, nodeById);
  return layout;
}

export function orderByNeighborMean(items, relations, angleByLocalId) {
  const list = Array.isArray(items) ? [...items] : [];
  if (list.length <= 1) return list;
  const score = new Map();
  for (const item of list) {
    const angles = [];
    for (const relation of relations || []) {
      if (relation.from === item.id && angleByLocalId.has(relation.to)) angles.push(angleByLocalId.get(relation.to));
      if (relation.to === item.id && angleByLocalId.has(relation.from)) angles.push(angleByLocalId.get(relation.from));
    }
    const own = angleByLocalId.has(item.id) ? angleByLocalId.get(item.id) : 0;
    score.set(item.id, angles.length ? angles.reduce((sum, value) => sum + value, 0) / angles.length : own);
  }
  return list.sort((a, b) => score.get(a.id) - score.get(b.id) || a.id.localeCompare(b.id));
}

function permutations(list) {
  if (list.length <= 1) return [list];
  const out = [];
  for (let index = 0; index < list.length; index += 1) {
    const head = list[index];
    const rest = list.filter((_, i) => i !== index);
    for (const perm of permutations(rest)) out.push([head, ...perm]);
  }
  return out;
}

export function bestOrderForCrossings(items, placeOrdered, relations) {
  const list = Array.isArray(items) ? items : [];
  if (list.length <= 1) return list;
  if (list.length > 5) {
    const draft = placeOrdered(list);
    const angleByLocalId = new Map(draft.map((node) => [node.localId, node.angle]));
    return orderByNeighborMean(list, relations, angleByLocalId);
  }
  let best = list;
  let bestScore = Infinity;
  for (const order of permutations(list)) {
    const nodes = placeOrdered(order);
    const nodeByLocal = new Map(nodes.map((node) => [node.localId, node]));
    const edges = (relations || [])
      .map((relation) => {
        const from = nodeByLocal.get(relation.from);
        const to = nodeByLocal.get(relation.to);
        if (!from || !to) return null;
        return { x1: from.x, y1: from.y, x2: to.x, y2: to.y, from: from.id, to: to.id };
      })
      .filter(Boolean);
    const score = countEdgeCrossings(edges);
    if (score < bestScore) {
      bestScore = score;
      best = order;
      if (bestScore === 0) break;
    }
  }
  return best;
}

export function reduceCrossingsByRotation(contextLayouts, allEdges, options = {}) {
  const steps = Number(options.steps) > 0 ? Number(options.steps) : 12;
  const nodeById = options.nodeById || new Map();
  for (const layout of contextLayouts || []) {
    for (const node of layout.nodes || []) nodeById.set(node.id, node);
  }
  syncEdgeEndpoints(allEdges, nodeById);
  let bestTotal = countEdgeCrossings(allEdges);
  for (const layout of contextLayouts || []) {
    let bestDelta = 0;
    let bestFlipped = false;
    let bestScore = bestTotal;
    for (const flipped of [false, true]) {
      if (flipped) flipContextLayout(layout);
      for (let step = 0; step < steps; step += 1) {
        const delta = (Math.PI * 2 * step) / steps;
        rotateContextLayout(layout, delta);
        syncEdgeEndpoints(allEdges, nodeById);
        const score = countEdgeCrossings(allEdges);
        rotateContextLayout(layout, -delta);
        syncEdgeEndpoints(allEdges, nodeById);
        if (score < bestScore) {
          bestScore = score;
          bestDelta = delta;
          bestFlipped = flipped;
        }
      }
      if (flipped) flipContextLayout(layout);
    }
    if (bestFlipped) flipContextLayout(layout);
    if (bestDelta) rotateContextLayout(layout, bestDelta);
    if (bestFlipped || bestDelta) {
      syncEdgeEndpoints(allEdges, nodeById);
      bestTotal = bestScore;
    }
  }
  return bestTotal;
}

function validateContext(raw, path) {
  if (!raw || typeof raw !== "object") throw new Error(`${path} が不正です`);
  const id = String(raw.id || "").trim();
  if (!id) throw new Error(`${path}.id が必要です`);
  const layers = Array.isArray(raw.layers) ? raw.layers : null;
  if (!layers || !layers.length) throw new Error(`${path}.layers が必要です`);
  const layerIds = new Set();
  const normalizedLayers = layers.map((layer, index) => {
    if (!layer || typeof layer !== "object") throw new Error(`${path}.layers[${index}] が不正です`);
    const layerId = String(layer.id || "").trim();
    if (!layerId) throw new Error(`${path}.layers[${index}].id が必要です`);
    if (layerIds.has(layerId)) throw new Error(`layer id が重複しています: ${layerId}`);
    layerIds.add(layerId);
    const order = Number(layer.order);
    if (!Number.isInteger(order) || order < 0) throw new Error(`${path}.layers[${index}].order が不正です`);
    return { id: layerId, label: String(layer.label || layerId), order };
  });
  normalizedLayers.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  const components = Array.isArray(raw.components) ? raw.components : null;
  if (!components) throw new Error(`${path}.components が必要です`);
  const componentIds = new Set();
  const normalizedComponents = components.map((component, index) => {
    if (!component || typeof component !== "object") throw new Error(`${path}.components[${index}] が不正です`);
    const componentId = String(component.id || "").trim();
    if (!componentId) throw new Error(`${path}.components[${index}].id が必要です`);
    if (componentIds.has(componentId)) throw new Error(`component id が重複しています: ${componentId}`);
    componentIds.add(componentId);
    const layerId = String(component.layerId || "").trim();
    if (!layerIds.has(layerId)) throw new Error(`未定義の layerId です: ${layerId}`);
    const kind = String(component.kind || "component");
    const socket = normalizeSocket(kind, component.socket);
    return {
      id: componentId,
      label: String(component.label || componentId),
      layerId,
      kind,
      socket,
      sector: normalizeSector({ ...component, kind, socket }),
      groupId: component.groupId ? String(component.groupId) : "",
    };
  });

  const relations = Array.isArray(raw.relations) ? raw.relations : [];
  const normalizedRelations = relations.map((relation, index) => {
    if (!relation || typeof relation !== "object") throw new Error(`${path}.relations[${index}] が不正です`);
    const from = String(relation.from || "").trim();
    const to = String(relation.to || "").trim();
    const kind = String(relation.kind || "").trim();
    if (!from || !to) throw new Error(`${path}.relations[${index}] に from / to が必要です`);
    if (!componentIds.has(from)) throw new Error(`${path}.relations[${index}].from が未定義です: ${from}`);
    if (!componentIds.has(to)) throw new Error(`${path}.relations[${index}].to が未定義です: ${to}`);
    if (!RELATION_KINDS.has(kind)) throw new Error(`${path}.relations[${index}].kind が不正です: ${kind}`);
    return { from, to, kind, source: String(relation.source || "declared"), label: String(relation.label || "") };
  });

  return {
    id,
    label: String(raw.label || id),
    layers: normalizedLayers,
    components: normalizedComponents,
    relations: normalizedRelations,
  };
}

export function parseArchitectureModel(raw) {
  let data;
  try {
    data = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new Error("JSON として読めません");
  }
  return validateArchitectureModel(data);
}

export function validateArchitectureModel(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Architecture Model はオブジェクトである必要があります");
  }
  const schemaVersion = String(data.schemaVersion || "").trim();
  if (!schemaVersion) throw new Error("schemaVersion が必要です");

  let contexts;
  if (Array.isArray(data.contexts) && data.contexts.length) {
    const ids = new Set();
    contexts = data.contexts.map((context, index) => {
      const normalized = validateContext(context, `contexts[${index}]`);
      if (ids.has(normalized.id)) throw new Error(`context id が重複しています: ${normalized.id}`);
      ids.add(normalized.id);
      return normalized;
    });
  } else {
    contexts = [validateContext({ id: "main", label: data.label || "Architecture", ...data }, "model")];
  }

  const buses = Array.isArray(data.buses)
    ? data.buses.map((bus, index) => {
        if (!bus || typeof bus !== "object") throw new Error(`buses[${index}] が不正です`);
        const id = String(bus.id || "").trim();
        if (!id) throw new Error(`buses[${index}].id が必要です`);
        return { id, label: String(bus.label || id) };
      })
    : [];
  const busIds = new Set(buses.map((bus) => bus.id));
  const endpointOk = (ref) => {
    if (ref.startsWith("bus:")) return busIds.has(ref.slice(4));
    const split = ref.indexOf(":");
    if (split < 1) return false;
    const contextId = ref.slice(0, split);
    const componentId = ref.slice(split + 1);
    const context = contexts.find((item) => item.id === contextId);
    return Boolean(context && context.components.some((component) => component.id === componentId));
  };

  const links = Array.isArray(data.links)
    ? data.links.map((link, index) => {
        if (!link || typeof link !== "object") throw new Error(`links[${index}] が不正です`);
        const from = String(link.from || "").trim();
        const to = String(link.to || "").trim();
        const kind = String(link.kind || "").trim();
        if (!from || !to) throw new Error(`links[${index}] に from / to が必要です`);
        if (!endpointOk(from)) throw new Error(`links[${index}].from が未定義です: ${from}`);
        if (!endpointOk(to)) throw new Error(`links[${index}].to が未定義です: ${to}`);
        if (!RELATION_KINDS.has(kind)) throw new Error(`links[${index}].kind が不正です: ${kind}`);
        return { from, to, kind, label: String(link.label || kind) };
      })
    : [];

  const hubContextId = String(data.hubContextId || "").trim();
  if (hubContextId && !contexts.some((context) => context.id === hubContextId)) {
    throw new Error(`hubContextId が未定義です: ${hubContextId}`);
  }

  const primary = contexts[0];
  return {
    schemaVersion,
    contexts,
    buses,
    links,
    hubContextId,
    layers: primary.layers,
    components: primary.components,
    relations: primary.relations,
  };
}

function layoutOneContext(context, center, ringGap) {
  const rings = context.layers.map((layer, index) => ({
    id: `${context.id}:${layer.id}`,
    layerId: layer.id,
    label: layer.label,
    order: layer.order,
    radius: (index + 1) * ringGap,
    innerRadius: index === 0 ? 0 : index * ringGap,
    fill: LAYER_FILL[Math.min(index, LAYER_FILL.length - 1)],
    contextId: context.id,
  }));
  const outerRing = rings[rings.length - 1];
  const innerRing = rings.length > 1 ? rings[rings.length - 2] : { radius: 0 };
  const outerLayerId = outerRing?.layerId || "";
  const byLayer = new Map();
  for (const component of context.components) {
    if (!byLayer.has(component.layerId)) byLayer.set(component.layerId, []);
    byLayer.get(component.layerId).push(component);
  }
  const bandRadius = (ring, preferRim) => {
    const mid = (ring.innerRadius + ring.radius) / 2;
    if (preferRim) return ring.innerRadius + (ring.radius - ring.innerRadius) * 0.82;
    return mid;
  };
  const nodes = [];
  for (const ring of rings) {
    const items = byLayer.get(ring.layerId) || [];
    items.sort((a, b) => {
      const ga = a.groupId || "";
      const gb = b.groupId || "";
      return ga.localeCompare(gb) || a.id.localeCompare(b.id);
    });
    const isOuter = ring.layerId === outerLayerId;
    if (isOuter) {
      const buckets = { presentation: [], infrastructure: [], test: [] };
      for (const component of items) {
        buckets[component.sector || "infrastructure"].push(component);
      }
      for (const sector of OUTER_SECTORS) {
        const list = buckets[sector.id];
        const placeOrdered = (order) =>
          order.map((component, index) => {
            const angle = angleInSector(sector, index, order.length);
            const isSocket = component.kind === "port" || Boolean(component.socket);
            const radius = bandRadius(ring, isSocket);
            return {
              ...component,
              id: `${context.id}:${component.id}`,
              localId: component.id,
              contextId: context.id,
              contextLabel: context.label,
              x: center.x + Math.cos(angle) * radius,
              y: center.y + Math.sin(angle) * radius,
              angle,
              radius,
              shape: isSocket ? "socket" : "card",
            };
          });
        const ordered = bestOrderForCrossings(list, placeOrdered, context.relations);
        nodes.push(...placeOrdered(ordered));
      }
      continue;
    }
    const placeOrdered = (order) =>
      order.map((component, index) => {
        const angle = (Math.PI * 2 * index) / (order.length || 1) - Math.PI / 2;
        const isSocket = component.kind === "port" || Boolean(component.socket);
        const radius = bandRadius(ring, isSocket);
        return {
          ...component,
          id: `${context.id}:${component.id}`,
          localId: component.id,
          contextId: context.id,
          contextLabel: context.label,
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius,
          angle,
          radius,
          shape: isSocket ? "socket" : "card",
        };
      });
    const ordered = bestOrderForCrossings(items, placeOrdered, context.relations);
    nodes.push(...placeOrdered(ordered));
  }
  const nodeByLocal = new Map(nodes.map((node) => [node.localId, node]));
  const edges = context.relations.map((relation, index) => {
    const from = nodeByLocal.get(relation.from);
    const to = nodeByLocal.get(relation.to);
    return {
      id: `${context.id}:e${index}`,
      ...relation,
      from: from.id,
      to: to.id,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      scope: "context",
    };
  });
  const sectors = OUTER_SECTORS.map((sector) => {
    const mid = (sector.from + sector.to) / 2;
    const labelR = (innerRing.radius + outerRing.radius) / 2;
    return {
      ...sector,
      fill: SECTOR_FILL[sector.id] || "#e5e7eb",
      contextId: context.id,
      innerRadius: innerRing.radius,
      outerRadius: outerRing.radius,
      cx: center.x,
      cy: center.y,
      labelX: center.x + Math.cos(mid) * labelR,
      labelY: center.y + Math.sin(mid) * labelR,
    };
  });
  return {
    id: context.id,
    label: context.label,
    center,
    outerRadius: outerRing?.radius || ringGap,
    rings,
    sectors,
    nodes,
    edges,
  };
}

export function layoutOnion(model, options = {}) {
  return layoutArchitecture(model, options);
}

export function layoutArchitecture(model, options = {}) {
  const validated = validateArchitectureModel(model);
  const ringGap = Number(options.ringGap) > 0 ? Number(options.ringGap) : 120;
  const startY = Number(options.startY) > 0 ? Number(options.startY) : 320;
  const contextMargin = Number(options.contextMargin) > 0 ? Number(options.contextMargin) : 240;
  const radii = validated.contexts.map((context) => Math.max(1, context.layers.length) * ringGap);
  const contextIds = validated.contexts.map((context) => context.id);
  const hubPreferred = String(options.hubContextId || validated.hubContextId || "").trim();
  const useHub = validated.contexts.length >= 3;
  const hubIndex = useHub
    ? chooseHubContextIndex(contextIds, validated.links, hubPreferred)
    : 0;
  const ringIndices = contextIds.map((_, index) => index).filter((index) => index !== hubIndex);
  const ringOrder = useHub
    ? bestRingOrderForCrossings(hubIndex, ringIndices, contextIds, validated.links)
    : ringIndices;
  const centers = placeContextCenters(radii, useHub
    ? { mode: "hub", hubIndex, ringOrder, contextMargin }
    : { mode: "row", contextMargin, startY });

  const contextLayouts = validated.contexts.map((context, index) =>
    layoutOneContext(context, centers[index], ringGap),
  );

  const nodes = contextLayouts.flatMap((item) => item.nodes);
  const edges = contextLayouts.flatMap((item) => item.edges);
  const rings = contextLayouts.flatMap((item) => item.rings);
  const sectors = contextLayouts.flatMap((item) => item.sectors);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const hubCenter = centers[hubIndex] || centers[0] || { x: 0, y: 0 };
  const midX = hubCenter.x;
  const ringR = useHub && ringOrder.length
    ? Math.hypot(centers[ringOrder[0]].x - hubCenter.x, centers[ringOrder[0]].y - hubCenter.y)
    : Math.max(...radii, 0);
  const busY = useHub
    ? hubCenter.y + ringR + Math.max(...radii, 0) * 0.12
    : startY + Math.max(...radii, 0) * 0.15;
  validated.buses.forEach((bus, index) => {
    const id = `bus:${bus.id}`;
    nodes.push({
      id,
      localId: bus.id,
      label: bus.label,
      kind: "bus",
      socket: "",
      sector: "",
      layerId: "",
      contextId: "",
      contextLabel: "",
      groupId: "",
      x: midX,
      y: busY + index * 70,
      angle: 0,
      radius: 0,
      shape: "bus",
    });
    nodeById.set(id, nodes[nodes.length - 1]);
  });

  validated.links.forEach((link, index) => {
    const from = nodeById.get(link.from);
    const to = nodeById.get(link.to);
    edges.push({
      id: `link${index}`,
      ...link,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      scope: "link",
    });
  });

  for (const node of nodes) nodeById.set(node.id, node);
  reduceCrossingsByRotation(contextLayouts, edges, { steps: 12, nodeById });

  const pad = 48;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x, y, margin = 0) => {
    minX = Math.min(minX, x - margin);
    minY = Math.min(minY, y - margin);
    maxX = Math.max(maxX, x + margin);
    maxY = Math.max(maxY, y + margin);
  };
  for (const context of contextLayouts) {
    grow(context.center.x, context.center.y, context.outerRadius);
    // コンテキスト名は円の上に出す
    grow(context.center.x, context.center.y - context.outerRadius - 20, 8);
  }
  for (const node of nodes) {
    grow(node.x, node.y, node.shape === "bus" ? 56 : 64);
  }
  for (const edge of edges) {
    grow(edge.x1, edge.y1, 8);
    grow(edge.x2, edge.y2, 8);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 400;
    maxY = 400;
  }
  const shiftX = pad - minX;
  const shiftY = pad - minY;
  for (const context of contextLayouts) {
    context.center.x += shiftX;
    context.center.y += shiftY;
  }
  for (const sector of sectors) {
    sector.cx += shiftX;
    sector.cy += shiftY;
    sector.labelX += shiftX;
    sector.labelY += shiftY;
  }
  for (const node of nodes) {
    node.x += shiftX;
    node.y += shiftY;
  }
  for (const edge of edges) {
    edge.x1 += shiftX;
    edge.y1 += shiftY;
    edge.x2 += shiftX;
    edge.y2 += shiftY;
  }
  const width = Math.ceil(maxX - minX + pad * 2);
  const height = Math.ceil(maxY - minY + pad * 2);

  return {
    center: contextLayouts[0]?.center || { x: shiftX, y: startY + shiftY },
    size: Math.max(width, height),
    width,
    height,
    rings,
    sectors,
    nodes,
    edges,
    contexts: contextLayouts,
    model: validated,
  };
}
