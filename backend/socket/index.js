/**
 * socket/index.js
 *
 * Socket.IO server initialization.
 *
 * What changed from the legacy version:
 *  - Added socketAuthMiddleware: every connection is rejected unless it carries
 *    a valid JWT in handshake.auth.token.
 *  - Server joins each authenticated socket to `user:<id>` immediately on connect.
 *  - Registered the server-authorized `emergency:join` event via roomService.
 *  - Removed the unsafe client-controlled `join(userId)` event entirely.
 *  - No global broadcasts. No dispatch:accept / dispatch:decline handlers.
 */

import { Server } from "socket.io";
import { socketAuthMiddleware } from "../middleware/socketAuth.js";
import { joinUserRoom, registerEmergencyJoin } from "./roomService.js";

let io;

/**
 * Creates and configures the Socket.IO server.
 * Must be called once after the HTTP server is listening.
 *
 * @param {import("http").Server} server
 * @returns {import("socket.io").Server}
 */
export function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        process.env.CLIENT_URL || "http://localhost:5173"
      ],
      methods: ["GET", "POST"]
    }
  });

  // ── Authentication gate ────────────────────────────────────────────────────
  // Every connection must pass JWT auth before any event handler runs.
  io.use(socketAuthMiddleware);

  // ── Per-connection setup ───────────────────────────────────────────────────
  io.on("connection", (socket) => {
    const { id, role } = socket.data.user;
    console.log(`[socket] authenticated connection: socketId=${socket.id} userId=${id} role=${role}`);

    // Server joins the socket to its private user room — not the client.
    joinUserRoom(socket);

    // Register the controlled emergency room subscription event.
    registerEmergencyJoin(socket);

    socket.on("disconnect", () => {
      console.log(`[socket] disconnected: socketId=${socket.id} userId=${id}`);
    });

    // NOTE: The legacy client-controlled `join(userId)` event has been removed.
    // NOTE: dispatch:accept and dispatch:decline are HTTP-only (Feature 6).
  });

  return io;
}

/**
 * Returns the initialized Socket.IO server instance.
 * Throws if called before initializeSocket().
 *
 * @returns {import("socket.io").Server}
 */
export function getIO() {
  if (!io) {
    throw new Error("Socket.IO has not been initialized yet");
  }
  return io;
}