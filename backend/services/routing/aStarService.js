/**
 * aStarService.js
 *
 * Self-implemented A* shortest-path algorithm over a locally-extracted
 * road graph for the Patan Dhoka demo area.
 *
 * Coordinate convention: [longitude, latitude] everywhere.
 * No network calls — operates entirely on the in-memory graph loaded
 * by aStarGraphLoader.
 */

import { getGraph } from './aStarGraphLoader.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Earth's radius in meters, used for Haversine heuristic. */
const EARTH_RADIUS_M = 6371000;

/** Maximum snap distance in meters. If the nearest graph node is farther than this,
 *  consider the input point outside the supported area. */
const MAX_SNAP_DISTANCE_M = 3000;

// ─── Haversine (meters) ──────────────────────────────────────────────────────

/**
 * Haversine distance in meters between two [lng, lat] points.
 * Used both for snapping and as the A* heuristic.
 *
 * @param {[number, number]} a - [lng, lat]
 * @param {[number, number]} b - [lng, lat]
 * @returns {number} Distance in meters.
 */
function haversineM(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLng = toRad(b[0] - a[0]);
  const dLat = toRad(b[1] - a[1]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// ─── Min-Heap (priority queue) ───────────────────────────────────────────────

/**
 * Binary min-heap keyed by fScore.
 */
class MinHeap {
  constructor() {
    this.data = [];
  }

  get size() {
    return this.data.length;
  }

  push(item) {
    this.data.push(item);
    this._bubbleUp(this.data.length - 1);
  }

  pop() {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[i].f < this.data[parent].f) {
        [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
        i = parent;
      } else {
        break;
      }
    }
  }

  _sinkDown(i) {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;

      if (left < n && this.data[left].f < this.data[smallest].f) smallest = left;
      if (right < n && this.data[right].f < this.data[smallest].f) smallest = right;

      if (smallest !== i) {
        [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
        i = smallest;
      } else {
        break;
      }
    }
  }
}

// ─── Coordinate snapping ─────────────────────────────────────────────────────

/**
 * Finds the nearest graph node to a given coordinate.
 * Linear scan is acceptable for the bounded demo graph size.
 *
 * @param {number} lat - Latitude of the input point.
 * @param {number} lng - Longitude of the input point.
 * @param {{ nodes: Object }} graph - The road graph.
 * @returns {{ nodeId: string, lat: number, lng: number, distanceMeters: number } | null}
 */
export function snapToNearestNode(lat, lng, graph) {
  const inputCoord = [lng, lat];
  let bestId = null;
  let bestDist = Infinity;
  let bestLat = null;
  let bestLng = null;

  for (const [id, node] of Object.entries(graph.nodes)) {
    const d = haversineM(inputCoord, [node.lng, node.lat]);
    if (d < bestDist) {
      bestDist = d;
      bestId = id;
      bestLat = node.lat;
      bestLng = node.lng;
    }
  }

  if (bestId === null) return null;

  // If the nearest node is too far away, the point is outside our graph area
  if (bestDist > MAX_SNAP_DISTANCE_M) return null;

  return {
    nodeId: bestId,
    lat: bestLat,
    lng: bestLng,
    distanceMeters: bestDist
  };
}

// ─── A* search ───────────────────────────────────────────────────────────────

/**
 * Reconstructs the path from the cameFrom map.
 *
 * @param {Object} cameFrom - Map of nodeId → predecessor nodeId.
 * @param {string} endId - The ending node ID.
 * @returns {Array<[number, number]>} Ordered list of [lng, lat] coordinates.
 */
function reconstructPath(cameFrom, endId) {
  const path = [];
  let current = endId;
  while (current != null) {
    const node = getGraph().nodes[current];
    path.push([node.lng, node.lat]);
    current = cameFrom.get(current);
  }
  path.reverse();
  return path;
}

/**
 * Finds the shortest path between two coordinate pairs using A*.
 *
 * @param {[number, number]} startLngLat - [longitude, latitude] of the start.
 * @param {[number, number]} endLngLat - [longitude, latitude] of the end.
 * @returns {{ path: Array<[number, number]>, distanceMeters: number, found: boolean,
 *             reason: string|null, startSnap: Object|null, endSnap: Object|null, iterations: number }}
 */
export function findAStarRoute(startLngLat, endLngLat) {
  const graph = getGraph();
  if (!graph || !graph.nodes || !graph.edges) {
    return { path: [], distanceMeters: 0, found: false, reason: 'graph_not_loaded', startSnap: null, endSnap: null, iterations: 0 };
  }

  console.log(`[ASTAR] Computing shortest path from [${startLngLat[0]},${startLngLat[1]}] to [${endLngLat[0]},${endLngLat[1]}]`);

  // Snap start and end to nearest graph nodes
  const startSnap = snapToNearestNode(startLngLat[1], startLngLat[0], graph);
  const endSnap = snapToNearestNode(endLngLat[1], endLngLat[0], graph);

  if (!startSnap || !endSnap) {
    return {
      path: [], distanceMeters: 0, found: false,
      reason: !startSnap ? 'start_snap_out_of_range' : 'end_snap_out_of_range',
      startSnap, endSnap, iterations: 0
    };
  }

  console.log(`[ASTAR] Start snapped to node ${startSnap.nodeId} (${startSnap.distanceMeters.toFixed(1)}m from input)`);
  console.log(`[ASTAR] End snapped to node ${endSnap.nodeId} (${endSnap.distanceMeters.toFixed(1)}m from input)`);

  const startId = startSnap.nodeId;
  const endId = endSnap.nodeId;

  // Same node — trivial path
  if (startId === endId) {
    const startNode = graph.nodes[startId];
    return {
      path: [[startNode.lng, startNode.lat]],
      distanceMeters: 0,
      found: true,
      reason: null,
      startSnap, endSnap, iterations: 0
    };
  }

  const endCoord = [graph.nodes[endId].lng, graph.nodes[endId].lat];

  // gScore: cost from start to node
  const gScore = new Map();
  gScore.set(startId, 0);

  // fScore: gScore + heuristic
  const heuristic = (nodeId) => {
    const n = graph.nodes[nodeId];
    return haversineM([n.lng, n.lat], endCoord);
  };

  const fScore = new Map();
  fScore.set(startId, heuristic(startId));

  // cameFrom: for path reconstruction
  const cameFrom = new Map();

  // open set as min-heap
  const openSet = new MinHeap();
  openSet.push({ id: startId, f: fScore.get(startId) });

  const closedSet = new Set();
  let iterations = 0;
  const MAX_ITERATIONS = 50000;

  while (openSet.size > 0) {
    iterations++;
    if (iterations > MAX_ITERATIONS) {
      console.warn(`[ASTAR] Exceeded maximum iterations (${MAX_ITERATIONS}), aborting search`);
      return { path: [], distanceMeters: 0, found: false, reason: 'max_iterations', startSnap, endSnap, iterations };
    }

    const current = openSet.pop();

    if (current.id === endId) {
      // Reconstruct full path including snap tails
      const graphPath = reconstructPath(cameFrom, endId);

      // Prepend start snap offset if the snapped node isn't the exact input
      const totalPath = [];
      const startCoord = [startLngLat[0], startLngLat[1]];
      if (haversineM(startCoord, [startSnap.lng, startSnap.lat]) > 1) {
        totalPath.push(startCoord);
      }
      totalPath.push(...graphPath);

      // Append end snap offset if needed
      const endInputCoord = [endLngLat[0], endLngLat[1]];
      if (haversineM(endInputCoord, [endSnap.lng, endSnap.lat]) > 1) {
        totalPath.push(endInputCoord);
      }

      console.log(`[ASTAR] Path found in ${iterations} iterations, total distance: ${gScore.get(endId)}m, waypoints: ${totalPath.length}`);
      return {
        path: totalPath,
        distanceMeters: gScore.get(endId),
        found: true,
        reason: null,
        startSnap, endSnap, iterations
      };
    }

    if (closedSet.has(current.id)) continue;
    closedSet.add(current.id);

    const neighbors = graph.edges[current.id] || [];
    for (const neighbor of neighbors) {
      if (closedSet.has(neighbor.to)) continue;

      const tentativeG = gScore.get(current.id) + neighbor.weight;
      const existingG = gScore.get(neighbor.to);

      if (existingG === undefined || tentativeG < existingG) {
        cameFrom.set(neighbor.to, current.id);
        gScore.set(neighbor.to, tentativeG);
        const f = tentativeG + heuristic(neighbor.to);
        fScore.set(neighbor.to, f);
        openSet.push({ id: neighbor.to, f });
      }
    }
  }

  // No path found -- disconnected components
  console.log(`[ASTAR] No path found after ${iterations} iterations. Reason: disconnected`);
  return { path: [], distanceMeters: 0, found: false, reason: 'disconnected', startSnap, endSnap, iterations };
}
