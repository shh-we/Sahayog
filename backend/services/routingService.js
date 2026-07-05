// import fetch from "node-fetch";

// // ── Haversine distance between two coordinates ────────────────
// // Used as A* heuristic and for edge weights
// function haversineDistance(coords1, coords2) {
//   const R = 6371; // Earth radius in km

//   const lat1 = coords1[1];
//   const lon1 = coords1[0];
//   const lat2 = coords2[1];
//   const lon2 = coords2[0];

//   const dLat = (lat2 - lat1) * (Math.PI / 180);
//   const dLon = (lon2 - lon1) * (Math.PI / 180);

//   const a =
//     Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//     Math.cos(lat1 * (Math.PI / 180)) *
//     Math.cos(lat2 * (Math.PI / 180)) *
//     Math.sin(dLon / 2) *
//     Math.sin(dLon / 2);

//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//   return R * c;
// }

// // ── Step 1: Fetch road waypoints from OSRM ───────────────────
// async function fetchRoadNetwork(startCoords, endCoords) {
//   const url = `http://router.project-osrm.org/route/v1/driving/${startCoords[0]},${startCoords[1]};${endCoords[0]},${endCoords[1]}?steps=true&geometries=geojson&overview=full`;

//   const response = await fetch(url);
//   const data = await response.json();

//   if (data.code !== "Ok") {
//     throw new Error("OSRM could not find a route");
//   }

//   // Extract all coordinate points from each step
//   const waypoints = [];
//   const steps = data.routes[0].legs[0].steps;

//   steps.forEach((step) => {
//     step.geometry.coordinates.forEach((coord) => {
//       waypoints.push(coord); // [longitude, latitude]
//     });
//   });

//   return waypoints;
// }

// // ── Step 2: Build graph from waypoints ───────────────────────
// // Each waypoint = node
// // Distance between consecutive waypoints = edge weight
// function buildGraph(waypoints) {
//   const graph = {};

//   waypoints.forEach((coord, index) => {
//     const key = coord.toString();

//     if (!graph[key]) graph[key] = [];

//     if (index > 0) {
//       const prevKey = waypoints[index - 1].toString();
//       const dist = haversineDistance(coord, waypoints[index - 1]);

//       // Connect current node to previous node (bidirectional)
//       graph[key].push({ node: prevKey, cost: dist });
//       graph[prevKey].push({ node: key, cost: dist });
//     }
//   });

//   return graph;
// }

// // ── Step 3: A* algorithm ──────────────────────────────────────
// function aStar(graph, waypoints, startCoords, endCoords) {

//   // Find closest waypoint to start coordinates
//   const startKey = waypoints
//     .reduce((closest, coord) => {
//       return haversineDistance(coord, startCoords) 
//         haversineDistance(closest, startCoords)
//         ? coord
//         : closest;
//     })
//     .toString();

//   // Find closest waypoint to end coordinates
//   const endKey = waypoints
//     .reduce((closest, coord) => {
//       return haversineDistance(coord, endCoords) 
//         haversineDistance(closest, endCoords)
//         ? coord
//         : closest;
//     })
//     .toString();

//   // Open set — nodes yet to be explored
//   const openSet = new Set([startKey]);

//   // Track path — where did we come from to reach each node
//   const cameFrom = {};

//   // gScore — actual cost from start to this node
//   const gScore = { [startKey]: 0 };

//   // fScore — gScore + heuristic (estimated cost to end)
//   const fScore = {
//     [startKey]: haversineDistance(
//       startKey.split(",").map(Number),
//       endKey.split(",").map(Number)
//     )
//   };

//   while (openSet.size > 0) {
//     // Pick node with lowest fScore from open set
//     const current = [...openSet].reduce((lowest, node) =>
//       (fScore[node] || Infinity) < (fScore[lowest] || Infinity)
//         ? node
//         : lowest
//     );

//     // Reached destination
//     if (current === endKey) {
//       return reconstructPath(cameFrom, current);
//     }

//     openSet.delete(current);

//     // Explore neighbors
//     const neighbors = graph[current] || [];

//     neighbors.forEach(({ node: neighbor, cost }) => {
//       const tentativeGScore = (gScore[current] || Infinity) + cost;

//       if (tentativeGScore < (gScore[neighbor] || Infinity)) {
//         // This is a better path to neighbor — record it
//         cameFrom[neighbor] = current;
//         gScore[neighbor] = tentativeGScore;
//         fScore[neighbor] =
//           tentativeGScore +
//           haversineDistance(
//             neighbor.split(",").map(Number),
//             endKey.split(",").map(Number)
//           );
//         openSet.add(neighbor);
//       }
//     });
//   }

//   throw new Error("A* could not find a path");
// }

// // ── Step 4: Reconstruct path from cameFrom map ───────────────
// function reconstructPath(cameFrom, current) {
//   const path = [current.split(",").map(Number)];

//   while (cameFrom[current]) {
//     current = cameFrom[current];
//     path.unshift(current.split(",").map(Number));
//   }

//   return path; // array of [lng, lat] from start to end
// }

// // ── Main export ───────────────────────────────────────────────
// // Called from responderController when responder accepts emergency
// export async function getRoute(startCoords, endCoords) {
//   // 1. Get road waypoints from OSRM
//   const waypoints = await fetchRoadNetwork(startCoords, endCoords);

//   // 2. Build graph from waypoints
//   const graph = buildGraph(waypoints);

//   // 3. Run A* to find optimal path
//   const path = aStar(graph, waypoints, startCoords, endCoords);

//   // 4. Calculate total distance
//   let totalDistance = 0;
//   for (let i = 0; i < path.length - 1; i++) {
//     totalDistance += haversineDistance(path[i], path[i + 1]);
//   }

//   return {
//     path,                                               // [[lng,lat], [lng,lat], ...]
//     totalDistance: parseFloat(totalDistance.toFixed(2)), // km
//     totalNodes: path.length
//   };
// }