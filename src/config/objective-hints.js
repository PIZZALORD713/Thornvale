import { getTownStaticColliderEnvelopes, TOWN_LAYOUT } from './town.js';

export const OBJECTIVE_HINT_DURATION = 4;
export const OBJECTIVE_HINT_MAX_DISTANCE = 24;
export const OBJECTIVE_HINT_ROUTE_CLEARANCE = 0.8;
export const OBJECTIVE_HINT_PICKUP_CLEARANCE = 0.2;
export const OBJECTIVE_HINT_START_SNAP_DISTANCE = 10;

// These paths have a deterministic clearance contract. The optional north and
// south connectors are deliberately excluded: their building-end envelopes
// are presentation paths, not validated guidance corridors.
export const OBJECTIVE_HINT_SAFE_ROUTE_IDS = Object.freeze([
  'arrival',
  'berry-bakery',
  'lavender-library',
  'mint-tea-house',
  'rose-post-office',
  'pond',
  'forest-edge-camp',
  'bell-hill-ritual',
]);

// Null is intentional for resolution objectives. Their persistent comply or
// alter route belongs to StoryWorld and must remain the sole authority.
export const OBJECTIVE_HINT_TARGETS = Object.freeze({
  'meet-steward': 'steward',
  'day-one-meet-steward': 'steward',
  'sign-ledger': 'ledger',
  'day-one-sign-ledger': 'ledger',
  'settle-first-afternoon': 'campRecovery',
  'day-one-gather-wood': 'woodlot',
  'day-one-catch-fish': 'fishingSpot',
  'day-one-light-fire': 'campfire',
  'day-one-cook-fish': 'campfire',
  'day-one-eat-fish': 'campfire',
  'day-one-plant-seed': 'garden',
  'day-one-water-seed': 'garden',
  'day-one-gather-shelter-wood': 'woodlot',
  'day-one-repair-shelter': 'shelter',
  'ring-bell-at-dusk': 'bell',
  'return-to-lumen': 'steward',
  'inspect-ledger': 'ledger',
  'hear-correction': 'steward',
  'comply-complete': null,
  'alter-complete': null,
});

// Small, reviewed last-mile links extend the authored town paths through the
// provisional camp. They are fixed navigation seams, never player-to-target
// chords. Endpoints are read from TOWN_LAYOUT so visible stations cannot drift.
const CAMP_SPUR_WAYPOINTS = Object.freeze({
  woodlot: Object.freeze([
    Object.freeze([-29.8, 2.5]),
    Object.freeze([-30.9, 0.6]),
  ]),
  campfire: Object.freeze([
    Object.freeze([-27.5, 3.25]),
    Object.freeze([-25.8, 2.7]),
  ]),
  garden: Object.freeze([
    Object.freeze([-28.6, 5]),
    Object.freeze([-27.8, 6]),
  ]),
  shelter: Object.freeze([
    Object.freeze([-30.4, 4]),
  ]),
});

