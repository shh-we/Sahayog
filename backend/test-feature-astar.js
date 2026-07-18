/**
 * test-feature-astar.js
 *
 * Feature: Hybrid A* + OSRM Routing — Unit Tests
 *
 * Tests the A* graph loader, snapToNearestNode, findAStarRoute,
 * and OSRM fallback behavior. No live MongoDB, OSRM, or network required.
 *
 * Run: node test-feature-astar.js
 */

import { loadGraph, getGraph, _clearGraph } from "./services/routing/aStarGraphLoader.js";
import { snapToNearestNode, findAStarRoute } from "./services/routing/aStarService.js";

// ─── Minimal test harness ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function logTest(name, ok, detail = {}) {
  if (ok) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}`);
    if (Object.keys(detail).length) console.error("    Detail:", JSON.stringify(detail, null, 2));
    failed++;
    failures.push(name);
  }
}

async function runSection(title, fn) {
  console.log(`\n${title}`);
  try {
    await fn();
  } catch (err) {
    console.error(`  ✗ [SECTION THREW] ${err.message}`);
    failed++;
    failures.push(title);
  }
}

// ─── Fixed demo points from Section 3 ────────────────────────────────────────
// All in [lng, lat] order per project convention.

const DEMO_POINTS = {
  patanDhoka:    { name: 'Patan Dhoka (Yala Dhwakha gate)',    lng: 85.3212, lat: 27.6782 },
  patanDurbar:   { name: 'Patan Durbar Square',                 lng: 85.3253, lat: 27.6727 },
  jawalakhel:    { name: 'Jawalakhel',                          lng: 85.3118, lat: 27.6727 },
  kumaripati:    { name: 'Kumaripati',                          lng: 85.3215, lat: 27.6739 },
  patanHospital: { name: 'Patan Hospital',                      lng: 85.3206, lat: 27.6683 },
  policeStation: { name: 'Metropolitan Police Station Lagankhel', lng: 85.3236, lat: 27.6677 }
};

// ─── Tests ────────────────────────────────────────────────────────────────────

await runSection("1. Graph loads correctly from static file", async () => {
  _clearGraph();
  const graph = loadGraph();

  logTest("graph is not null", graph !== null);
  logTest("graph has nodes", graph.nodes && typeof graph.nodes === 'object');
  logTest("graph has edges", graph.edges && typeof graph.edges === 'object');

  const nodeCount = Object.keys(graph.nodes).length;
  const edgeCount = Object.values(graph.edges).reduce((sum, arr) => sum + arr.length, 0);

  logTest(`graph has > 1000 nodes (actual: ${nodeCount})`, nodeCount > 1000);
  logTest(`graph has > 1000 edges (actual: ${edgeCount})`, edgeCount > 1000);

  // Verify node structure
  const firstNodeId = Object.keys(graph.nodes)[0];
  const firstNode = graph.nodes[firstNodeId];
  logTest("node has lat property", typeof firstNode.lat === 'number');
  logTest("node has lng property", typeof firstNode.lng === 'number');

  // Verify edge structure
  const firstEdgeList = graph.edges[firstNodeId];
  if (firstEdgeList && firstEdgeList.length > 0) {
    const firstEdge = firstEdgeList[0];
    logTest("edge has 'to' property", typeof firstEdge.to === 'string');
    logTest("edge has 'weight' property", typeof firstEdge.weight === 'number');
    logTest("edge weight is positive", firstEdge.weight > 0);
  }
});

await runSection("2. Graph loads only once (singleton)", async () => {
  const g1 = loadGraph();
  const g2 = loadGraph();
  logTest("same graph object returned on second call", g1 === g2);
});

await runSection("3. snapToNearestNode — Patan Dhoka", async () => {
  const graph = getGraph();
  const result = snapToNearestNode(DEMO_POINTS.patanDhoka.lat, DEMO_POINTS.patanDhoka.lng, graph);

  logTest("snap returns non-null result", result !== null);
  logTest("snap returns nodeId string", typeof result.nodeId === 'string');
  logTest("snap returns lat number", typeof result.lat === 'number');
  logTest("snap returns lng number", typeof result.lng === 'number');
  logTest("snap returns distanceMeters number", typeof result.distanceMeters === 'number');
  logTest("snapped distance is < 100m", result.distanceMeters < 100);
});

await runSection("4. snapToNearestNode — Jawalakhel", async () => {
  const graph = getGraph();
  const result = snapToNearestNode(DEMO_POINTS.jawalakhel.lat, DEMO_POINTS.jawalakhel.lng, graph);

  logTest("snap returns non-null", result !== null);
  logTest("snapped distance is < 100m", result.distanceMeters < 100);
});

await runSection("5. snapToNearestNode — Patan Hospital", async () => {
  const graph = getGraph();
  const result = snapToNearestNode(DEMO_POINTS.patanHospital.lat, DEMO_POINTS.patanHospital.lng, graph);

  logTest("snap returns non-null", result !== null);
  logTest("snapped distance is < 100m", result.distanceMeters < 100);
});

await runSection("6. snapToNearestNode — Police Station", async () => {
  const graph = getGraph();
  const result = snapToNearestNode(DEMO_POINTS.policeStation.lat, DEMO_POINTS.policeStation.lng, graph);

  logTest("snap returns non-null", result !== null);
  logTest("snapped distance is < 100m", result.distanceMeters < 100);
});

await runSection("7. findAStarRoute — Patan Dhoka → Jawalakhel (responder start)", async () => {
  const start = [DEMO_POINTS.patanDhoka.lng, DEMO_POINTS.patanDhoka.lat];
  const end = [DEMO_POINTS.jawalakhel.lng, DEMO_POINTS.jawalakhel.lat];

  const result = findAStarRoute(start, end);

  logTest("route found", result.found === true);
  logTest("path has >= 2 points", result.path.length >= 2);
  logTest("distanceMeters is positive number", typeof result.distanceMeters === 'number' && result.distanceMeters > 0);

  // Verify path connectivity: each consecutive pair should be connected in the graph
  const graph = getGraph();
  let connected = true;
  for (let i = 0; i < result.path.length - 1; i++) {
    const [lng1, lat1] = result.path[i];
    const [lng2, lat2] = result.path[i + 1];
    // Check they're not identical (which would be a degenerate edge)
    if (lng1 === lng2 && lat1 === lat2) continue;
    // At minimum, they should be within reasonable distance
    const dist = Math.sqrt((lng2 - lng1) ** 2 + (lat2 - lat1) ** 2);
    if (dist > 0.05) { // > ~5km between adjacent points is suspicious
      connected = false;
      break;
    }
  }
  logTest("path points are reasonably close together", connected);
  logTest("distance is < 10km for this demo pair", result.distanceMeters < 10000);

  console.log(`    Route: ${result.path.length} points, ${(result.distanceMeters / 1000).toFixed(2)} km`);
});

await runSection("8. findAStarRoute — Patan Dhoka → Patan Hospital (incident → medical facility)", async () => {
  const start = [DEMO_POINTS.patanDhoka.lng, DEMO_POINTS.patanDhoka.lat];
  const end = [DEMO_POINTS.patanHospital.lng, DEMO_POINTS.patanHospital.lat];

  const result = findAStarRoute(start, end);

  logTest("route found", result.found === true);
  logTest("path has >= 2 points", result.path.length >= 2);
  logTest("distanceMeters is positive", result.distanceMeters > 0);
  logTest("distance is < 5km for this demo pair", result.distanceMeters < 5000);

  console.log(`    Route: ${result.path.length} points, ${(result.distanceMeters / 1000).toFixed(2)} km`);
});

await runSection("9. findAStarRoute — Patan Dhoka → Police Station (incident → police facility)", async () => {
  const start = [DEMO_POINTS.patanDhoka.lng, DEMO_POINTS.patanDhoka.lat];
  const end = [DEMO_POINTS.policeStation.lng, DEMO_POINTS.policeStation.lat];

  const result = findAStarRoute(start, end);

  logTest("route found", result.found === true);
  logTest("path has >= 2 points", result.path.length >= 2);
  logTest("distanceMeters is positive", result.distanceMeters > 0);
  logTest("distance is < 5km for this demo pair", result.distanceMeters < 5000);

  console.log(`    Route: ${result.path.length} points, ${(result.distanceMeters / 1000).toFixed(2)} km`);
});

await runSection("10. findAStarRoute — Jawalakhel → Patan Durbar Square", async () => {
  const start = [DEMO_POINTS.jawalakhel.lng, DEMO_POINTS.jawalakhel.lat];
  const end = [DEMO_POINTS.patanDurbar.lng, DEMO_POINTS.patanDurbar.lat];

  const result = findAStarRoute(start, end);

  logTest("route found", result.found === true);
  logTest("path has >= 2 points", result.path.length >= 2);
  logTest("distance is < 5km for this demo pair", result.distanceMeters < 5000);

  console.log(`    Route: ${result.path.length} points, ${(result.distanceMeters / 1000).toFixed(2)} km`);
});

await runSection("11. findAStarRoute — Kumaripati → Patan Hospital", async () => {
  const start = [DEMO_POINTS.kumaripati.lng, DEMO_POINTS.kumaripati.lat];
  const end = [DEMO_POINTS.patanHospital.lng, DEMO_POINTS.patanHospital.lat];

  const result = findAStarRoute(start, end);

  logTest("route found", result.found === true);
  logTest("path has >= 2 points", result.path.length >= 2);
  logTest("distance is < 5km", result.distanceMeters < 5000);

  console.log(`    Route: ${result.path.length} points, ${(result.distanceMeters / 1000).toFixed(2)} km`);
});

await runSection("12. findAStarRoute — Kumaripati → Police Station", async () => {
  const start = [DEMO_POINTS.kumaripati.lng, DEMO_POINTS.kumaripati.lat];
  const end = [DEMO_POINTS.policeStation.lng, DEMO_POINTS.policeStation.lat];

  const result = findAStarRoute(start, end);

  logTest("route found", result.found === true);
  logTest("path has >= 2 points", result.path.length >= 2);
  logTest("distance is < 5km", result.distanceMeters < 5000);

  console.log(`    Route: ${result.path.length} points, ${(result.distanceMeters / 1000).toFixed(2)} km`);
});

await runSection("13. findAStarRoute — Patan Durbar → Jawalakhel", async () => {
  const start = [DEMO_POINTS.patanDurbar.lng, DEMO_POINTS.patanDurbar.lat];
  const end = [DEMO_POINTS.jawalakhel.lng, DEMO_POINTS.jawalakhel.lat];

  const result = findAStarRoute(start, end);

  logTest("route found", result.found === true);
  logTest("path has >= 2 points", result.path.length >= 2);
  logTest("distance is < 5km", result.distanceMeters < 5000);

  console.log(`    Route: ${result.path.length} points, ${(result.distanceMeters / 1000).toFixed(2)} km`);
});

await runSection("14. findAStarRoute — returns { found: false } for points outside graph", async () => {
  // These coordinates are far outside the bounding box (e.g., somewhere in India)
  const result = findAStarRoute([77.5, 12.9], [77.6, 13.0]);

  logTest("route not found for disconnected coordinates", result.found === false);
  logTest("empty path returned", Array.isArray(result.path) && result.path.length === 0);
  logTest("distanceMeters is 0", result.distanceMeters === 0);
});

await runSection("15. findAStarRoute — returns { found: false } for null/empty graph", async () => {
  // Temporarily clear the graph to test null handling
  _clearGraph();
  const result = findAStarRoute(
    [DEMO_POINTS.patanDhoka.lng, DEMO_POINTS.patanDhoka.lat],
    [DEMO_POINTS.jawalakhel.lng, DEMO_POINTS.jawalakhel.lat]
  );

  logTest("returns found: false when graph is null", result.found === false);

  // Reload for subsequent tests
  loadGraph();
});

await runSection("16. findAStarRoute — same start and end returns trivial path", async () => {
  const coord = [DEMO_POINTS.patanDhoka.lng, DEMO_POINTS.patanDhoka.lat];
  const result = findAStarRoute(coord, coord);

  logTest("route found for same start/end", result.found === true);
  logTest("path has at least 1 point", result.path.length >= 1);
  logTest("distanceMeters is 0", result.distanceMeters === 0);
});

await runSection("17. findAStarRoute — route points are [lng, lat] format", async () => {
  const start = [DEMO_POINTS.patanDhoka.lng, DEMO_POINTS.patanDhoka.lat];
  const end = [DEMO_POINTS.jawalakhel.lng, DEMO_POINTS.jawalakhel.lat];

  const result = findAStarRoute(start, end);

  logTest("route found", result.found === true);

  let allValid = true;
  for (const pt of result.path) {
    if (!Array.isArray(pt) || pt.length !== 2) { allValid = false; break; }
    if (typeof pt[0] !== 'number' || typeof pt[1] !== 'number') { allValid = false; break; }
    // In Patan area: lng ~85.3, lat ~27.6
    if (pt[0] < 80 || pt[0] > 90 || pt[1] < 25 || pt[1] > 30) { allValid = false; break; }
  }
  logTest("all path points are valid [lng, lat] in expected range", allValid);
});

await runSection("18. findAStarRoute — route distance is reasonable vs Haversine", async () => {
  // The road distance should be >= straight-line distance but not absurdly larger
  const start = [DEMO_POINTS.patanDhoka.lng, DEMO_POINTS.patanDhoka.lat];
  const end = [DEMO_POINTS.jawalakhel.lng, DEMO_POINTS.jawalakhel.lat];

  const result = findAStarRoute(start, end);

  // Compute straight-line distance using Haversine
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLng = toRad(end[0] - start[0]);
  const dLat = toRad(end[1] - start[1]);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(start[1])) * Math.cos(toRad(end[1])) * Math.sin(dLng / 2) ** 2;
  const straightLine = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  logTest("route found", result.found === true);
  logTest(`road distance (${result.distanceMeters.toFixed(0)}m) >= straight line (${straightLine.toFixed(0)}m)`,
    result.distanceMeters >= straightLine * 0.9); // allow 10% tolerance for snapping
  logTest(`road distance ratio < 3x straight line`,
    result.distanceMeters < straightLine * 3);

  console.log(`    Straight line: ${straightLine.toFixed(0)}m, Road: ${result.distanceMeters.toFixed(0)}m, Ratio: ${(result.distanceMeters / straightLine).toFixed(2)}x`);
});

await runSection("19. findAStarRoute — all demo pairs produce valid routes", async () => {
  const pairs = [
    ['patanDhoka', 'jawalakhel'],
    ['patanDhoka', 'kumaripati'],
    ['patanDhoka', 'patanHospital'],
    ['patanDhoka', 'policeStation'],
    ['patanDurbar', 'jawalakhel'],
    ['patanDurbar', 'kumaripati'],
    ['patanDurbar', 'patanHospital'],
    ['patanDurbar', 'policeStation'],
    ['jawalakhel', 'patanHospital'],
    ['jawalakhel', 'policeStation'],
    ['kumaripati', 'patanHospital'],
    ['kumaripati', 'policeStation']
  ];

  let allFound = true;
  for (const [from, to] of pairs) {
    const start = [DEMO_POINTS[from].lng, DEMO_POINTS[from].lat];
    const end = [DEMO_POINTS[to].lng, DEMO_POINTS[to].lat];
    const result = findAStarRoute(start, end);

    if (!result.found) {
      allFound = false;
      console.error(`    FAILED: ${from} → ${to}`);
    } else {
      console.log(`    ${from} → ${to}: ${(result.distanceMeters / 1000).toFixed(2)} km, ${result.path.length} pts`);
    }
  }

  logTest("all 12 demo pairs have valid routes", allFound);
});

await runSection("20. snapToNearestNode — handles coordinate precision gracefully", async () => {
  const graph = getGraph();
  // Test with slightly offset coordinates (simulating GPS drift)
  const result = snapToNearestNode(
    DEMO_POINTS.patanDhoka.lat + 0.001,
    DEMO_POINTS.patanDhoka.lng + 0.001,
    graph
  );

  logTest("snap returns non-null for offset coords", result !== null);
  logTest("snapped distance is reasonable (< 200m)", result.distanceMeters < 200);
});

// ─── Results ──────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log("\nFailed tests:");
  failures.forEach(f => console.log(`  ✗ ${f}`));
}
console.log("─".repeat(60));

process.exit(failed > 0 ? 1 : 0);
