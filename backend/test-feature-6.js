/**
 * test-feature-6.js
 *
 * Feature 6: Offer Accept/Decline HTTP Layer — Unit/Integration Tests
 *
 * Runs an in-process Express server with JWT authentication and in-memory Mongoose model mocks.
 * No real MongoDB, OSRM, or Socket.IO server is required.
 *
 * Run: node test-feature-6.js
 */

import express from "express";
import http from "http";
import axios from "axios";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// Setup environment secret for JWT validation
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret_key_12345";

// Import mongoose models to override their static methods
import User from "./models/User.js";
import Emergency from "./models/Emergency.js";
import DispatchAttempt from "./models/DispatchAttempt.js";

// Import service deps to wire in-memory overrides
import { deps as serviceDeps } from "./services/dispatchService.js";
import { initializeSocket, getIO } from "./socket/index.js";

// Import routes
import emergencyRoutes from "./routes/emergencyRoutes.js";
import dispatchRoutes from "./routes/dispatchRoutes.js";

// ─── Minimal test harness ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function logTest(name, ok, detail = {}) {
  if (ok) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}`);
    if (Object.keys(detail).length) console.error("    Detail:", JSON.stringify(detail, null, 2));
    failed++;
    failures.push(name);
  }
}

async function runSection(title, fn) {
  console.log(`\n${title}`);
  try {
    await fn();
  } catch (err) {
    console.error(`  ✗ [SECTION THREW] ${err.message}`);
    console.error(err.stack);
    failed++;
    failures.push(title);
  }
}

// ─── Mock Database Stores ─────────────────────────────────────────────────────

let usersDb = {};
let emergenciesDb = {};
let attemptsDb = {};

function makeId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function resetDb() {
  usersDb = {};
  emergenciesDb = {};
  attemptsDb = {};
  socketEmits.length = 0;
}

// ─── Mongoose Model Mocks ─────────────────────────────────────────────────────

User.findById = (id) => {
  const idStr = id.toString();
  const user = usersDb[idStr];
  return {
    select: () => user
  };
};

Emergency.findById = async (id) => {
  const idStr = id.toString();
  const em = emergenciesDb[idStr];
  if (!em) return null;
  return {
    ...em,
    save: async function () {
      emergenciesDb[idStr] = { ...this };
      return this;
    }
  };
};

Emergency.findOneAndUpdate = async (query, update, options) => {
  const idStr = query._id.toString();
  const em = emergenciesDb[idStr];
  if (!em) return null;

  if (query.status && em.status !== query.status) return null;
  if (query.assignedResponder !== undefined && em.assignedResponder !== query.assignedResponder) return null;

  Object.assign(em, update);
  emergenciesDb[idStr] = em;

  return {
    ...em,
    save: async function () {
      emergenciesDb[idStr] = { ...this };
      return this;
    }
  };
};

DispatchAttempt.findById = async (id) => {
  const idStr = id.toString();
  const attempt = attemptsDb[idStr];
  if (!attempt) return null;
  return attempt;
};

DispatchAttempt.findOneAndUpdate = async (query, update, options) => {
  const idStr = query._id.toString();
  const attempt = attemptsDb[idStr];
  if (!attempt) return null;

  if (query.status && attempt.status !== query.status) return null;
  if (query.responderId && attempt.responderId.toString() !== query.responderId.toString()) return null;
  if (query.expiresAt && query.expiresAt.$gt) {
    if (attempt.expiresAt <= query.expiresAt.$gt) return null;
  }

  Object.assign(attempt, update);
  attemptsDb[idStr] = attempt;
  return attempt;
};

DispatchAttempt.updateMany = async (query, update) => {
  let matchedCount = 0;
  for (const [id, a] of Object.entries(attemptsDb)) {
    let match = true;
    if (query.emergencyId && a.emergencyId.toString() !== query.emergencyId.toString()) match = false;
    if (query.status && a.status !== query.status) match = false;
    if (query._id && query._id.$ne && a._id.toString() === query._id.$ne.toString()) match = false;

    if (match) {
      Object.assign(a, update);
      matchedCount++;
    }
  }
  return { matchedCount };
};

// ─── Wire up serviceDeps so real service logic uses our mock models ───────────

serviceDeps.Emergency = Emergency;
serviceDeps.DispatchAttempt = DispatchAttempt;
serviceDeps.dispatchNextResponder = async (emergencyId) => {
  // Mock re-dispatch is a no-op in tests
};

// ─── Socket.IO Mocks ──────────────────────────────────────────────────────────

const socketEmits = [];

// ─── Test Server Setup ────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// Routes
app.use("/api/emergencies", emergencyRoutes);
app.use("/api/dispatch", dispatchRoutes);

const server = http.createServer(app);
initializeSocket(server);

// Intercept Socket.IO emissions to check publish calls
const io = getIO();
const originalTo = io.to;
io.to = function (room) {
  return {
    emit: function (event, payload) {
      socketEmits.push({ room, event, payload });
      return { room }; // return dummy
    }
  };
};

// Start listening on dynamic port
await new Promise((resolve) => server.listen(0, resolve));
const port = server.address().port;
const api = axios.create({
  baseURL: `http://localhost:${port}/api`,
  validateStatus: () => true // Do not throw on 4xx/5xx responses
});

