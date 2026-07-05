import User from "../models/User.js";

//  Skill map
const skillMap = {
  fire:             ["fire", "medical"],
  medical:          ["medical"],
  security:         ["security", "medical"],
  natural_disaster: ["general", "medical", "security"],
  other:            ["general"]
};

// Get required skills from emergency type 
export function getRequiredSkills(type) {
  return skillMap[type] || ["general"];
}

//  Haversine formula 
// Calculates distance in km between two coordinates
function haversineDistance(coords1, coords2) {
  const R = 6371; // Earth's radius in km

  const lat1 = coords1[1];
  const lon1 = coords1[0];
  const lat2 = coords2[1];
  const lon2 = coords2[0];

  // Convert degrees to radians
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  // Haversine formula
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in km
}

//  Find nearby responders 
// uses Haversine formula
export async function findNearbyResponders(location, requiredSkills, radius = 10000) {
  // radius in meters, default 10000m (10km)
  const radiusKm = Number(radius) / 1000;

  //  Get all available responders with matching skills
  const responders = await User.find({
    role: "responder",
    isAvailable: true,
    skills: { $in: requiredSkills },
    "location.coordinates": { $exists: true }
  }).select("name phone skills location");

  //  Calculate distance for each responder using Haversine
  const respondersWithDistance = responders
    .map((responder) => {
      const distance = haversineDistance(
        location.coordinates,
        responder.location.coordinates
      );
      return {
        ...responder.toObject(),
        distance: Number.parseFloat(distance.toFixed(2)) // in km, 2 decimal places
      };
    })
    //  Filter by radius
    .filter((responder) => responder.distance <= radiusKm)
    // 4. Sort by distance (closest first)
    .sort((a, b) => a.distance - b.distance);

  return respondersWithDistance;
}