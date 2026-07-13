/**
 * Calculates straight-line distance in kilometers between two coordinate pairs using the Haversine formula.
 * Coordinates must be in [longitude, latitude] order.
 * 
 * @param {Array<number>} coords1 - First [longitude, latitude] pair.
 * @param {Array<number>} coords2 - Second [longitude, latitude] pair.
 * @returns {number} Distance in kilometers.
 */
export function calculateDistance(coords1, coords2) {
  // Validate coordinates arrays
  if (!Array.isArray(coords1) || coords1.length !== 2 || !Array.isArray(coords2) || coords2.length !== 2) {
    throw new Error("Coordinates must be arrays of exactly two values: [longitude, latitude]");
  }

  const [lng1, lat1] = coords1;
  const [lng2, lat2] = coords2;

  // Validate numeric types & finiteness
  if (
    typeof lng1 !== 'number' || !Number.isFinite(lng1) ||
    typeof lat1 !== 'number' || !Number.isFinite(lat1) ||
    typeof lng2 !== 'number' || !Number.isFinite(lng2) ||
    typeof lat2 !== 'number' || !Number.isFinite(lat2)
  ) {
    throw new Error("Coordinate values must be finite numbers");
  }

  // Validate ranges
  if (lng1 < -180 || lng1 > 180 || lng2 < -180 || lng2 > 180) {
    throw new Error("Longitude must be in the range [-180, 180]");
  }
  if (lat1 < -90 || lat1 > 90 || lat2 < -90 || lat2 > 90) {
    throw new Error("Latitude must be in the range [-90, 90]");
  }

  const R = 6371; // Earth's radius in km

  // Convert degrees to radians
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lng2 - lng1) * (Math.PI / 180);

  const lat1Rad = lat1 * (Math.PI / 180);
  const lat2Rad = lat2 * (Math.PI / 180);

  // Haversine formula
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
