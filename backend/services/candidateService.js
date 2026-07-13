import User from "../models/User.js";
import Emergency from "../models/Emergency.js";
import { calculateDistance } from "./geoService.js";

/**
 * Finds eligible responder candidates for a given emergency.
 * 
 * @param {Object} params
 * @param {Array<number>|Object} params.emergencyLocation - [longitude, latitude] or GeoJSON Point
 * @param {Array<string>} params.requiredSkills - List of required skills
 * @param {number} params.radiusKm - Radius tier in kilometers (must be 5, 10, 15, or 20)
 * @param {number} [params.limit=5] - Maximum number of candidates to return (must be positive integer)
 * @returns {Promise<Array<Object>>} List of eligible candidates
 */
export async function findEligibleCandidates({
  emergencyLocation,
  requiredSkills,
  radiusKm,
  limit = 5
}) {
  // 1. Validate radiusKm
  if (typeof radiusKm !== 'number' || !Number.isFinite(radiusKm) || radiusKm <= 0) {
    throw new Error("Radius must be a positive finite number");
  }
  const validTiers = [5, 10, 15, 20];
  if (!validTiers.includes(radiusKm)) {
    throw new Error("Radius must be one of the valid tiers: 5, 10, 15, or 20");
  }

  // 2. Validate requiredSkills
  if (!Array.isArray(requiredSkills) || requiredSkills.length === 0) {
    throw new Error("Required skills must be a non-empty array");
  }
  const validSkills = ['medical', 'fire', 'security', 'general'];
  for (const skill of requiredSkills) {
    if (typeof skill !== 'string' || !validSkills.includes(skill)) {
      throw new Error(`Invalid skill: ${skill}`);
    }
  }

  // 3. Validate limit
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit <= 0) {
    throw new Error("Limit must be a positive integer");
  }

  // 4. Extract and validate coordinates
  let coords;
  if (Array.isArray(emergencyLocation)) {
    coords = emergencyLocation;
  } else if (emergencyLocation && Array.isArray(emergencyLocation.coordinates)) {
    coords = emergencyLocation.coordinates;
  } else {
    throw new Error("Invalid emergencyLocation format");
  }

  // Use calculateDistance self-check to validate coordinates validity/bounds
  calculateDistance(coords, coords);

  // 5. Find busy responders who have active assignments
  // An active assignment means they are the assignedResponder on an Emergency whose status is 'assigned' or 'in_progress'
  const activeEmergencies = await Emergency.find({
    status: { $in: ["assigned", "in_progress"] },
    assignedResponder: { $ne: null }
  }).select("assignedResponder");

  const busyResponderIds = activeEmergencies
    .map(e => e.assignedResponder)
    .filter(id => id !== null && id !== undefined)
    .map(id => id.toString());

  // 6. Query MongoDB using geospatial query and filter fields
  const query = {
    role: "responder",
    isAvailable: true,
    skills: { $in: requiredSkills },
    _id: { $nin: busyResponderIds },
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: coords
        },
        $maxDistance: radiusKm * 1000 // Convert km to meters
      }
    }
  };

  const responders = await User.find(query);

  // 7. Calculate distance, sort ascending by straight-line Haversine distance, and map to clean object contract
  const candidates = responders
    .map(responder => {
      const distance = calculateDistance(coords, responder.location.coordinates);
      return {
        id: responder._id.toString(),
        name: responder.name,
        skills: responder.skills,
        location: responder.location,
        distanceKm: Number(distance.toFixed(2)) // Keep as numeric kilometer distance
      };
    })
    // Filter out candidates strictly outside radius range just in case
    .filter(c => c.distanceKm <= radiusKm);

  // Sort ascending by distance as final verification
  candidates.sort((a, b) => a.distanceKm - b.distanceKm);

  // Return at most the requested limit
  return candidates.slice(0, limit);
}
