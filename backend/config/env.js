/**
 * OSRM configuration access and validation.
 * Centralises all OSRM URL construction so no service hard-codes paths.
 */

/**
 * Returns the OSRM base URL from the environment, with any trailing slash stripped.
 * Falls back to "http://router.project-osrm.org" when the variable is not set,
 * but callers may choose to skip real HTTP calls (e.g. in tests).
 *
 * @returns {string} Normalised base URL with no trailing slash.
 */
export function getOsrmBaseUrl() {
  const raw = process.env.OSRM_BASE_URL || "http://router.project-osrm.org";
  return raw.replace(/\/+$/, "");
}
