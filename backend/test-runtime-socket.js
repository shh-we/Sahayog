/**
 * test-runtime-socket.js
 *
 * Runtime integration verification for Feature 8 Socket Authentication Foundation.
 *
 * Tests all four verification scenarios against the real local server:
 *   1. Authenticated responder connects with JWT handshake — receives dispatch:offer
 *   2. Emergency-room join + responder:assigned event after HTTP accept
 *   3. emergency:statusUpdate event after HTTP status PATCH
 *   4. Authorization boundary — unrelated user gets FORBIDDEN on emergency:join
 *
 * Prerequisites — must be running before invoking this script:
 *   - Backend:  node server.js (or npm run dev) in /backend
 *   - MongoDB:  mongod on localhost:27017
 *
 * Run from /backend:
 *   node test-runtime-socket.js
 */

import "dotenv/config";
import axios from "axios";
import { io as ioc } from "socket.io-client";
import mongoose from "mongoose";
import User from "./models/User.js";

const BASE = "http://localhost:5000";
const API  = `${BASE}/api`;

// ─── Minimal test harness ─────────────────────────────────────────────────────

let passed = 0, failed = 0;
const failures = [];

function logTest(name, ok, detail = "") {
  if (ok) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}${detail ? `\n    ${detail}` : ""}`);
    failed++;
    failures.push(name);
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Wait for a single named socket event, with a timeout.
 * Resolves with the payload, or rejects with a timeout error.
 */
function waitForEvent(socket, eventName, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Timeout waiting for '${eventName}' after ${timeoutMs}ms`));
    }, timeoutMs);

    function handler(payload) {
      clearTimeout(timer);
      resolve(payload);
    }

    socket.once(eventName, handler);
  });
}

/**
 * Connect a socket with a JWT token.
 * Resolves once connected, rejects on connect_error.
 */
function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = ioc(BASE, {
      auth: { token },
      reconnection: false,
      timeout: 6000
    });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", (err) => {
      socket.disconnect();
      reject(err);
    });
  });
}

/**
 * Attempt a socket connection that should fail auth.
 * Resolves with the connect_error, rejects if it unexpectedly connects.
 */
function connectSocketExpectFailure(token) {
  return new Promise((resolve, reject) => {
    const socket = ioc(BASE, {
      auth: { token },
      reconnection: false,
      timeout: 5000
    });
    socket.once("connect_error", (err) => {
      socket.disconnect();
      resolve(err);
    });
    socket.once("connect", () => {
      socket.disconnect();
      reject(new Error("Socket connected when it should have been rejected"));
    });
  });
}

// ─── Unique test data helpers ─────────────────────────────────────────────────

const ts = Date.now();

const REPORTER = {
  name: "RT Reporter",
  email: `rt.reporter.${ts}@test.com`,
  phone: `1${String(ts).slice(-9)}`,
  password: "Test1234!",
  role: "user"
};

const RESPONDER = {
  name: "RT Responder",
  email: `rt.responder.${ts}@test.com`,
  phone: `2${String(ts).slice(-9)}`,
  password: "Test1234!",
  role: "responder",
  skills: ["medical"]
};

const OUTSIDER = {
  name: "RT Outsider",
  email: `rt.outsider.${ts}@test.com`,
  phone: `3${String(ts).slice(-9)}`,
  password: "Test1234!",
  role: "user"
};

// Kathmandu coordinates — both reporter and responder are at the same spot
const LAT = 27.7172;
const LON = 85.3240;

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function register(userData) {
  const res = await axios.post(`${API}/auth/register`, userData);
  return res.data;
}

async function loginByPhone(phone, password) {
  const res = await axios.post(`${API}/auth/login`, { phone, password });
  return res.data; // { token, user }
}

