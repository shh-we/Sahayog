/**
 * socket/roomService.js
 *
 * Server-side room management for Socket.IO.
 *
 * Rules:
 *  - The server (not the client) joins every socket to `user:<id>` on connect.
 *  - Clients may request to join `emergency:<id>` via the `emergency:join` event.
 *  - Authorization is checked here; the client never supplies the full room name.
 *  - No database records are created or mutated in this module.
 */

import Emergency from "../models/Emergency.js";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Returns the canonical `user:<id>` room name for a given user ID.
 * @param {string} userId
 * @returns {string}
 */
export function userRoom(userId) {
  return `user:${userId}`;
}

/**
 * Returns the canonical `emergency:<id>` room name for a given emergency ID.
 * @param {string} emergencyId
 * @returns {string}
 */
export function emergencyRoom(emergencyId) {
  return `emergency:${emergencyId}`;
}

// ─── Server-join on connect ───────────────────────────────────────────────────

/**
 * Called immediately after a socket passes authentication.
 * Joins the socket to `user:<authenticated-id>` — server-controlled, not client-controlled.
 *
 * @param {import("socket.io").Socket} socket
 */
export function joinUserRoom(socket) {
  const room = userRoom(socket.data.user.id);
  socket.join(room);
}

// ─── Emergency room authorization ────────────────────────────────────────────

/**
 * Registers the `emergency:join` event handler on a socket.
 * The client sends only an `emergencyId`; the server constructs the room name
 * and validates authorization before joining.
 *
 * Authorization rules:
 *   - reporter:           Emergency.reporterId === authenticated user id
 *   - assigned responder: Emergency.assignedResponder === authenticated user id
 *   - admin:              authenticated user role === "admin"
 *   - everyone else:      rejected with { ok: false, code: "FORBIDDEN" }
 *
 * Malformed or nonexistent emergency IDs are rejected safely without leaking data.
 *
 * @param {import("socket.io").Socket} socket
 */
export function registerEmergencyJoin(socket) {
  socket.on("emergency:join", async (emergencyId, ack) => {
    // Always send an acknowledgement — even on error paths
    const reply = typeof ack === "function" ? ack : () => {};

    try {
      // Validate the emergencyId is a non-empty string
      if (!emergencyId || typeof emergencyId !== "string" || emergencyId.trim() === "") {
        return reply({ ok: false, code: "FORBIDDEN" });
      }

      const id = emergencyId.trim();

      // Load only the fields needed for authorization — do not expose full doc
      let emergency;
      try {
        emergency = await Emergency.findById(id).select("reporterId assignedResponder");
      } catch {
        // Invalid ObjectId format or DB error — reject safely
        return reply({ ok: false, code: "FORBIDDEN" });
      }

      if (!emergency) {
        return reply({ ok: false, code: "FORBIDDEN" });
      }

      const userId = socket.data.user.id;
      const role = socket.data.user.role;

      const isReporter = emergency.reporterId?.toString() === userId;
      const isAssigned = emergency.assignedResponder?.toString() === userId;
      const isAdmin = role === "admin";

      if (!isReporter && !isAssigned && !isAdmin) {
        return reply({ ok: false, code: "FORBIDDEN" });
      }

      // Authorization passed — server constructs the room name
      const room = emergencyRoom(id);
      socket.join(room);
      reply({ ok: true });

    } catch (err) {
      console.error("[roomService] emergency:join error:", err.message);
      reply({ ok: false, code: "FORBIDDEN" });
    }
  });
}
