/**
 * socket/emergencyPublisher.js
 *
 * The ONLY module that sends emergency-related Socket.IO notifications.
 * Controllers and services must NEVER call io.emit() or io.to(...).emit()
 * directly for emergency events; they must call these functions instead.
 *
 * Publisher rules:
 *  - Does NOT read or write any database records.
 *  - Does NOT change emergency status, assign responders, or create offers.
 *  - Uses the initialized Socket.IO server via getIO().
 *  - Sends to targeted rooms only — never a global broadcast.
 *
 * Recipient mapping:
 *  dispatch:offer          → user:<responderId>
 *  responder:assigned      → emergency:<emergencyId>
 *  responder:location      → emergency:<emergencyId>
 *  emergency:statusUpdate  → emergency:<emergencyId>
 */

import { getIO } from "./index.js";
import { userRoom, emergencyRoom } from "./roomService.js";
import {
  DISPATCH_OFFER,
  RESPONDER_ASSIGNED,
  RESPONDER_LOCATION,
  EMERGENCY_STATUS_UPDATE,
  JOURNEY_STARTED
} from "./events.js";

// ─── Publisher functions ──────────────────────────────────────────────────────

/**
 * Sends a dispatch offer to the targeted responder's private room.
 * Only the responder with `responderUserId` will receive this event.
 *
 * Called by Feature 4 dispatch logic after OSRM ETA ranking selects a candidate.
 *
 * @param {string} responderUserId - The user ID of the offered responder.
 * @param {Object} payload         - Offer payload (emergencyId, ETA, etc.).
 */
export function publishDispatchOffer(responderUserId, payload) {
  getIO().to(userRoom(responderUserId)).emit(DISPATCH_OFFER, payload);
}

/**
 * Notifies everyone in the emergency room that a responder has been assigned.
 *
 * Called by Feature 4 after acceptance confirmation.
 *
 * @param {string} emergencyId - The emergency's database ID.
 * @param {Object} payload     - Assignment details (responderId, name, ETA, etc.).
 */
export function publishResponderAssigned(emergencyId, payload) {
  getIO().to(emergencyRoom(emergencyId)).emit(RESPONDER_ASSIGNED, payload);
}

/**
 * Broadcasts a responder's live location update to the emergency room.
 *
 * Called by Feature 7 live-location tracking.
 *
 * @param {string} emergencyId - The emergency's database ID.
 * @param {Object} payload     - Location update ({ responderId, coordinates, timestamp }).
 */
export function publishResponderLocation(emergencyId, payload) {
  getIO().to(emergencyRoom(emergencyId)).emit(RESPONDER_LOCATION, payload);
}

/**
 * Notifies the emergency room of a status change (e.g. in_progress → resolved).
 *
 * May be called after a status mutation is fully committed to the database.
 *
 * @param {string} emergencyId - The emergency's database ID.
 * @param {Object} payload     - Status update ({ status, updatedAt, ... }).
 */
export function publishEmergencyStatusUpdate(emergencyId, payload) {
  getIO().to(emergencyRoom(emergencyId)).emit(EMERGENCY_STATUS_UPDATE, payload);
}

/**
 * Broadcasts journey start state to everyone watching the emergency.
 * Enables the user dashboard to run a synchronized, timestamp-based animation
 * that stays accurate even after page refresh.
 *
 * @param {string} emergencyId - The emergency's database ID.
 * @param {Object} payload     - { emergencyId, routeCoordinates, journeyStartedAt }
 */
export function publishJourneyStarted(emergencyId, payload) {
  getIO().to(emergencyRoom(emergencyId)).emit(JOURNEY_STARTED, payload);
}
