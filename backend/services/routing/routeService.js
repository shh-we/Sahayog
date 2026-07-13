/**
 * routeService.js
 *
 * Provides:
 *   getCandidateEtas(responders, emergencyCoords, fetchFn?)
 *     — ranks a Feature 2 shortlist by OSRM driving ETA, falling back to
 *       Haversine-based ETA when OSRM is unavailable.
 *
 *   getRoute(responderCoords, emergencyCoords, fetchFn?)
 *     — returns a normalised OSRM route for one responder → emergency leg.
 *       Results are cached in memory; identical coordinate pairs reuse the
 *       cached result without a second HTTP request.
 *
 * Coordinate order everywhere: [longitude, latitude].
 * No sockets, no database writes, no status changes, no dispatch offers.
 */

import { calculateDistance } from "../geoService.js";
import {
  fetchTable,
  fetchRoute,
  OsrmTimeoutError,
  OsrmNetworkError,
  OsrmMalformedError,
  OsrmCodeError
} from "./osrmClient.js";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Assumed average driving speed used for Haversine-based ETA fallback (km/h). */
export const FALLBACK_SPEED_KMH = 40;

// ─── Route cache ──────────────────────────────────────────────────────────────

/** In-memory cache: deterministic key → normalised route object. */
const routeCache = new Map();

/**
 * Builds a deterministic cache key from two coordinate pairs.
 * @param {[number,number]} responderCoords
 * @param {[number,number]} emergencyCoords
 * @returns {string}
 */
