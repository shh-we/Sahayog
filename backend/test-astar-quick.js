import { findAStarRoute, snapToNearestNode } from './services/routing/aStarService.js';
import { loadGraph, getGraph } from './services/routing/aStarGraphLoader.js';

loadGraph();
const graph = getGraph();

console.log('Graph loaded:', Object.keys(graph.nodes).length, 'nodes');

// Test pairs from Section 3
const pairs = [
  { name: 'Jawalakhel → Patan Dhoka', from: [85.3118, 27.6727], to: [85.3212, 27.6782] },
  { name: 'Kumaripati → Patan Durbar', from: [85.3215, 27.6739], to: [85.3253, 27.6727] },
  { name: 'Patan Dhoka → Patan Hospital', from: [85.3212, 27.6782], to: [85.3206, 27.6683] },
  { name: 'Patan Dhoka → Lagankhel Police', from: [85.3212, 27.6782], to: [85.3236, 27.6677] },
  { name: 'Patan Durbar → Patan Hospital', from: [85.3253, 27.6727], to: [85.3206, 27.6683] },
];

console.log('\n=== A* Route Tests ===\n');

for (const pair of pairs) {
  const result = findAStarRoute(pair.from, pair.to);
  console.log(`${pair.name}:`);
  console.log(`  found: ${result.found}`);
  console.log(`  distance: ${result.distanceMeters}m`);
  console.log(`  path points: ${result.path.length}`);
  console.log(`  iterations: ${result.iterations}`);
  if (result.path.length > 0) {
    console.log(`  path[0]: [${result.path[0]}]`);
    console.log(`  path[last]: [${result.path[result.path.length - 1]}]`);
  }
  console.log('');
}

// Test out-of-bounds
console.log('=== Out of bounds test ===');
const oob = findAStarRoute([86.0, 28.0], [85.3212, 27.6782]);
console.log(`Outside bounding box: found=${oob.found}, reason=${oob.reason}`);
