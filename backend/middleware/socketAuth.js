/**
 * middleware/socketAuth.js
 *
 * Socket.IO connection-level JWT authentication middleware.
 *
 * Design note (Feature 5.5 migration path):
 *   Token extraction is deliberately isolated in `extractToken()`.
 *   When Feature 5.5 migrates to HTTP-only cookies, only that one function
 *   needs to change; `verifyAndLoadUser()` and `socketAuthMiddleware` remain
 *   untouched.
 *
 * Current token source: socket.handshake.auth.token (localStorage-based JWT).
 * Future token source:  HTTP-only cookie attached to the upgrade request.
 *
 * Stored in socket.data.user: { id, role }  — no password, no full document.
 */

import jwt from "jsonwebtoken";
import User from "../models/User.js";

// ─── Token extraction (swap this in Feature 5.5) ─────────────────────────────

/**
 * Extracts the raw JWT string from the socket handshake.
 * Returns null when no token is present.
 *
 * @param {import("socket.io").Socket} socket
 * @returns {string|null}
 */
function extractToken(socket) {
  const token = socket.handshake.auth?.token;
  if (typeof token === "string" && token.length > 0) {
    return token;
  }
  return null;
}

// ─── Token verification and user loading ─────────────────────────────────────

/**
 * Verifies a JWT string and loads the matching User from the database.
 * Returns only the safe identity fields { id, role }.
 *
 * @param {string} token
 * @returns {Promise<{id: string, role: string}>}
 * @throws {Error} if the token is invalid, expired, or the user no longer exists.
 */
async function verifyAndLoadUser(token) {
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw new Error(`Invalid or expired token: ${err.message}`);
  }

  const user = await User.findById(decoded.id).select("role");
  if (!user) {
    throw new Error("User no longer exists");
  }

  return { id: user._id.toString(), role: user.role };
}

// ─── Socket.IO middleware ─────────────────────────────────────────────────────

/**
 * Socket.IO middleware that authenticates every incoming connection.
 *
 * On success, populates socket.data.user = { id, role } and calls next().
 * On failure, calls next(new Error(...)) which Socket.IO translates to a
 * connection-refused event on the client.
 *
 * @param {import("socket.io").Socket} socket
 * @param {Function} next
 */
export async function socketAuthMiddleware(socket, next) {
  try {
    const token = extractToken(socket);
    if (!token) {
      return next(new Error("Authentication required: no token provided"));
    }

    const user = await verifyAndLoadUser(token);
    socket.data.user = user;
    next();
  } catch (err) {
    next(new Error(`Authentication failed: ${err.message}`));
  }
}
