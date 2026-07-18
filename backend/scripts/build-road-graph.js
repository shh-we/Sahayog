/**
 * build-road-graph.js
 *
 * One-time build script that reads raw OSM data (patan-osm-raw.json)
 * and produces a simplified node/edge graph (patan-road-graph.json).
 *
 * Run manually: node backend/scripts/build-road-graph.js
 * NOT run at server startup.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Haversine distance (km) ─────────────────────────────────────────────────

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Load raw OSM data ───────────────────────────────────────────────────────

const rawPath = resolve(__dirname, '..', 'data', 'patan-osm-raw.json');
console.log(`Reading ${rawPath}...`);
const raw = JSON.parse(readFileSync(rawPath, 'utf8'));

const elements = raw.elements || [];
console.log(`  Total elements: ${elements.length}`);

// Build a lookup map for nodes
const nodeMap = {};
for (const el of elements) {
  if (el.type === 'node' && el.id != null && el.lat != null && el.lon != null) {
    nodeMap[el.id] = { lat: el.lat, lng: el.lon };
  }
}
console.log(`  Unique nodes: ${Object.keys(nodeMap).length}`);

// ─── Process ways into edges ─────────────────────────────────────────────────

const ways = elements.filter((el) => el.type === 'way');
console.log(`  Ways (road segments): ${ways.length}`);

// Graph adjacency: nodeId -> [{ to: neighborId, weight: meters }]
const adjacency = {};

function addEdge(fromId, toId, weightMeters) {
  if (!adjacency[fromId]) adjacency[fromId] = [];
  if (!adjacency[toId]) adjacency[toId] = [];
  adjacency[fromId].push({ to: String(toId), weight: weightMeters });
  adjacency[toId].push({ to: String(fromId), weight: weightMeters });
}

let skippedWays = 0;
let skippedNodes = 0;

for (const way of ways) {
  const nodes = way.nodes || [];
  if (nodes.length < 2) { skippedWays++; continue; }

  // Determine one-way status
  const tags = way.tags || {};
  let isOneWay = false;
  if (tags.oneway === 'yes' || tags.oneway === '1' || tags.oneway === 'true') {
    isOneWay = true;
  }
  // Skip reversible/circular
  if (tags.oneway === '-1' || tags.junction === 'roundabout') {
    isOneWay = true;
  }

  // Check if all nodes exist
  const validNodes = nodes.filter((nid) => {
    if (!nodeMap[nid]) { skippedNodes++; return false; }
    return true;
  });

  if (validNodes.length < 2) { skippedWays++; continue; }

  // Create edges between consecutive node pairs
  for (let i = 0; i < validNodes.length - 1; i++) {
    const fromId = validNodes[i];
    const toId = validNodes[i + 1];
    const fromNode = nodeMap[fromId];
    const toNode = nodeMap[toId];
    const distMeters = haversineKm(fromNode.lat, fromNode.lng, toNode.lat, toNode.lng) * 1000;

    // Skip extremely short edges (< 1m, likely artifacts)
    if (distMeters < 1) continue;

    if (isOneWay) {
      // One-way: only forward direction
      if (!adjacency[fromId]) adjacency[fromId] = [];
      adjacency[fromId].push({ to: String(toId), weight: distMeters });
    } else {
      addEdge(fromId, toId, distMeters);
    }
  }
}

console.log(`  Skipped ways: ${skippedWays}, Skipped node refs: ${skippedNodes}`);

// ─── Build output graph ──────────────────────────────────────────────────────

const graphNodes = {};
for (const [id, coords] of Object.entries(nodeMap)) {
  // Only include nodes that have at least one edge
  if (adjacency[id] && adjacency[id].length > 0) {
    graphNodes[id] = { lat: coords.lat, lng: coords.lng };
  }
}

// Filter adjacency to only include edges referencing kept nodes
const graphEdges = {};
for (const [id, neighbors] of Object.entries(adjacency)) {
  if (!graphNodes[id]) continue;
  const kept = neighbors.filter((n) => graphNodes[n.to]);
  if (kept.length > 0) {
    graphEdges[id] = kept.map((n) => ({
      to: n.to,
      weight: Math.round(n.weight * 10) / 10
    }));
  }
}

const nodeCount = Object.keys(graphNodes).length;
const edgeCount = Object.values(graphEdges).reduce((sum, arr) => sum + arr.length, 0);

console.log(`\nOutput graph:`);
console.log(`  Nodes with edges: ${nodeCount}`);
console.log(`  Edges (directed): ${edgeCount}`);

// ─── Write output ────────────────────────────────────────────────────────────

const outPath = resolve(__dirname, '..', 'data', 'patan-road-graph.json');
const output = { nodes: graphNodes, edges: graphEdges };
writeFileSync(outPath, JSON.stringify(output), 'utf8');
console.log(`  Written to ${outPath}`);
console.log(`  File size: ${(Buffer.byteLength(JSON.stringify(output)) / 1024).toFixed(1)} KB`);
console.log('\nDone.');
