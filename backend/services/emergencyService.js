import User from "../models/User.js";
import { calculateDistance } from "./geoService.js";

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

//  Find nearby responders 
// uses Haversine formula from geoService
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
      const distance = calculateDistance(
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