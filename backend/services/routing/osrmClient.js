/**
 * Low-level OSRM HTTP client.
 *
 * All functions use Node's built-in `fetch` with an AbortController timeout.
 * The `fetchFn` parameter lets tests inject a mock without patching globals.
 *
 * Coordinate order throughout: [longitude, latitude].
 */

import { getOsrmBaseUrl } from "../../config/env.js";

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Internal helper — performs one GET request with timeout.
 *
 * @param {string}   url       - Full OSRM URL.
 * @param {Function} fetchFn   - fetch-compatible function (allows test injection).
 * @param {number}   timeoutMs - Abort after this many milliseconds.
 * @returns {Promise<Object>}  - Parsed JSON response body.
 * @throws {OsrmTimeoutError|OsrmNetworkError|OsrmMalformedError|OsrmCodeError}
 */
async function osrmGet(url, fetchFn, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetchFn(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw new OsrmTimeoutError(`OSRM request timed out after ${timeoutMs} ms: ${url}`);
    }
    throw new OsrmNetworkError(`OSRM network failure: ${err.message}`);
  }

  clearTimeout(timer);

  let body;
  try {
    body = await response.json();
  } catch {
    throw new OsrmMalformedError(`OSRM returned non-JSON body for ${url}`);
  }

  if (!body || typeof body !== "object") {
    throw new OsrmMalformedError(`OSRM response body is not an object for ${url}`);
  }

  if (body.code && body.code !== "Ok") {
    throw new OsrmCodeError(`OSRM returned code "${body.code}" for ${url}`, body.code);
  }

  return body;
}

// ─── Error classes ────────────────────────────────────────────────────────────

export class OsrmTimeoutError extends Error {
  constructor(msg) {
    super(msg);
    this.name = "OsrmTimeoutError";
  }
}

export class OsrmNetworkError extends Error {
  constructor(msg) {
    super(msg);
    this.name = "OsrmNetworkError";
  }
}

export class OsrmMalformedError extends Error {
  constructor(msg) {
    super(msg);
    this.name = "OsrmMalformedError";
  }
}

export class OsrmCodeError extends Error {
  /**
   * @param {string} msg
   * @param {string} code - The OSRM code string, e.g. "NoRoute", "InvalidQuery"
   */
  constructor(msg, code) {
    super(msg);
    this.name = "OsrmCodeError";
    this.code = code;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Calls OSRM /table/v1/driving to get travel durations from multiple sources
 * to a single destination.
 *
 * The coordinate list must be built by the caller as:
 *   [ ...responderCoords, emergencyCoord ]
 *
 * sources    = 0-based indexes of the responder coordinates
 * destination = the single index of the emergency coordinate (last in list)
 *
 * @param {Array<[number,number]>} coordinates - [lng, lat] pairs; responders first, emergency last.
 * @param {string}   sourcesParam      - Semicolon-separated source indexes, e.g. "0;1;2"
 * @param {string}   destinationParam  - Single destination index, e.g. "3"
 * @param {Function} [fetchFn=fetch]   - Injectable fetch function.
 * @param {number}   [timeoutMs]       - Request timeout in ms.
 * @returns {Promise<Object>}          - Raw OSRM table response body.
 */
export async function fetchTable(
  coordinates,
  sourcesParam,
  destinationParam,
  fetchFn = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS
) {
  const base = getOsrmBaseUrl();
  const coordStr = coordinates.map(([lng, lat]) => `${lng},${lat}`).join(";");
  const url = `${base}/table/v1/driving/${coordStr}?sources=${sourcesParam}&destinations=${destinationParam}&annotations=duration`;
  return osrmGet(url, fetchFn, timeoutMs);
}

/**
 * Calls OSRM /route/v1/driving with steps, GeoJSON geometry, and full overview.
 * Direction must be responder → emergency.
 *
 * @param {[number,number]} responderCoords  - [lng, lat] of the responder.
 * @param {[number,number]} emergencyCoords  - [lng, lat] of the emergency.
 * @param {Function} [fetchFn=fetch]          - Injectable fetch function.
 * @param {number}   [timeoutMs]              - Request timeout in ms.
 * @returns {Promise<Object>}                 - Raw OSRM route response body.
 */
export async function fetchRoute(
  responderCoords,
  emergencyCoords,
  fetchFn = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS
) {
  const base = getOsrmBaseUrl();
  const [rLng, rLat] = responderCoords;
  const [eLng, eLat] = emergencyCoords;
  const url = `${base}/route/v1/driving/${rLng},${rLat};${eLng},${eLat}?steps=true&geometries=geojson&overview=full`;
  return osrmGet(url, fetchFn, timeoutMs);
}
