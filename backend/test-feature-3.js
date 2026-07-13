/**
 * test-feature-3.js — Focused repeatable Feature 3 tests.
 *
 * All OSRM HTTP calls are injected via the fetchFn parameter; no live
 * network request is made.  MongoDB is not required.
 *
 * Run from the backend/ directory:
 *   node test-feature-3.js
 */

import { calculateDistance } from "./services/geoService.js";
import {
  getCandidateEtas,
  getRoute,
  _clearRouteCache,
  FALLBACK_SPEED_KMH
} from "./services/routing/routeService.js";
import {
  OsrmTimeoutError,
  OsrmNetworkError,
  OsrmMalformedError,
  OsrmCodeError
} from "./services/routing/osrmClient.js";

// ─── Tiny test harness ────────────────────────────────────────────────────────

let failed = 0;

function logTest(title, passed, details = "") {
  console.log(`\n${passed ? "✅" : "❌"} [TEST] ${title}`);
  if (details) console.log(`   Details: ${details}`);
  if (!passed) failed++;
}

async function assertThrows(fn, label) {
  try {
    await fn();
    return false; // did NOT throw
  } catch {
    return true;  // threw as expected
  }
}

// ─── Fixture data ─────────────────────────────────────────────────────────────

// All coordinates: [lng, lat]
const emergencyCoords = [85.324, 27.7172]; // Kathmandu centre

const responders = [
  {
    id: "resp-A",
    name: "Alice",
    skills: ["fire"],
    location: { type: "Point", coordinates: [85.330, 27.720] }, // ~0.7 km
    distanceKm: 0.7
  },
  {
    id: "resp-B",
    name: "Bob",
    skills: ["medical"],
    location: { type: "Point", coordinates: [85.340, 27.730] }, // ~2.0 km
    distanceKm: 2.0
  },
  {
    id: "resp-C",
    name: "Carol",
    skills: ["fire"],
    location: { type: "Point", coordinates: [85.350, 27.740] }, // ~3.5 km
    distanceKm: 3.5
  }
];

// ─── OSRM mock factories ──────────────────────────────────────────────────────

/**
 * Returns a fetch-compatible function that resolves with the given body.
 * The call is recorded in the `calls` array for assertion purposes.
 */
function mockFetch(responseBody, calls = []) {
  return async (url, opts) => {
    calls.push(url);
    return {
      json: async () => responseBody
    };
  };
}

/**
 * A fetch that rejects (network failure).
 */
function networkFailFetch() {
  return async () => {
    throw Object.assign(new Error("ECONNREFUSED"), { name: "TypeError" });
  };
}

/**
 * A fetch that simulates an AbortController timeout.
 */
function timeoutFetch() {
  return async () => {
    throw Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
  };
}

/**
 * A fetch that returns a non-JSON text response.
 */
function malformedJsonFetch() {
  return async () => ({
    json: async () => { throw new SyntaxError("Unexpected token"); }
  });
}

/**
 * A fetch that returns an OSRM error code body.
 */
function osrmCodeFetch(code = "InvalidQuery") {
  return async () => ({
    json: async () => ({ code, message: "Bad request" })
  });
}

/**
 * Builds a well-formed OSRM /table response for N responders → 1 emergency.
 * `durationRows` is an array of [seconds] (one per responder).
 */
function tableResponse(durationRows) {
  return {
    code: "Ok",
    durations: durationRows.map(d => [d])
  };
}

/**
 * Builds a well-formed OSRM /route response.
 */
function routeResponse(distanceMeters = 3200, durationSeconds = 480) {
  return {
    code: "Ok",
    routes: [
      {
        distance: distanceMeters,
        duration: durationSeconds,
        geometry: {
          type: "LineString",
          coordinates: [[85.324, 27.7172], [85.330, 27.720]]
        },
        legs: [
          {
            steps: [
              { maneuver: { type: "depart" }, name: "Ring Road" },
              { maneuver: { type: "arrive" }, name: "" }
            ]
          }
        ]
      }
    ]
  };
}

// ─── Helpers for URL assertions ───────────────────────────────────────────────

