import { getIO } from "./index.js";

// Notify nearby responders when emergency is created
export function notifyNearbyResponders(responders, emergency) {
  const io = getIO();

  responders.forEach((responder) => {
    // Send notification to each responder's room
    io.to(responder._id.toString()).emit("new_emergency", {
      message: `New ${emergency.type} emergency ${responder.distance}km away`,
      emergency: {
        _id: emergency._id,
        type: emergency.type,
        description: emergency.description,
        location: emergency.location,
        distance: responder.distance
      }
    });
  });

  console.log(`Notified ${responders.length} responders`);
}