function routeCacheKey(responderCoords, emergencyCoords) {
  return `${responderCoords[0]},${responderCoords[1]};${emergencyCoords[0]},${emergencyCoords[1]}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extracts a validated [lng, lat] pair from a candidate's location field.
 * Supports both a GeoJSON Point object and a plain two-element array.
 *
 * @param {Object|Array} location
 * @returns {[number,number]}
 * @throws {Error} if the location is not a usable coordinate pair.
 */
function extractCoords(location) {
  if (Array.isArray(location) && location.length === 2) {
    return location;
  }
  if (location && Array.isArray(location.coordinates) && location.coordinates.length === 2) {
    return location.coordinates;
  }
  throw new Error(`Invalid responder location format: ${JSON.stringify(location)}`);
}

/**
 * Computes a Haversine-based ETA in seconds at FALLBACK_SPEED_KMH.
 *
 * @param {[number,number]} responderCoords
 * @param {[number,number]} emergencyCoords
 * @returns {number} ETA in whole seconds.
 */
function haversineEtaSeconds(responderCoords, emergencyCoords) {
  const distKm = calculateDistance(responderCoords, emergencyCoords);
  return Math.round((distKm / FALLBACK_SPEED_KMH) * 3600);
}

// ─── getCandidateEtas ─────────────────────────────────────────────────────────

/**
 * Ranks a Feature 2 shortlist by OSRM driving ETA.
 *
 * If OSRM /table fails for any reason (timeout, network, malformed response,
 * non-Ok OSRM code, missing or null duration values, or no-route entries)
 * the function falls back to Haversine-estimated ETAs sorted ascending,
 * with `estimated: true` on every result.
 *
 * @param {Array<{id:string, name:string, skills:string[], location:Object|Array, distanceKm:number}>} responders
 *   - Feature 2 candidate list.  Each item must have `id` and `location`.
 * @param {[number,number]|{coordinates:[number,number]}} emergencyLocation
 *   - Emergency location as [lng, lat] array or GeoJSON Point.
 * @param {Function} [fetchFn=fetch]
 *   - Injectable fetch implementation (for testing without live OSRM).
 *
 * @returns {Promise<Array<{responderId:string, name:string, durationSeconds:number, estimated:boolean}>>}
 *   Sorted ascending by durationSeconds.
 */
export async function getCandidateEtas(
  responders,
  emergencyLocation,
  fetchFn = fetch
) {
  if (!Array.isArray(responders) || responders.length === 0) {
    return [];
  }

  // Resolve emergency coordinates
  const emergencyCoords = Array.isArray(emergencyLocation)
    ? emergencyLocation
    : emergencyLocation.coordinates;

  // Validate emergency coords through geoService
  calculateDistance(emergencyCoords, emergencyCoords);

  // Extract and validate every responder's coordinates up front
  const responderCoords = responders.map((r, idx) => {
    try {
      const coords = extractCoords(r.location);
      calculateDistance(coords, coords); // delegate validation to geoService
      return coords;
    } catch (err) {
      throw new Error(`Responder at index ${idx} has an invalid location: ${err.message}`);
    }
  });

  // Build the coordinate list: responders first, emergency last
  const allCoords = [...responderCoords, emergencyCoords];
  const sourcesParam = responders.map((_, i) => i).join(";");
  const destinationParam = String(responders.length); // index of emergency

  // ─── Attempt OSRM /table ───────────────────────────────────────────────────
  try {
    const tableResult = await fetchTable(
      allCoords,
      sourcesParam,
      destinationParam,
      fetchFn
    );

    // Validate response shape
    if (
      !tableResult ||
      !Array.isArray(tableResult.durations) ||
      tableResult.durations.length !== responders.length
    ) {
      throw new OsrmMalformedError("OSRM table durations array has unexpected shape");
    }

    // Each row has one destination column (index 0 since we asked for one destination)
    const ranked = responders
      .map((r, i) => {
        const row = tableResult.durations[i];
        if (!Array.isArray(row) || row.length === 0) {
          throw new OsrmMalformedError(`OSRM table row ${i} is malformed`);
        }
        const duration = row[0];
        if (duration === null || duration === undefined || !Number.isFinite(duration)) {
          throw new OsrmMalformedError(`OSRM returned null/missing duration for responder ${i}`);
        }
        return {
          responderId: r.id,
          name: r.name,
          durationSeconds: Math.round(duration),
          estimated: false
        };
      })
      .sort((a, b) => a.durationSeconds - b.durationSeconds);

    return ranked;

  } catch (err) {
    // Any OSRM error → fall back to Haversine estimation
    const isExpectedError =
      err instanceof OsrmTimeoutError ||
      err instanceof OsrmNetworkError ||
      err instanceof OsrmMalformedError ||
      err instanceof OsrmCodeError;

    if (!isExpectedError) {
      // Unexpected programming error — propagate rather than silently swallow
      throw err;
    }

    console.warn(`[routeService] OSRM /table failed (${err.name}): ${err.message}. Using Haversine fallback.`);

    const fallback = responders
      .map((r, i) => ({
        responderId: r.id,
        name: r.name,
        durationSeconds: haversineEtaSeconds(responderCoords[i], emergencyCoords),
        estimated: true
      }))
      .sort((a, b) => a.durationSeconds - b.durationSeconds);

    return fallback;
  }
}

// ─── getRoute ─────────────────────────────────────────────────────────────────

/**
 * Returns a normalised OSRM route from responder to emergency.
 *
 * Results are cached in-memory using a deterministic key derived from the
 * two coordinate pairs.  Repeated identical calls return the cached result
 * without issuing a second HTTP request.
 *
 * Throws a descriptive error for NoRoute, malformed response, timeout, or
 * network failure.  Does NOT fall back to Haversine — a route must be real.
 *
 * @param {[number,number]|{coordinates:[number,number]}} responderLocation
 * @param {[number,number]|{coordinates:[number,number]}} emergencyLocation
 * @param {Function} [fetchFn=fetch]
 *
 * @returns {Promise<{
 *   geometry: Array<[number,number]>,
 *   distanceMeters: number,
 *   durationSeconds: number,
 *   steps: Array<Object>
 * }>}
 */
export async function getRoute(
  responderLocation,
  emergencyLocation,
  fetchFn = fetch
) {
  const responderCoords = Array.isArray(responderLocation)
    ? responderLocation
    : responderLocation.coordinates;

  const emergencyCoords = Array.isArray(emergencyLocation)
    ? emergencyLocation
    : emergencyLocation.coordinates;

  // Validate both through geoService
  calculateDistance(responderCoords, responderCoords);
  calculateDistance(emergencyCoords, emergencyCoords);

  // Check cache first
  const cacheKey = routeCacheKey(responderCoords, emergencyCoords);
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey);
  }

  // Fetch from OSRM
  let rawBody;
  try {
    rawBody = await fetchRoute(responderCoords, emergencyCoords, fetchFn);
  } catch (err) {
    // Re-wrap with a clear routing error message so callers don't see raw OSRM internals
    throw new Error(`Route unavailable (${err.name || "Error"}): ${err.message}`);
  }

  // Validate and normalise
  if (
    !rawBody ||
    !Array.isArray(rawBody.routes) ||
    rawBody.routes.length === 0
  ) {
    throw new Error("Route unavailable: OSRM returned no routes");
  }

  const route = rawBody.routes[0];

  if (
    !route ||
    !route.geometry ||
    !Array.isArray(route.geometry.coordinates) ||
    typeof route.distance !== "number" ||
    typeof route.duration !== "number"
  ) {
    throw new Error("Route unavailable: OSRM route response is malformed");
  }

  const normalised = {
    geometry: route.geometry.coordinates,        // already [[lng, lat], ...]
    distanceMeters: route.distance,
    durationSeconds: Math.round(route.duration),
    steps: Array.isArray(route.legs?.[0]?.steps) ? route.legs[0].steps : []
  };

  routeCache.set(cacheKey, normalised);
  return normalised;
}

// ─── Test helper ──────────────────────────────────────────────────────────────

/**
 * Clears the route cache.  Only for use in tests.
 */
export function _clearRouteCache() {
  routeCache.clear();
}
