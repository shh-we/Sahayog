/**
 * aStarGraphLoader.js
 *
 * Loads the pre-built road graph from patan-road-graph.json into memory
 * once at server startup. All subsequent A* searches use this in-memory
 * structure — no file I/O or network calls per request.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let _graph = null;

/**
 * Loads the road graph from disk into memory.
 * Called once at server startup from server.js.
 *
 * @returns {{ nodes: Object, edges: Object }} The loaded graph.
 */
export function loadGraph() {
  if (_graph) return _graph;

  const graphPath = resolve(__dirname, '..', '..', 'data', 'patan-road-graph.json');
  try {
    const raw = readFileSync(graphPath, 'utf8');
    _graph = JSON.parse(raw);

    const nodeCount = Object.keys(_graph.nodes).length;
    const edgeCount = Object.values(_graph.edges).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`[GRAPH] A* road graph loaded successfully from patan-road-graph.json`);
    console.log(`[GRAPH] Graph statistics: ${nodeCount} nodes, ${edgeCount} edges loaded into memory`);
    console.log(`[GRAPH] A* routing engine is ready`);

    return _graph;
  } catch (err) {
    console.error(`[GRAPH] Failed to load road graph from ${graphPath}:`, err.message);
    console.error('[GRAPH] A* routing will be unavailable -- falling back to OSRM for all routes.');
    _graph = null;
    return null;
  }
}

/**
 * Returns the currently loaded graph, or null if not yet loaded.
 *
 * @returns {{ nodes: Object, edges: Object } | null}
 */
export function getGraph() {
  return _graph;
}

/**
 * Clears the loaded graph (for testing purposes only).
 */
export function _clearGraph() {
  _graph = null;
}