function objectiveId(value) {
  const id = typeof value === 'string' ? value : value?.id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

function toPoint(value) {
  if (Array.isArray(value)) {
    const x = Number(value[0]);
    const y = value.length >= 3 ? Number(value[1]) : 0;
    const z = Number(value.length >= 3 ? value[2] : value[1]);
    return [x, y, z].every(Number.isFinite) ? { x, y, z } : null;
  }
  if (!value || typeof value !== 'object') return null;
  const x = Number(value.x);
  const y = value.y === undefined ? 0 : Number(value.y);
  const z = Number(value.z);
  return [x, y, z].every(Number.isFinite) ? { x, y, z } : null;
}

function clonePoint(point) {
  return { x: point.x, y: point.y, z: point.z };
}

function distance3D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function distanceXZ(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function lerpPoint(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function segmentIntersectsBounds(start, end, bounds) {
  let tMin = 0;
  let tMax = 1;
  for (const axis of ['x', 'z']) {
    const suffix = axis.toUpperCase();
    const min = bounds[`min${suffix}`];
    const max = bounds[`max${suffix}`];
    const delta = end[axis] - start[axis];
    if (Math.abs(delta) < 1e-9) {
      if (start[axis] < min || start[axis] > max) return false;
      continue;
    }
    const entry = (min - start[axis]) / delta;
    const exit = (max - start[axis]) / delta;
    tMin = Math.max(tMin, Math.min(entry, exit));
    tMax = Math.min(tMax, Math.max(entry, exit));
    if (tMin > tMax) return false;
  }
  return true;
}

function expandedBuildingBounds(building, amount) {
  return {
    minX: building.position.x - building.size.x * 0.5 - amount,
    maxX: building.position.x + building.size.x * 0.5 + amount,
    minZ: building.position.z - building.size.z * 0.5 - amount,
    maxZ: building.position.z + building.size.z * 0.5 + amount,
  };
}

function expandedColliderBounds(collider, amount) {
  return {
    minX: collider.position.x - collider.size.x * 0.5 - amount,
    maxX: collider.position.x + collider.size.x * 0.5 + amount,
    minZ: collider.position.z - collider.size.z * 0.5 - amount,
    maxZ: collider.position.z + collider.size.z * 0.5 + amount,
  };
}

/**
 * Validate only the projection corridor: finite meadow points with every
 * segment outside the cottage clearance envelope. The resolver never creates
 * physics or changes authoritative state.
 */
export function isObjectiveHintPathSafe(points, layout = TOWN_LAYOUT) {
  if (!Array.isArray(points) || points.length < 2) return false;
  const normalized = points.map(toPoint);
  if (normalized.some((point) => !point)) return false;
  const meadowRadius = Number(layout?.meadowRadius);
  if (!Number.isFinite(meadowRadius) || meadowRadius <= 0) return false;
  if (normalized.some((point) => Math.hypot(point.x, point.z) > meadowRadius + 1e-6)) {
    return false;
  }

  const bounds = (layout.buildings || []).map((building) => (
    expandedBuildingBounds(building, OBJECTIVE_HINT_ROUTE_CLEARANCE)
  ));
  for (let index = 0; index < normalized.length - 1; index += 1) {
    if (distance3D(normalized[index], normalized[index + 1]) <= 1e-8) continue;
    if (bounds.some((box) => segmentIntersectsBounds(
      normalized[index],
      normalized[index + 1],
      box,
    ))) return false;
  }
  return true;
}

/**
 * Validate the unscripted player-to-corridor pickup against the same fixed
 * prop envelopes used by town physics. Authored route bodies and intentional
 * target approaches retain their separate reviewed contract.
 */
export function isObjectiveHintPickupClear(start, end, layout = TOWN_LAYOUT) {
  const normalizedStart = toPoint(start);
  const normalizedEnd = toPoint(end);
  if (
    !normalizedStart
    || !normalizedEnd
    || !isObjectiveHintPathSafe([normalizedStart, normalizedEnd], layout)
  ) return false;
  return !getTownStaticColliderEnvelopes(layout).some((collider) => (
    segmentIntersectsBounds(
      normalizedStart,
      normalizedEnd,
      expandedColliderBounds(collider, OBJECTIVE_HINT_PICKUP_CLEARANCE),
    )
  ));
}

function createGraph(layout) {
  const graph = {
    nodes: new Map(),
    edges: [],
    adjacency: new Map(),
    routeNodes: new Map(),
  };

  const addNode = (id, value) => {
    const point = toPoint(value);
    if (!point || graph.nodes.has(id)) return false;
    graph.nodes.set(id, point);
    graph.adjacency.set(id, []);
    return true;
  };

  const addEdge = (id, a, b, routeId = null) => {
    const start = graph.nodes.get(a);
    const end = graph.nodes.get(b);
    if (!start || !end) return false;
    const weight = distance3D(start, end);
    const edge = { id, a, b, weight, routeId };
    graph.edges.push(edge);
    graph.adjacency.get(a).push({ node: b, weight, edge });
    graph.adjacency.get(b).push({ node: a, weight, edge });
    return true;
  };

  const routeById = new Map((layout.paths || []).map((route) => [route.id, route]));
  for (const routeId of OBJECTIVE_HINT_SAFE_ROUTE_IDS) {
    const route = routeById.get(routeId);
    if (!route || !Array.isArray(route.points) || route.points.length < 2) return null;
    const nodeIds = [];
    for (let index = 0; index < route.points.length; index += 1) {
      const nodeId = `route:${routeId}:${index}`;
      if (!addNode(nodeId, route.points[index])) return null;
      nodeIds.push(nodeId);
      if (index > 0) {
        addEdge(`route:${routeId}:${index - 1}`, nodeIds[index - 1], nodeId, routeId);
      }
    }
    graph.routeNodes.set(routeId, nodeIds);
  }

  const plaza = toPoint(layout.plaza);
  if (!plaza || !addNode('plaza:hub', { x: plaza.x, y: 0, z: plaza.z })) return null;
  for (const routeId of OBJECTIVE_HINT_SAFE_ROUTE_IDS.filter((id) => id !== 'forest-edge-camp')) {
    const nodes = graph.routeNodes.get(routeId);
    const endpoints = [nodes[0], nodes.at(-1)];
    endpoints.sort((left, right) => (
      distanceXZ(graph.nodes.get(left), plaza) - distanceXZ(graph.nodes.get(right), plaza)
    ));
    const endpoint = endpoints[0];
    if (distanceXZ(graph.nodes.get(endpoint), plaza) > Number(layout.plaza.radius) + 0.3) {
      return null;
    }
    addEdge(`plaza:${routeId}`, 'plaza:hub', endpoint, `plaza:${routeId}`);
  }

  const roseEnd = graph.routeNodes.get('rose-post-office').at(-1);
  const forestStart = graph.routeNodes.get('forest-edge-camp')[0];
  if (distanceXZ(graph.nodes.get(roseEnd), graph.nodes.get(forestStart)) > 0.05) return null;
  addEdge('join:rose-to-camp', roseEnd, forestStart, 'forest-edge-camp');

  const addSpur = (targetKey, startNode, waypoints, endpoint) => {
    let previous = startNode;
    for (let index = 0; index < waypoints.length; index += 1) {
      const nodeId = `spur:${targetKey}:${index}`;
      if (!addNode(nodeId, waypoints[index])) return false;
      addEdge(`spur:${targetKey}:${index}`, previous, nodeId, `spur:${targetKey}`);
      previous = nodeId;
    }
    const targetNode = `target:${targetKey}`;
    if (!addNode(targetNode, endpoint)) return false;
    addEdge(`spur:${targetKey}:target`, previous, targetNode, `spur:${targetKey}`);
    return true;
  };

  const ledger = toPoint(layout.landmarks?.ledger);
  if (!ledger || !addSpur('ledger', 'plaza:hub', [[-1.05, 1.9]], [ledger.x, ledger.z])) {
    return null;
  }

  const bellRouteEnd = graph.routeNodes.get('bell-hill-ritual').at(-1);
  if (!addNode('target:bell', graph.nodes.get(bellRouteEnd))) return null;
  addEdge('join:bell-target', bellRouteEnd, 'target:bell', 'bell-hill-ritual');

  const fishingRouteEnd = graph.routeNodes.get('pond').at(-1);
  if (!addNode('target:fishingSpot', graph.nodes.get(fishingRouteEnd))) return null;
  addEdge('join:fishing-target', fishingRouteEnd, 'target:fishingSpot', 'pond');

  const forestEnd = graph.routeNodes.get('forest-edge-camp').at(-1);
  const dayOne = layout.dayOne || {};
  if (!addNode('target:campRecovery', graph.nodes.get(forestEnd))) return null;
  addEdge(
    'join:camp-recovery-target',
    forestEnd,
    'target:campRecovery',
    'forest-edge-camp',
  );
  for (const targetKey of Object.keys(CAMP_SPUR_WAYPOINTS)) {
    const endpoint = toPoint(dayOne[targetKey]);
    if (!endpoint || !addSpur(
      targetKey,
      forestEnd,
      CAMP_SPUR_WAYPOINTS[targetKey],
      [endpoint.x, endpoint.y, endpoint.z],
    )) return null;
  }

  for (const edge of graph.edges) {
    if (!isObjectiveHintPathSafe([
      graph.nodes.get(edge.a),
      graph.nodes.get(edge.b),
    ], layout)) return null;
  }
  return graph;
}

function snapToEdges(point, graph, predicate = null, candidateAllowed = null) {
  let best = null;
  for (const edge of graph.edges) {
    if (predicate && !predicate(edge)) continue;
    const a = graph.nodes.get(edge.a);
    const b = graph.nodes.get(edge.b);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lengthSquared = dx * dx + dz * dz;
    if (lengthSquared <= 1e-10) continue;
    const t = Math.max(0, Math.min(1, (
      (point.x - a.x) * dx + (point.z - a.z) * dz
    ) / lengthSquared));
    const snapped = lerpPoint(a, b, t);
    const distance = distanceXZ(point, snapped);
    const candidate = { edge, point: snapped, t, distance };
    if (candidateAllowed && !candidateAllowed(candidate)) continue;
    if (!best || distance < best.distance) best = candidate;
  }
  return best;
}

function findReachableStartSnap(point, graph, layout) {
  return snapToEdges(point, graph, null, (candidate) => (
    candidate.distance <= OBJECTIVE_HINT_START_SNAP_DISTANCE + 1e-6
    && isObjectiveHintPickupClear(point, candidate.point, layout)
  ));
}

function canonicalTarget(targetKey, layout) {
  if (targetKey === 'ledger') return toPoint(layout.landmarks?.ledger);
  if (targetKey === 'bell') return toPoint(layout.landmarks?.bell);
  if (targetKey === 'fishingSpot') return toPoint(layout.dayOne?.fishingSpot);
  return toPoint(layout.dayOne?.[targetKey]);
}

function targetAttachment(targetKey, target, graph, layout) {
  if (targetKey === 'steward') {
    const snap = snapToEdges(
      target,
      graph,
      (edge) => edge.routeId === 'arrival' || edge.routeId === 'plaza:arrival',
    );
    return snap && snap.distance <= 2.35 ? { snap } : null;
  }

  const expected = canonicalTarget(targetKey, layout);
  const nodeId = `target:${targetKey}`;
  if (!expected || !graph.nodes.has(nodeId) || distanceXZ(expected, target) > 1) return null;
  return { nodeId };
}

function addVirtualNode(graph, id, snap) {
  graph.nodes.set(id, clonePoint(snap.point));
  graph.adjacency.set(id, []);
  const connect = (node, weight) => {
    const edge = { id: `${id}:${node}`, a: id, b: node, weight, routeId: snap.edge.routeId };
    graph.edges.push(edge);
    graph.adjacency.get(id).push({ node, weight, edge });
    graph.adjacency.get(node).push({ node: id, weight, edge });
  };
  connect(snap.edge.a, distance3D(snap.point, graph.nodes.get(snap.edge.a)));
  connect(snap.edge.b, distance3D(snap.point, graph.nodes.get(snap.edge.b)));
}

function connectVirtualsOnSameEdge(graph, startSnap, targetSnap) {
  if (startSnap.edge.id !== targetSnap.edge.id) return;
  const weight = distance3D(startSnap.point, targetSnap.point);
  const edge = {
    id: 'virtual:direct',
    a: 'virtual:start',
    b: 'virtual:target',
    weight,
    routeId: startSnap.edge.routeId,
  };
  graph.edges.push(edge);
  graph.adjacency.get(edge.a).push({ node: edge.b, weight, edge });
  graph.adjacency.get(edge.b).push({ node: edge.a, weight, edge });
}

function shortestNodePath(graph, startId, targetId) {
  const distances = new Map([...graph.nodes.keys()].map((id) => [id, Infinity]));
  const previous = new Map();
  const remaining = new Set(graph.nodes.keys());
  distances.set(startId, 0);

  while (remaining.size > 0) {
    let current = null;
    let currentDistance = Infinity;
    for (const id of remaining) {
      const distance = distances.get(id);
      if (distance < currentDistance) {
        current = id;
        currentDistance = distance;
      }
    }
    if (current === null || !Number.isFinite(currentDistance)) return null;
    remaining.delete(current);
    if (current === targetId) break;
    for (const neighbor of graph.adjacency.get(current) || []) {
      if (!remaining.has(neighbor.node)) continue;
      const candidate = currentDistance + neighbor.weight;
      if (candidate + 1e-9 < distances.get(neighbor.node)) {
        distances.set(neighbor.node, candidate);
        previous.set(neighbor.node, current);
      }
    }
  }

  if (!Number.isFinite(distances.get(targetId))) return null;
  const result = [];
  let current = targetId;
  while (current) {
    result.push(current);
    if (current === startId) break;
    current = previous.get(current);
  }
  return result.at(-1) === startId ? result.reverse() : null;
}

function dedupePoints(points) {
  const result = [];
  for (const point of points) {
    if (!result.length || distance3D(result.at(-1), point) > 1e-7) {
      result.push(clonePoint(point));
    }
  }
  return result;
}

function truncatePath(points, maximumDistance) {
  if (!Number.isFinite(maximumDistance)) return points.map(clonePoint);
  const result = [clonePoint(points[0])];
  let remaining = maximumDistance;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const length = distance3D(start, end);
    if (length <= remaining + 1e-9) {
      result.push(clonePoint(end));
      remaining -= length;
      continue;
    }
    if (remaining > 1e-6 && length > 1e-8) {
      result.push(lerpPoint(start, end, remaining / length));
    }
    break;
  }
  return result;
}

/**
 * Resolve one temporary route without mutating world or story state.
 *
 * `start` remains the first route point, then joins the nearest reachable
 * reviewed corridor. The pickup clears cottage masses plus the fixed physics
 * envelopes; the authored route body retains its reviewed cottage contract.
 * `target` validates the authoritative live destination against the
 * objective's configured role.
 */
export function resolveObjectiveHintPath({
  objective,
  start,
  target,
  layout = TOWN_LAYOUT,
  maxDistance = OBJECTIVE_HINT_MAX_DISTANCE,
} = {}) {
  const id = objectiveId(objective);
  if (!id || !Object.hasOwn(OBJECTIVE_HINT_TARGETS, id)) return null;
  const targetKey = OBJECTIVE_HINT_TARGETS[id];
  if (!targetKey) return null;

  const startPoint = toPoint(start);
  const targetPoint = toPoint(target);
  if (!startPoint || !targetPoint || !layout || typeof layout !== 'object') return null;
  const graph = createGraph(layout);
  if (!graph) return null;

  const startSnap = findReachableStartSnap(startPoint, graph, layout);
  if (!startSnap) return null;
  const destination = targetAttachment(targetKey, targetPoint, graph, layout);
  if (!destination) return null;

  addVirtualNode(graph, 'virtual:start', startSnap);
  let targetNodeId = destination.nodeId;
  if (destination.snap) {
    addVirtualNode(graph, 'virtual:target', destination.snap);
    connectVirtualsOnSameEdge(graph, startSnap, destination.snap);
    targetNodeId = 'virtual:target';
  }

  const nodePath = shortestNodePath(graph, 'virtual:start', targetNodeId);
  if (!nodePath) return null;
  const fullPath = dedupePoints([
    startPoint,
    ...nodePath.map((nodeId) => graph.nodes.get(nodeId)),
  ]);
  if (fullPath.length < 2 || distance3D(fullPath[0], fullPath.at(-1)) <= 1e-7) return null;

  const numericMaximum = maxDistance === Infinity ? Infinity : Number(maxDistance);
  if (numericMaximum !== Infinity && (!Number.isFinite(numericMaximum) || numericMaximum <= 0)) {
    return null;
  }
  const projected = truncatePath(fullPath, numericMaximum);
  return projected.length >= 2 && isObjectiveHintPathSafe(projected, layout)
    ? projected
    : null;
}