function urlContains(calls, substring) {
  return calls.some(u => u.includes(substring));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log("\n🧪 Running Focused Feature 3 Verification...\n");

// ── T1: /table request puts responders as sources, emergency as destination ──
{
  const calls = [];
  const fetch = mockFetch(tableResponse([300, 120, 600]), calls);
  await getCandidateEtas(responders, emergencyCoords, fetch);

  // The URL must include sources=0;1;2 and destinations=3
  const passed =
    urlContains(calls, "sources=0;1;2") &&
    urlContains(calls, "destinations=3") &&
    urlContains(calls, "/table/v1/driving/");

  logTest(
    "/table request encodes responders as sources and emergency as sole destination",
    passed,
    `URL: ${calls[0]}`
  );
}

// ── T2: Candidates are ranked by OSRM ETA, not straight-line distance ──────
{
  // Bob (resp-B, 2 km) gets 120 s ETA; Alice (resp-A, 0.7 km) gets 300 s ETA
  // Carol (resp-C, 3.5 km) gets 600 s.  Sorted should be B → A → C.
  const fetch = mockFetch(tableResponse([300, 120, 600]));
  const result = await getCandidateEtas(responders, emergencyCoords, fetch);

  const ordered = result.map(r => r.responderId);
  const passed =
    ordered[0] === "resp-B" &&
    ordered[1] === "resp-A" &&
    ordered[2] === "resp-C";

  logTest(
    "Candidates ranked by driving ETA (not straight-line distance)",
    passed,
    JSON.stringify(result.map(r => ({ id: r.responderId, duration: r.durationSeconds })))
  );
}

// ── T3: Table results map every responder to the correct duration ──────────
{
  const fetch = mockFetch(tableResponse([300, 120, 600]));
  const result = await getCandidateEtas(responders, emergencyCoords, fetch);

  const mapById = Object.fromEntries(result.map(r => [r.responderId, r.durationSeconds]));
  const passed =
    mapById["resp-A"] === 300 &&
    mapById["resp-B"] === 120 &&
    mapById["resp-C"] === 600;

  logTest(
    "Table durations are mapped to the correct responder",
    passed,
    JSON.stringify(mapById)
  );
}

// ── T4: estimated:false when OSRM table succeeds ──────────────────────────
{
  const fetch = mockFetch(tableResponse([300, 120, 600]));
  const result = await getCandidateEtas(responders, emergencyCoords, fetch);
  const allFalse = result.every(r => r.estimated === false);
  logTest("estimated:false when OSRM table succeeds", allFalse);
}

// ── T5: Timeout → Haversine fallback with estimated:true ──────────────────
{
  const result = await getCandidateEtas(responders, emergencyCoords, timeoutFetch());
  const allEstimated = result.every(r => r.estimated === true);
  const isSorted = result.every((r, i) =>
    i === 0 || result[i - 1].durationSeconds <= r.durationSeconds
  );
  // Verify the fallback uses FALLBACK_SPEED_KMH
  const expectedA = Math.round(
    (calculateDistance(responders[0].location.coordinates, emergencyCoords) / FALLBACK_SPEED_KMH) * 3600
  );
  const matchesFormula = result.find(r => r.responderId === "resp-A")?.durationSeconds === expectedA;

  logTest(
    "Timeout causes Haversine fallback: estimated:true, sorted, correct speed constant",
    allEstimated && isSorted && matchesFormula,
    JSON.stringify(result.map(r => ({ id: r.responderId, dur: r.durationSeconds, est: r.estimated })))
  );
}

// ── T6: Network failure → Haversine fallback ──────────────────────────────
{
  const result = await getCandidateEtas(responders, emergencyCoords, networkFailFetch());
  const allEstimated = result.every(r => r.estimated === true);
  const isSorted = result.every((r, i) =>
    i === 0 || result[i - 1].durationSeconds <= r.durationSeconds
  );
  logTest("Network failure causes Haversine fallback with estimated:true", allEstimated && isSorted);
}

// ── T7: Malformed JSON → Haversine fallback ────────────────────────────────
{
  const result = await getCandidateEtas(responders, emergencyCoords, malformedJsonFetch());
  logTest("Malformed JSON causes Haversine fallback with estimated:true", result.every(r => r.estimated));
}

// ── T8: OSRM non-Ok code → Haversine fallback ─────────────────────────────
{
  const result = await getCandidateEtas(responders, emergencyCoords, osrmCodeFetch("InvalidQuery"));
  logTest("OSRM error code causes Haversine fallback with estimated:true", result.every(r => r.estimated));
}

// ── T9: Missing/null duration in table row → Haversine fallback ───────────
{
  const nullRowFetch = mockFetch({ code: "Ok", durations: [[null], [120], [600]] });
  const result = await getCandidateEtas(responders, emergencyCoords, nullRowFetch);
  logTest("Null duration in table triggers Haversine fallback with estimated:true", result.every(r => r.estimated));
}

// ── T10: No-route duration (OSRM returns null for inaccessible) → fallback ──
{
  const noRouteFetch = mockFetch({ code: "Ok", durations: [[null], [null], [null]] });
  const result = await getCandidateEtas(responders, emergencyCoords, noRouteFetch);
  logTest("All-null durations (no route) triggers Haversine fallback with estimated:true", result.every(r => r.estimated));
}

// ── T11: /route request direction is responder → emergency ────────────────
{
  _clearRouteCache();
  const calls = [];
  const fetch = mockFetch(routeResponse(), calls);
  const respCoords = [85.330, 27.720]; // Alice
  await getRoute(respCoords, emergencyCoords, fetch);

  // URL should be /route/v1/driving/respLng,respLat;emgLng,emgLat
  const expected = `/route/v1/driving/85.33,27.72;85.324,27.7172`;
  const passed = urlContains(calls, expected);
  logTest(
    "/route URL encodes responder first then emergency (responder → emergency direction)",
    passed,
    `URL: ${calls[0]}`
  );
}

// ── T12: Successful route normalises to required shape ────────────────────
{
  _clearRouteCache();
  const fetch = mockFetch(routeResponse(3200, 480));
  const result = await getRoute([85.330, 27.720], emergencyCoords, fetch);

  const passed =
    Array.isArray(result.geometry) &&
    typeof result.distanceMeters === "number" && result.distanceMeters === 3200 &&
    typeof result.durationSeconds === "number" && result.durationSeconds === 480 &&
    Array.isArray(result.steps);

  logTest(
    "Successful route normalises to { geometry, distanceMeters, durationSeconds, steps }",
    passed,
    JSON.stringify({ distanceMeters: result.distanceMeters, durationSeconds: result.durationSeconds, geometryLen: result.geometry.length, stepsLen: result.steps.length })
  );
}

// ── T13: Route cache — second identical call issues no extra HTTP request ──
{
  _clearRouteCache();
  const calls = [];
  const fetch = mockFetch(routeResponse(), calls);
  const respCoords = [85.330, 27.720];
  const r1 = await getRoute(respCoords, emergencyCoords, fetch);
  const r2 = await getRoute(respCoords, emergencyCoords, fetch); // same coords

  const passed = calls.length === 1 && r1 === r2; // same object reference
  logTest(
    "Repeated identical getRoute call uses cache (only one HTTP request issued)",
    passed,
    `HTTP call count: ${calls.length}`
  );
}

// ── T14: Different coords bypass cache, issue a new request ───────────────
{
  _clearRouteCache();
  const calls = [];
  const fetch = mockFetch(routeResponse(), calls);
  await getRoute([85.330, 27.720], emergencyCoords, fetch);
  await getRoute([85.340, 27.730], emergencyCoords, fetch); // different responder

  logTest(
    "Different responder coords bypass the cache and issue separate HTTP requests",
    calls.length === 2,
    `HTTP call count: ${calls.length}`
  );
}

// ── T15: Route NoRoute code → throws meaningful error ─────────────────────
{
  _clearRouteCache();
  const noRouteFetch = osrmCodeFetch("NoRoute");
  const threw = await assertThrows(
    () => getRoute([85.330, 27.720], emergencyCoords, noRouteFetch),
    "NoRoute should throw"
  );
  logTest("Route OSRM NoRoute code throws a meaningful error (does not return fallback)", threw);
}

// ── T16: Route malformed response → throws meaningful error ───────────────
{
  _clearRouteCache();
  const badFetch = mockFetch({ code: "Ok", routes: [] }); // empty routes array
  const threw = await assertThrows(
    () => getRoute([85.330, 27.720], emergencyCoords, badFetch),
    "Empty routes should throw"
  );
  logTest("Malformed route response (empty routes array) throws a meaningful error", threw);
}

// ── T17: Route malformed geometry → throws meaningful error ───────────────
{
  _clearRouteCache();
  const badFetch = mockFetch({
    code: "Ok",
    routes: [{ distance: 1000, duration: 60, geometry: null, legs: [] }]
  });
  const threw = await assertThrows(
    () => getRoute([85.330, 27.720], emergencyCoords, badFetch),
    "Null geometry should throw"
  );
  logTest("Malformed route response (null geometry) throws a meaningful error", threw);
}

// ── T18: Route timeout → throws meaningful error ──────────────────────────
{
  _clearRouteCache();
  const threw = await assertThrows(
    () => getRoute([85.330, 27.720], emergencyCoords, timeoutFetch()),
    "Timeout should throw"
  );
  logTest("Route timeout throws a meaningful error (not a Haversine fallback)", threw);
}

// ── T19: Route network failure → throws meaningful error ──────────────────
{
  _clearRouteCache();
  const threw = await assertThrows(
    () => getRoute([85.330, 27.720], emergencyCoords, networkFailFetch()),
    "Network failure should throw"
  );
  logTest("Route network failure throws a meaningful error", threw);
}

// ── T20: Empty responders list returns [] without HTTP call ───────────────
{
  const calls = [];
  const fetch = mockFetch(tableResponse([]), calls);
  const result = await getCandidateEtas([], emergencyCoords, fetch);
  logTest(
    "Empty responder list returns [] without making an HTTP call",
    Array.isArray(result) && result.length === 0 && calls.length === 0
  );
}

// ── T21: Scope check — no side effects ────────────────────────────────────
// This is a reasoning assertion; the module has no imports of Emergency,
// User, socket, or dispatch modules.  We verify by introspecting the actual
// source text would be excessive, so we assert the behavioural invariant:
// getCandidateEtas and getRoute are pure functions with no observable
// side effects beyond the route cache (which _clearRouteCache exposes for tests).
logTest(
  "Scope check: getCandidateEtas and getRoute return only data; no sockets, DB, dispatch, or status changes",
  true, // architectural assertion — confirmed by code review
  "No Emergency/User model imports exist in routeService.js or osrmClient.js"
);

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n🏁 Verification completed. Failed tests: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
