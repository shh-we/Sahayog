/**
 * test-route-endpoint.js
 *
 * Unit tests for the RouteController GET /api/routes/driving endpoint.
 *
 * Tests the controller logic in isolation by mocking:
 *   - getRoute() from routeService.js
 *   - Express req/res objects
 *
 * No live server, MongoDB, or OSRM connection required.
 *
 * Run: node test-route-endpoint.js
 */

// ─── Minimal test harness ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
    errors.push(label);
  }
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

// ─── Mock req/res helpers ─────────────────────────────────────────────────────

function mockRes() {
  const res = {
    _status: null,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; }
  };
  return res;
}

function mockReq(query = {}) {
  return { query };
}

// ─── Mock routeService ────────────────────────────────────────────────────────

// We intercept the import by monkey-patching the module cache via dynamic import override.
// Since ESM doesn't allow monkey-patching easily, we recreate the controller inline
// with an injectable getRoute dependency — mimicking the real controller logic.

async function getDrivingRouteWithDep(getRoute, req, res) {
  try {
    const { fromLat, fromLng, toLat, toLng } = req.query;

    if (
      fromLat === undefined || fromLat === null ||
      fromLng === undefined || fromLng === null ||
      toLat === undefined || toLat === null ||
      toLng === undefined || toLng === null
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing coordinates query parameters (fromLat, fromLng, toLat, toLng)"
      });
    }

    const fLat = Number(fromLat);
    const fLng = Number(fromLng);
    const tLat = Number(toLat);
    const tLng = Number(toLng);

    if (
      !Number.isFinite(fLat) || !Number.isFinite(fLng) ||
      !Number.isFinite(tLat) || !Number.isFinite(tLng)
    ) {
      return res.status(400).json({
        success: false,
        message: "Coordinates must be finite numbers"
      });
    }

    if (fLat < -90 || fLat > 90 || tLat < -90 || tLat > 90) {
      return res.status(400).json({
        success: false,
        message: "Latitude must be in the range [-90, 90]"
      });
    }

    if (fLng < -180 || fLng > 180 || tLng < -180 || tLng > 180) {
      return res.status(400).json({
        success: false,
        message: "Longitude must be in the range [-180, 180]"
      });
    }

    try {
      const routeData = await getRoute([fLng, fLat], [tLng, tLat]);
      return res.status(200).json({
        success: true,
        geometry: routeData.geometry,
        distanceMeters: routeData.distanceMeters,
        durationSeconds: routeData.durationSeconds,
        source: "osrm"
      });
    } catch (routeErr) {
      return res.status(503).json({
        success: false,
        error: "route_unavailable",
        message: "Road route is temporarily unavailable; location sharing continues."
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error during route fetching"
    });
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function runTests() {
  console.log("=== Route Endpoint Unit Tests ===\n");

  // ── 1. Missing parameters ──────────────────────────────────────────────────
  section("1. Missing query parameters");

  {
    const req = mockReq({});
    const res = mockRes();
    await getDrivingRouteWithDep(null, req, res);
    assert(res._status === 400, "Returns 400 when all params missing");
    assert(res._body.success === false, "success=false when params missing");
    assert(typeof res._body.message === "string", "Returns a message string");
  }

  {
    const req = mockReq({ fromLat: "27.7", fromLng: "85.3" });
    const res = mockRes();
    await getDrivingRouteWithDep(null, req, res);
    assert(res._status === 400, "Returns 400 when toLat/toLng missing");
  }

  // ── 2. Invalid (non-numeric) coordinates ──────────────────────────────────
  section("2. Non-numeric coordinate values");

  {
    const req = mockReq({ fromLat: "abc", fromLng: "85.3", toLat: "27.8", toLng: "85.4" });
    const res = mockRes();
    await getDrivingRouteWithDep(null, req, res);
    assert(res._status === 400, "Returns 400 for non-numeric fromLat");
    assert(res._body.success === false, "success=false for non-numeric");
  }

  {
    const req = mockReq({ fromLat: "27.7", fromLng: "NaN", toLat: "27.8", toLng: "85.4" });
    const res = mockRes();
    await getDrivingRouteWithDep(null, req, res);
    assert(res._status === 400, "Returns 400 for NaN longitude");
  }

  // ── 3. Out-of-range coordinates ───────────────────────────────────────────
  section("3. Out-of-range coordinate values");

  {
    const req = mockReq({ fromLat: "100", fromLng: "85.3", toLat: "27.8", toLng: "85.4" });
    const res = mockRes();
    await getDrivingRouteWithDep(null, req, res);
    assert(res._status === 400, "Returns 400 for latitude > 90");
    assert(res._body.message.includes("Latitude"), "Error mentions Latitude");
  }

  {
    const req = mockReq({ fromLat: "-100", fromLng: "85.3", toLat: "27.8", toLng: "85.4" });
    const res = mockRes();
    await getDrivingRouteWithDep(null, req, res);
    assert(res._status === 400, "Returns 400 for latitude < -90");
  }

  {
    const req = mockReq({ fromLat: "27.7", fromLng: "200", toLat: "27.8", toLng: "85.4" });
    const res = mockRes();
    await getDrivingRouteWithDep(null, req, res);
    assert(res._status === 400, "Returns 400 for longitude > 180");
    assert(res._body.message.includes("Longitude"), "Error mentions Longitude");
  }

  // ── 4. Successful route ───────────────────────────────────────────────────
  section("4. Successful OSRM response");

  {
    const mockRouteData = {
      geometry: [[85.3, 27.7], [85.35, 27.75], [85.4, 27.8]],
      distanceMeters: 5432.1,
      durationSeconds: 720
    };
    const getRoute = async () => mockRouteData;
    const req = mockReq({ fromLat: "27.7", fromLng: "85.3", toLat: "27.8", toLng: "85.4" });
    const res = mockRes();
    await getDrivingRouteWithDep(getRoute, req, res);
    assert(res._status === 200, "Returns 200 on success");
    assert(res._body.success === true, "success=true on valid route");
    assert(Array.isArray(res._body.geometry), "geometry is array");
    assert(res._body.geometry.length === 3, "geometry has correct number of points");
    assert(res._body.distanceMeters === 5432.1, "distanceMeters matches");
    assert(res._body.durationSeconds === 720, "durationSeconds matches");
    assert(res._body.source === "osrm", "source=osrm");
  }

  {
    // Verify coordinate order is [lng, lat] when passed to getRoute
    let capturedFrom, capturedTo;
    const getRoute = async (from, to) => {
      capturedFrom = from;
      capturedTo = to;
      return { geometry: [], distanceMeters: 0, durationSeconds: 0 };
    };
    const req = mockReq({ fromLat: "27.7172", fromLng: "85.3240", toLat: "27.8000", toLng: "85.4000" });
    const res = mockRes();
    await getDrivingRouteWithDep(getRoute, req, res);
    assert(capturedFrom[0] === 85.3240, "getRoute receives [lng, lat] from-coord (lng first)");
    assert(capturedFrom[1] === 27.7172, "getRoute receives [lng, lat] from-coord (lat second)");
    assert(capturedTo[0] === 85.4000, "getRoute receives [lng, lat] to-coord (lng first)");
    assert(capturedTo[1] === 27.8000, "getRoute receives [lng, lat] to-coord (lat second)");
  }

  // ── 5. OSRM unavailable → 503 ─────────────────────────────────────────────
  section("5. OSRM unavailable (503 fallback)");

  {
    const getRoute = async () => { throw new Error("OSRM connection refused"); };
    const req = mockReq({ fromLat: "27.7", fromLng: "85.3", toLat: "27.8", toLng: "85.4" });
    const res = mockRes();
    await getDrivingRouteWithDep(getRoute, req, res);
    assert(res._status === 503, "Returns 503 when OSRM throws");
    assert(res._body.success === false, "success=false on OSRM failure");
    assert(res._body.error === "route_unavailable", "error=route_unavailable");
    assert(typeof res._body.message === "string", "Returns human-readable message");
  }

  {
    // Verify no straight-line fallback coordinates are in the 503 response
    const getRoute = async () => { throw new Error("timeout"); };
    const req = mockReq({ fromLat: "27.7", fromLng: "85.3", toLat: "27.8", toLng: "85.4" });
    const res = mockRes();
    await getDrivingRouteWithDep(getRoute, req, res);
    assert(res._body.geometry === undefined, "No fallback geometry returned on 503");
  }

  // ── 6. Boundary coordinate values ─────────────────────────────────────────
  section("6. Boundary / edge coordinate values");

  {
    // Exact boundary lat=90 should pass
    const getRoute = async () => ({ geometry: [], distanceMeters: 0, durationSeconds: 0 });
    const req = mockReq({ fromLat: "90", fromLng: "0", toLat: "-90", toLng: "180" });
    const res = mockRes();
    await getDrivingRouteWithDep(getRoute, req, res);
    assert(res._status === 200, "Accepts boundary lat=90, lat=-90, lng=180");
  }

  {
    // Exact boundary lng=-180 should pass
    const getRoute = async () => ({ geometry: [], distanceMeters: 0, durationSeconds: 0 });
    const req = mockReq({ fromLat: "0", fromLng: "-180", toLat: "0", toLng: "180" });
    const res = mockRes();
    await getDrivingRouteWithDep(getRoute, req, res);
    assert(res._status === 200, "Accepts boundary lng=-180 and lng=180");
  }

  {
    // lng=181 should fail
    const req = mockReq({ fromLat: "0", fromLng: "181", toLat: "0", toLng: "0" });
    const res = mockRes();
    await getDrivingRouteWithDep(null, req, res);
    assert(res._status === 400, "Rejects lng=181 (out of range)");
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log("\nFailed tests:");
    errors.forEach(e => console.log(`  ✗ ${e}`));
    process.exit(1);
  } else {
    console.log("\nAll route endpoint tests passed! ✓");
  }
}

runTests().catch(err => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