// Helper to register mock objects
function registerMockUser(overrides = {}) {
  const id = makeId("user");
  const user = {
    _id: id,
    id: id,
    name: "Mock User",
    email: `${id}@test.com`,
    role: "responder",
    ...overrides
  };
  usersDb[id] = user;
  const token = jwt.sign({ id }, process.env.JWT_SECRET);
  return { user, token };
}

function registerMockEmergency(overrides = {}) {
  const id = makeId("em");
  const em = {
    _id: id,
    status: "active",
    dispatchStatus: null,
    currentDispatchRadiusKm: 5,
    assignedResponder: null,
    reporterLocation: { type: "Point", coordinates: [85.3, 27.7] },
    requiredSkills: ["medical"],
    responderStatus: null,
    ...overrides
  };
  emergenciesDb[id] = em;
  return em;
}

function registerMockAttempt(overrides = {}) {
  const id = makeId("attempt");
  const attempt = {
    _id: id,
    emergencyId: makeId("em"),
    responderId: makeId("user"),
    status: "pending",
    offeredAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000), // 1 minute in future
    etaSeconds: 180,
    ...overrides
  };
  attemptsDb[id] = attempt;
  return attempt;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

await runSection("1. Route Protection (Authentication check)", async () => {
  resetDb();
  
  // Accept attempt without JWT
  const res1 = await api.post("/dispatch/any_attempt/accept");
  logTest("accept without JWT returns 401", res1.status === 401);

  // Accept attempt with invalid JWT
  const res2 = await api.post("/dispatch/any_attempt/accept", {}, {
    headers: { Authorization: "Bearer invalid_token_here" }
  });
  logTest("accept with invalid JWT returns 401", res2.status === 401);

  // Status update without JWT
  const res3 = await api.patch("/emergencies/any_em/status", { status: "en_route" });
  logTest("status update without JWT returns 401", res3.status === 401);
});

await runSection("2. Accept Dispatch Offer — Success Flow", async () => {
  resetDb();
  const { user, token } = registerMockUser();
  const em = registerMockEmergency();
  const attempt = registerMockAttempt({
    emergencyId: em._id,
    responderId: user.id
  });

  const res = await api.post(`/dispatch/${attempt._id}/accept`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });

  logTest("accept success returns HTTP 200", res.status === 200);
  logTest("accept response reflects success: true", res.data.success === true);
  logTest("accept response reflects assigned emergency ID", res.data.emergency.id === em._id);

  // Verify in-memory state mutations
  logTest("attempt status set to accepted", attemptsDb[attempt._id].status === "accepted");
  logTest("emergency status set to assigned", emergenciesDb[em._id].status === "assigned");
  logTest("emergency dispatchStatus set to assigned", emergenciesDb[em._id].dispatchStatus === "assigned");
  logTest("emergency assignedResponder set to responder ID", emergenciesDb[em._id].assignedResponder === user.id);
});