function authed(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

async function setLocation(token, lat, lon) {
  const res = await axios.put(
    `${API}/responders/location`,
    { latitude: lat, longitude: lon },
    authed(token)
  );
  return res.data;
}

async function getProfile(token) {
  const res = await axios.get(`${API}/auth/me`, authed(token));
  return res.data.user;
}

async function createEmergency(token, lat, lon) {
  const res = await axios.post(`${API}/emergencies`, {
    type: "medical",
    description: "Runtime socket integration test",
    latitude: lat,
    longitude: lon,
    address: "Test Address, Kathmandu"
  }, authed(token));
  return res.data.emergency;
}

async function acceptOffer(token, attemptId) {
  const res = await axios.post(`${API}/dispatch/${attemptId}/accept`, {}, authed(token));
  return res.data;
}

async function patchResponderStatus(token, emergencyId, status) {
  const res = await axios.patch(
    `${API}/emergencies/${emergencyId}/status`,
    { status },
    authed(token)
  );
  return res.data;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Runtime Socket Integration Verification — Sahayog");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // ── 0. Register + set up test accounts ────────────────────────────────────
  console.log("0. Registering test accounts...");
  let reporterToken, responderToken, outsiderToken;
  let responderData;

  try {
    const rReg = await register(REPORTER);
    reporterToken = rReg.token;
    console.log(`   Reporter registered: ${rReg.user.id}`);

    // Register responder then log in — login auto-sets isAvailable=true
    await register(RESPONDER);
    const spLogin = await loginByPhone(RESPONDER.phone, RESPONDER.password);
    responderToken = spLogin.token;
    responderData = spLogin.user;
    console.log(`   Responder registered + logged in: ${responderData.id} isAvailable=${responderData.isAvailable}`);

    const oReg = await register(OUTSIDER);
    outsiderToken = oReg.token;
    console.log(`   Outsider registered: ${oReg.user.id}`);
  } catch (err) {
    console.error("   FATAL: Could not register test accounts:", err.response?.data || err.message);
    process.exit(1);
  }

  // Set responder location
  try {
    const locRes = await setLocation(responderToken, LAT, LON);
    console.log(`   Responder location set: ${JSON.stringify(locRes.location)}`);
  } catch (err) {
    console.error("   FATAL: Could not set responder location:", err.response?.data || err.message);
    process.exit(1);
  }

  // Verify profile shows location correctly stored
  try {
    const profile = await getProfile(responderToken);
    console.log(`   Responder profile location stored: ${JSON.stringify(profile.location)}`);
    console.log(`   Responder isAvailable from profile: ${profile.isAvailable}\n`);
    if (!profile.location || !profile.location.type || !Array.isArray(profile.location.coordinates)) {
      console.error("   FATAL: Location not stored correctly in DB — GeoJSON incomplete.");
      process.exit(1);
    }
  } catch (err) {
    console.error("   FATAL: Could not fetch profile:", err.response?.data || err.message);
    process.exit(1);
  }

  // ── Scenario 1: Missing token is rejected ──────────────────────────────────
  console.log("1. Authorization gate — missing token");
  try {
    const err = await connectSocketExpectFailure("");
    logTest("Missing token rejected by server (connect_error received)", true);
    console.log(`   Error message: ${err.message}`);
  } catch (e) {
    logTest("Missing token rejected by server (connect_error received)", false, e.message);
  }

  // ── Scenario 2a: Valid responder connects with JWT ─────────────────────────
  console.log("\n2. Authenticated responder connects with handshake.auth.token");
  let responderSocket;
  try {
    responderSocket = await connectSocket(responderToken);
    logTest(`Responder socket connected (id: ${responderSocket.id})`, true);
    logTest("handshake.auth.token accepted — no connect_error", true);
  } catch (err) {
    logTest("Responder socket connected", false, err.message);
    console.error("   Cannot continue — responder socket failed.");
    process.exit(1);
  }

  // ── Scenario 2b: Reporter connects ────────────────────────────────────────
  let reporterSocket;
  try {
    reporterSocket = await connectSocket(reporterToken);
    logTest(`Reporter socket connected (id: ${reporterSocket.id})`, true);
  } catch (err) {
    logTest("Reporter socket connected", false, err.message);
    responderSocket.disconnect();
    process.exit(1);
  }

  // ── Scenario 3: Create emergency → dispatch:offer received ────────────────
  console.log("\n3. Reporter creates emergency → dispatch:offer fires on responder socket");

  // ── DB setup: bench every OTHER available responder so the dispatch engine
  //    picks only our test responder. Restored unconditionally in the finally.
  let benchedIds = [];
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    const others = await User.find({
      role: "responder",
      isAvailable: true,
      _id: { $ne: new mongoose.Types.ObjectId(responderData.id) }
    }).select("_id");
    benchedIds = others.map(r => r._id);
    if (benchedIds.length > 0) {
      await User.updateMany({ _id: { $in: benchedIds } }, { isAvailable: false });
      console.log(`   Benched ${benchedIds.length} other responder(s) for isolation.`);
    }
  } catch (dbErr) {
    console.warn(`   Could not bench other responders: ${dbErr.message} — test may still pass if our responder is picked first.`);
  }

  let emergencyId, attemptId;
  try {
    // Attach listener BEFORE creating emergency to avoid race
    const offerPromise = waitForEvent(responderSocket, "dispatch:offer", 20000);

    const emergency = await createEmergency(reporterToken, LAT, LON);
    emergencyId = emergency._id || emergency.id;
    console.log(`   Emergency created: ${emergencyId}`);

    const offerPayload = await offerPromise;
    attemptId = offerPayload.attemptId;

    logTest("dispatch:offer received on responder user room", true);
    logTest("offer.attemptId present", !!offerPayload.attemptId);
    logTest("offer.emergencyId present", !!offerPayload.emergencyId);
    logTest("offer.etaSeconds present", offerPayload.etaSeconds !== undefined);
    logTest("offer.expiresAt present", !!offerPayload.expiresAt);
    console.log(`   Full offer payload: ${JSON.stringify(offerPayload)}`);
  } catch (err) {
    logTest("dispatch:offer received on responder user room", false, err.message);
    console.error("\n   DISPATCH OFFER NOT RECEIVED.");
    responderSocket.disconnect();
    reporterSocket.disconnect();
  } finally {
    // Restore benched responders regardless of outcome
    if (benchedIds.length > 0) {
      await User.updateMany({ _id: { $in: benchedIds } }, { isAvailable: true });
      console.log(`   Restored ${benchedIds.length} benched responder(s).`);
    }
    await mongoose.disconnect();
    if (!emergencyId) {
      await reportFinal();
      process.exit(1);
    }
  }

  // ── Scenario 4: Reporter joins emergency room ──────────────────────────────
  console.log("\n4. emergency:join + responder:assigned after HTTP accept");

  // Reporter joins their own emergency room (they are the reporterId)
  const reporterJoinAck = await new Promise(resolve => {
    reporterSocket.emit("emergency:join", emergencyId, ack => resolve(ack));
  });
  logTest(
    `Reporter emergency:join acknowledged ok (got: ${JSON.stringify(reporterJoinAck)})`,
    reporterJoinAck?.ok === true
  );

  // Responder is NOT the assignedResponder yet — join will be FORBIDDEN at this point
  // (expected — they are offered but not yet accepted/assigned)
  const responderJoinBeforeAccept = await new Promise(resolve => {
    responderSocket.emit("emergency:join", emergencyId, ack => resolve(ack));
  });
  console.log(`   Responder join before accept: ${JSON.stringify(responderJoinBeforeAccept)} (FORBIDDEN expected — not yet assigned)`);

  // Accept the offer via HTTP — this makes the responder assignedResponder on the emergency
  let acceptResult;
  try {
    const assignedPromise = waitForEvent(reporterSocket, "responder:assigned", 10000);

    acceptResult = await acceptOffer(responderToken, attemptId);
    console.log(`   HTTP accept result: success=${acceptResult.success}`);

    const assignedPayload = await assignedPromise;
    logTest("responder:assigned received on reporter emergency room socket", true);
    logTest("assigned.responderId present", !!assignedPayload.responderId);
    logTest("assigned.emergencyId present", !!assignedPayload.emergencyId);
    console.log(`   responder:assigned payload: ${JSON.stringify(assignedPayload)}`);
  } catch (err) {
    logTest("responder:assigned received on reporter emergency room socket", false, err.message);
  }

  // Responder can now join the emergency room (they are now assignedResponder)
  const responderJoinAfterAccept = await new Promise(resolve => {
    responderSocket.emit("emergency:join", emergencyId, ack => resolve(ack));
  });
  logTest(
    `Responder emergency:join after accept acknowledged ok (got: ${JSON.stringify(responderJoinAfterAccept)})`,
    responderJoinAfterAccept?.ok === true
  );

  // ── Scenario 5: emergency:statusUpdate after PATCH ─────────────────────────
  console.log("\n5. emergency:statusUpdate after PATCH /emergencies/:id/status");

  try {
    // Both reporter and responder are now in the emergency room
    const statusOnReporter = waitForEvent(reporterSocket, "emergency:statusUpdate", 8000);
    const statusOnResponder = waitForEvent(responderSocket, "emergency:statusUpdate", 8000);

    await patchResponderStatus(responderToken, emergencyId, "en_route");
    console.log(`   PATCH status=en_route sent.`);

    const [reporterStatus, responderStatus] = await Promise.allSettled([statusOnReporter, statusOnResponder]);

    if (reporterStatus.status === "fulfilled") {
      logTest("emergency:statusUpdate received on reporter socket", true);
      console.log(`   Reporter status payload: ${JSON.stringify(reporterStatus.value)}`);
    } else {
      logTest("emergency:statusUpdate received on reporter socket", false, reporterStatus.reason?.message);
    }

    if (responderStatus.status === "fulfilled") {
      logTest("emergency:statusUpdate received on responder socket", true);
      console.log(`   Responder status payload: ${JSON.stringify(responderStatus.value)}`);
    } else {
      logTest("emergency:statusUpdate received on responder socket", false, responderStatus.reason?.message);
    }
  } catch (err) {
    logTest("emergency:statusUpdate received", false, err.message);
  }

  // ── Scenario 6: Authorization boundary ─────────────────────────────────────
  console.log("\n6. Authorization boundary — outsider is forbidden from emergency room");

  let outsiderSocket;
  try {
    outsiderSocket = await connectSocket(outsiderToken);
    logTest("Outsider socket authenticated (valid user, not party to emergency)", true);
  } catch (err) {
    logTest("Outsider socket authenticated", false, err.message);
  }

  if (outsiderSocket) {
    const outsiderAck = await new Promise(resolve => {
      outsiderSocket.emit("emergency:join", emergencyId, ack => resolve(ack));
    });
    logTest(
      `Outsider emergency:join rejected (got: ${JSON.stringify(outsiderAck)})`,
      outsiderAck?.ok === false
    );
    logTest(
      `Outsider ack.code === FORBIDDEN (got: ${outsiderAck?.code})`,
      outsiderAck?.code === "FORBIDDEN"
    );
    outsiderSocket.disconnect();
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────
  responderSocket.disconnect();
  reporterSocket.disconnect();
  await sleep(300);

  await reportFinal();
}

function reportFinal() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.error("  Failed checks:");
    failures.forEach(f => console.error(`    • ${f}`));
  } else {
    console.log("  All checks passed ✓");
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  return Promise.resolve();
}

run().catch(async err => {
  console.error("\nFATAL error in test runner:", err);
  await reportFinal();
  process.exit(1);
});
