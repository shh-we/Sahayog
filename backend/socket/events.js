/**
 * socket/events.js
 *
 * Canonical names for every server-to-client Socket.IO event in Sahayog.
 * Import these constants in publishers, handlers, and tests instead of
 * using raw strings.
 *
 * This file documents ONLY server-to-client broadcast events.
 * Client-to-server request event names (e.g. "emergency:join") live at
 * their point of use in roomService.js — they are not broadcast events.
 *
 * There are NO client mutation events here (dispatch:accept / dispatch:decline).
 * Accept and decline remain HTTP-only mutations (Feature 6).
 */

// ─── Server → Client ──────────────────────────────────────────────────────────

/** Sent to `user:<responderId>` when a dispatch offer is made to that responder. */
export const DISPATCH_OFFER = "dispatch:offer";

/** Sent to `emergency:<emergencyId>` when a responder has been assigned. */
export const RESPONDER_ASSIGNED = "responder:assigned";

/** Sent to `emergency:<emergencyId>` with live responder coordinates. */
export const RESPONDER_LOCATION = "responder:location";

/** Sent to `emergency:<emergencyId>` when the emergency status changes. */
export const EMERGENCY_STATUS_UPDATE = "emergency:statusUpdate";

/** Sent to `emergency:<emergencyId>` when the responder starts the journey.
 *  Payload: { emergencyId, routeCoordinates, journeyStartedAt } */
export const JOURNEY_STARTED = "journey:started";