await runSection("3. Accept Dispatch Offer — Wrong Responder", async () => {
  resetDb();
  const { user: realResponder } = registerMockUser();
  const { token: fakeToken } = registerMockUser({ name: "Fake Responder" });
  
  const em = registerMockEmergency();
  const attempt = registerMockAttempt({
    emergencyId: em._id,
    responderId: realResponder.id
  });

  const res = await api.post(`/dispatch/${attempt._id}/accept`, {}, {
    headers: { Authorization: `Bearer ${fakeToken}` }
  });

  logTest("accept by wrong responder returns HTTP 403 Forbidden", res.status === 403);
  logTest("accept returns error: 'forbidden'", res.data.error === "forbidden");
  
  // Verify service wasn't executed and state remains pending
  logTest("attempt status remains pending", attemptsDb[attempt._id].status === "pending");
  logTest("emergency status remains active", emergenciesDb[em._id].status === "active");
});

await runSection("4. Accept Dispatch Offer — Already Assigned or Expired (409 Conflict)", async () => {
  resetDb();
  const { user, token } = registerMockUser();
  const em = registerMockEmergency({ status: "assigned", assignedResponder: makeId("other") });
  const attempt = registerMockAttempt({
    emergencyId: em._id,
    responderId: user.id
  });

  const res = await api.post(`/dispatch/${attempt._id}/accept`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });

  logTest("accept on already assigned emergency returns HTTP 409 Conflict", res.status === 409);
  logTest("accept response indicates already_assigned reason", res.data.reason === "already_assigned");
});

await runSection("5. Decline Dispatch Offer — Success Flow", async () => {
  resetDb();
  const { user, token } = registerMockUser();
  const em = registerMockEmergency();
  const attempt = registerMockAttempt({
    emergencyId: em._id,
    responderId: user.id
  });

  const res = await api.post(`/dispatch/${attempt._id}/decline`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });

  logTest("decline success returns HTTP 200", res.status === 200);
  logTest("decline response reflects ok: true", res.data.ok === true);
  
  // Verify state
  logTest("attempt status set to declined", attemptsDb[attempt._id].status === "declined");
  logTest("emergency dispatchStatus reset to searching", emergenciesDb[em._id].dispatchStatus === "searching");
});

await runSection("6. Decline Dispatch Offer — Wrong Responder", async () => {
  resetDb();
  const { user: realResponder } = registerMockUser();
  const { token: fakeToken } = registerMockUser();
  
  const em = registerMockEmergency();
  const attempt = registerMockAttempt({
    emergencyId: em._id,
    responderId: realResponder.id
  });

  const res = await api.post(`/dispatch/${attempt._id}/decline`, {}, {
    headers: { Authorization: `Bearer ${fakeToken}` }
  });

  logTest("decline by wrong responder returns HTTP 403", res.status === 403);
  logTest("decline returns error: 'forbidden'", res.data.error === "forbidden");
  logTest("attempt status remains pending", attemptsDb[attempt._id].status === "pending");
});

await runSection("7. Decline Dispatch Offer — Not Pending (409 Conflict)", async () => {
  resetDb();
  const { user, token } = registerMockUser();
  const em = registerMockEmergency();
  const attempt = registerMockAttempt({
    emergencyId: em._id,
    responderId: user.id,
    status: "declined" // not pending anymore
  });

  const res = await api.post(`/dispatch/${attempt._id}/decline`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });

  logTest("decline of already declined attempt returns HTTP 409", res.status === 409);
  logTest("decline returns reason: 'not_pending'", res.data.reason === "not_pending");
});

await runSection("8. Assigned Responder Status Update — en_route, on_scene", async () => {
  resetDb();
  const { user, token } = registerMockUser();
  const em = registerMockEmergency({
    status: "assigned",
    assignedResponder: user.id
  });

  // 1. Update to en_route
  const res1 = await api.patch(`/emergencies/${em._id}/status`, { status: "en_route" }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  logTest("update status to en_route returns HTTP 200", res1.status === 200);
  logTest("emergency responderStatus is en_route", emergenciesDb[em._id].responderStatus === "en_route");
  logTest("emergency status remains assigned", emergenciesDb[em._id].status === "assigned");

  // Verify socket emission
  const emit1 = socketEmits.find(e => e.room === `emergency:${em._id}` && e.payload.responderStatus === "en_route");
  logTest("published emergency:statusUpdate to correct room for en_route", !!emit1);

  // 2. Update to on_scene
  const res2 = await api.patch(`/emergencies/${em._id}/status`, { status: "on_scene" }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  logTest("update status to on_scene returns HTTP 200", res2.status === 200);
  logTest("emergency responderStatus is on_scene", emergenciesDb[em._id].responderStatus === "on_scene");

  const emit2 = socketEmits.find(e => e.room === `emergency:${em._id}` && e.payload.responderStatus === "on_scene");
  logTest("published emergency:statusUpdate for on_scene", !!emit2);
});

await runSection("9. Assigned Responder Status Update — completed", async () => {
  resetDb();
  const { user, token } = registerMockUser();
  const em = registerMockEmergency({
    status: "assigned",
    assignedResponder: user.id
  });

  const res = await api.patch(`/emergencies/${em._id}/status`, { status: "completed" }, {
    headers: { Authorization: `Bearer ${token}` }
  });

  logTest("update status to completed returns HTTP 200", res.status === 200);
  logTest("emergency responderStatus is completed", emergenciesDb[em._id].responderStatus === "completed");
  logTest("emergency status changed to resolved", emergenciesDb[em._id].status === "resolved");
  logTest("emergency resolvedAt date is set", emergenciesDb[em._id].resolvedAt instanceof Date || typeof emergenciesDb[em._id].resolvedAt === "string");

  // Verify socket emission
  const emit = socketEmits.find(e => e.room === `emergency:${em._id}` && e.payload.responderStatus === "completed");
  logTest("published emergency:statusUpdate for completed", !!emit && emit.payload.status === "resolved");
});

await runSection("10. Status Update — Invalid Status Value (400)", async () => {
  resetDb();
  const { user, token } = registerMockUser();
  const em = registerMockEmergency({
    status: "assigned",
    assignedResponder: user.id
  });

  const res = await api.patch(`/emergencies/${em._id}/status`, { status: "resting" }, {
    headers: { Authorization: `Bearer ${token}` }
  });

  logTest("invalid status returns HTTP 400", res.status === 400);
  logTest("responderStatus remains null", emergenciesDb[em._id].responderStatus === null);
  logTest("no status update socket broadcast was sent", socketEmits.length === 0);
});

await runSection("11. Status Update — Mismatched or Null Responder (403)", async () => {
  resetDb();
  const { token: user1Token } = registerMockUser();
  const emWithOther = registerMockEmergency({
    status: "assigned",
    assignedResponder: makeId("other")
  });
  const emWithNull = registerMockEmergency({
    status: "assigned",
    assignedResponder: null
  });

  // Mismatched responder
  const res1 = await api.patch(`/emergencies/${emWithOther._id}/status`, { status: "en_route" }, {
    headers: { Authorization: `Bearer ${user1Token}` }
  });
  logTest("mismatched responder receives HTTP 403 Forbidden", res1.status === 403);
  logTest("mismatched responder response error: 'forbidden'", res1.data.error === "forbidden");

  // Null responder
  const res2 = await api.patch(`/emergencies/${emWithNull._id}/status`, { status: "en_route" }, {
    headers: { Authorization: `Bearer ${user1Token}` }
  });
  logTest("null assignedResponder receives HTTP 403 Forbidden without crash", res2.status === 403);
  logTest("null assignedResponder response error: 'forbidden'", res2.data.error === "forbidden");
  
  logTest("no status update socket broadcast was sent", socketEmits.length === 0);
});

// Clean up server
await new Promise((resolve) => server.close(resolve));

// ─── Results ──────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log("\nFailed tests:");
  failures.forEach(f => console.log(`  ✗ ${f}`));
}
console.log("─".repeat(60));

process.exit(failed > 0 ? 1 : 0);
