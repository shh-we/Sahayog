/**
 * test-feature-4.js
 *
 * Feature 4: Dispatch & Escalation Engine — Unit Tests using Real Implementation
 *
 * Executes the real code from:
 *   backend/services/dispatchService.js
 *   backend/workers/dispatchWorker.js
 *
 * while mocking database, candidate service, routing/ETA, and socket publisher dependencies.
 * No live MongoDB, OSRM server, or Socket.IO server is required.
 *
 * Run: node test-feature-4.js
 */

import {
  startDispatch,
  dispatchNextResponder,
  declineDispatchAttempt,
  acceptDispatchAttempt,
  deps as serviceDeps
} from "./services/dispatchService.js";

import {
  runExpirySweep,
  startDispatchWorker,
  deps as workerDeps
} from "./workers/dispatchWorker.js";

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
    failed++;
    failures.push(title);
  }
}

// ─── In-memory mock stores ────────────────────────────────────────────────────

let _emergencyStore = {};
let _attemptStore = {};

function makeObjectId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function resetStores() {
  _emergencyStore = {};
  _attemptStore = {};
  publishedOffers.length = 0;
  publishedAssignments.length = 0;
  mockCandidates = null;
  mockEtas = null;
  mockGetCandidateEtasError = null;
}

// ─── Track publisher calls ────────────────────────────────────────────────────

const publishedOffers = [];       // { responderId, payload }
const publishedAssignments = [];  // { emergencyId, payload }

// ─── Mock builders ────────────────────────────────────────────────────────────

function makeEmergency(overrides = {}) {
  const id = makeObjectId("eid");
  const doc = {
    _id: id,
    type: "medical",
    status: "active",
    dispatchStatus: null,
    currentDispatchRadiusKm: null,
    assignedResponder: null,
    reporterLocation: { type: "Point", coordinates: [85.3, 27.7] },
    requiredSkills: ["medical"],
    ...overrides,
    save: async function () {
      _emergencyStore[this._id] = { ...this };
    }
  };
  _emergencyStore[id] = { ...doc };
  return doc;
}

function makeAttempt(overrides = {}) {
  const id = makeObjectId("aid");
  const doc = {
    _id: id,
    emergencyId: null,
    responderId: null,
    status: "pending",
    offeredAt: new Date(),
    expiresAt: new Date(Date.now() + 25_000),
    respondedAt: null,
    etaSeconds: 120,
    ...overrides
  };
  _attemptStore[id] = { ...doc };
  return doc;
}

// ─── Mocked service state ─────────────────────────────────────────────────────

let mockCandidates = null;
let mockEtas = null;
let mockGetCandidateEtasError = null;

function defaultCandidate(idx = 0) {
  return {
    id: makeObjectId(`resp${idx}`),
    name: `Responder ${idx}`,
    skills: ["medical"],
    location: { type: "Point", coordinates: [85.3 + idx * 0.001, 27.7] },
    distanceKm: idx + 1
  };
}

// ─── Mock implementations of imported services ────────────────────────────────

async function mockFindEligibleCandidates({ radiusKm }) {
  if (mockCandidates !== null) return mockCandidates;
  if (radiusKm >= 5) return [defaultCandidate(0)];
  return [];
}

async function mockGetCandidateEtas(candidates) {
  if (mockGetCandidateEtasError) {
    throw mockGetCandidateEtasError;
  }
  if (mockEtas !== null) {
    return [...mockEtas].sort((a, b) => a.durationSeconds - b.durationSeconds);
  }
  return candidates.map((c, i) => ({
    responderId: c.id,
    name: c.name,
    durationSeconds: (i + 1) * 120,
    estimated: false
  })).sort((a, b) => a.durationSeconds - b.durationSeconds);
}

function mockPublishDispatchOffer(responderId, payload) {
  publishedOffers.push({ responderId, payload });
}

function mockPublishResponderAssigned(emergencyId, payload) {
  publishedAssignments.push({ emergencyId, payload });
}

// ─── Mongoose Model Mocks ─────────────────────────────────────────────────────

const mockEmergencyModel = {
  findById: async (id) => {
    const em = _emergencyStore[id.toString()];
    if (!em) return null;
    return {
      ...em,
      save: async function() {
        _emergencyStore[this._id.toString()] = { ...this };
      }
    };
  },
  findByIdAndUpdate: async (id, update) => {
    const em = _emergencyStore[id.toString()];
    if (em) {
      Object.assign(em, update);
      _emergencyStore[id.toString()] = em;
    }
    return em;
  },
  findOneAndUpdate: async (query, update, options) => {
    const id = query._id;
    const em = _emergencyStore[id.toString()];
    if (!em) return null;
    
    // Check conditional queries
    if (query.status && em.status !== query.status) return null;
    if (query.assignedResponder !== undefined && em.assignedResponder !== query.assignedResponder) return null;
    
    Object.assign(em, update);
    _emergencyStore[id.toString()] = em;
    
    return {
      ...em,
      save: async function() {
        _emergencyStore[this._id.toString()] = { ...this };
      }
    };
  }
};

const mockDispatchAttemptModel = {
  find: (query) => {
    let list = Object.values(_attemptStore);
    if (query.emergencyId) {
      list = list.filter(a => a.emergencyId.toString() === query.emergencyId.toString());
    }
    if (query.status) {
      list = list.filter(a => a.status === query.status);
    }
    if (query.expiresAt && query.expiresAt.$lte) {
      list = list.filter(a => a.expiresAt <= query.expiresAt.$lte);
    }
    
    const builder = {
      select: () => list
    };
    return builder;
  },
  create: async (doc) => {
    const id = makeObjectId("aid");
    const created = {
      _id: id,
      status: "pending",
      offeredAt: new Date(),
      expiresAt: new Date(Date.now() + 25_000),
      respondedAt: null,
      etaSeconds: 120,
      ...doc
    };
    _attemptStore[id] = created;
    return created;
  },
  findByIdAndUpdate: async (id, update) => {
    const attempt = _attemptStore[id.toString()];
    if (attempt) {
      Object.assign(attempt, update);
      _attemptStore[id.toString()] = attempt;
    }
    return attempt;
  },
  findOneAndUpdate: async (query, update, options) => {
    const id = query._id;
    const attempt = _attemptStore[id.toString()];
    if (!attempt) return null;
    
    if (query.status && attempt.status !== query.status) return null;
    if (query.responderId && attempt.responderId.toString() !== query.responderId.toString()) return null;
    if (query.expiresAt && query.expiresAt.$gt) {
      if (attempt.expiresAt <= query.expiresAt.$gt) return null;
    }
    
    Object.assign(attempt, update);
    _attemptStore[id.toString()] = attempt;
    return attempt;
  },
  updateMany: async (query, update) => {
    let matchedCount = 0;
    for (const [id, a] of Object.entries(_attemptStore)) {
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
  }
};

const mockUserModel = {
  findById: async (id) => {
    return {
      _id: id,
      name: "Mock Responder",
      phone: "1234567890",
      email: "mock@responder.com",
      skills: ["medical"]
    };
  }
};

// ─── Wire mock dependencies onto serviceDeps & workerDeps ───────────────────

serviceDeps.Emergency = mockEmergencyModel;
serviceDeps.DispatchAttempt = mockDispatchAttemptModel;
serviceDeps.User = mockUserModel;
serviceDeps.findEligibleCandidates = mockFindEligibleCandidates;
serviceDeps.getCandidateEtas = mockGetCandidateEtas;
serviceDeps.publishDispatchOffer = mockPublishDispatchOffer;
serviceDeps.publishResponderAssigned = mockPublishResponderAssigned;

workerDeps.Emergency = mockEmergencyModel;
workerDeps.DispatchAttempt = mockDispatchAttemptModel;
workerDeps.dispatchNextResponder = dispatchNextResponder;

// ─── Tests ────────────────────────────────────────────────────────────────────

await runSection("1. startDispatch — basic flow", async () => {
  resetStores();
  const em = makeEmergency();

  await startDispatch(em._id);

  const stored = _emergencyStore[em._id];
  logTest("dispatchStatus is 'offered' after startDispatch", stored.dispatchStatus === "offered");
  logTest("currentDispatchRadiusKm is 5 (first tier)", stored.currentDispatchRadiusKm === 5);
  logTest("one dispatch offer published", publishedOffers.length === 1);
  logTest("one DispatchAttempt created (pending)", Object.values(_attemptStore).length === 1 &&
    Object.values(_attemptStore)[0].status === "pending");
});

await runSection("2. startDispatch — skips non-active emergencies", async () => {
  resetStores();
  const em = makeEmergency({ status: "resolved" });

  await startDispatch(em._id);

  logTest("resolved emergency produces no offers", publishedOffers.length === 0);
  logTest("no attempts created for resolved emergency", Object.values(_attemptStore).length === 0);
});

await runSection("3. startDispatch — skips already-offered or assigned emergencies", async () => {
  resetStores();
  const em = makeEmergency({ dispatchStatus: "offered" });
  await startDispatch(em._id);
  logTest("already-offered emergency not re-dispatched", publishedOffers.length === 0);

  resetStores();
  const em2 = makeEmergency({ dispatchStatus: "assigned" });
  await startDispatch(em2._id);
  logTest("already-assigned emergency not re-dispatched", publishedOffers.length === 0);
});

await runSection("4. dispatchNextResponder — radius escalation when no candidates", async () => {
  resetStores();
  mockCandidates = [];

  const em = makeEmergency({ dispatchStatus: "searching", currentDispatchRadiusKm: 5 });
  await dispatchNextResponder(em._id);

  const stored = _emergencyStore[em._id];
  logTest("dispatchStatus is 'unavailable' when all tiers exhausted", stored.dispatchStatus === "unavailable");
  logTest("currentDispatchRadiusKm is 20 (last tier) when unavailable", stored.currentDispatchRadiusKm === 20);
  logTest("no offers published when no candidates", publishedOffers.length === 0);
  logTest("no attempts created when no candidates", Object.values(_attemptStore).length === 0);
});

await runSection("5. dispatchNextResponder — selects lowest-ETA candidate", async () => {
  resetStores();
  const c1 = defaultCandidate(0); c1.id = makeObjectId("resp");
  const c2 = defaultCandidate(1); c2.id = makeObjectId("resp");
  const c3 = defaultCandidate(2); c3.id = makeObjectId("resp");
  mockCandidates = [c1, c2, c3];
  mockEtas = [
    { responderId: c1.id, name: c1.name, durationSeconds: 360, estimated: false },
    { responderId: c2.id, name: c2.name, durationSeconds: 120, estimated: false },  // lowest
    { responderId: c3.id, name: c3.name, durationSeconds: 240, estimated: false }
  ];

  const em = makeEmergency({ dispatchStatus: "searching", currentDispatchRadiusKm: 5 });
  await dispatchNextResponder(em._id);

  const attempt = Object.values(_attemptStore)[0];
  logTest("lowest-ETA responder is selected, not first in list",
    attempt && attempt.responderId === c2.id);
  logTest("published offer carries correct etaSeconds",
    publishedOffers.length === 1 && publishedOffers[0].payload.etaSeconds === 120);
});

await runSection("6. dispatchNextResponder — excludes already-attempted responders", async () => {
  resetStores();
  const c1 = defaultCandidate(0); c1.id = makeObjectId("resp");
  const c2 = defaultCandidate(1); c2.id = makeObjectId("resp");
  mockCandidates = [c1, c2];
  mockEtas = null;

  const em = makeEmergency({ dispatchStatus: "searching", currentDispatchRadiusKm: 5 });
  // Simulate c1 already declined
  makeAttempt({ emergencyId: em._id, responderId: c1.id, status: "declined" });

  await dispatchNextResponder(em._id);

  const attempt = Object.values(_attemptStore).find(a => a.status === "pending");
  logTest("declined responder is excluded from next dispatch",
    attempt && attempt.responderId === c2.id);
});

await runSection("7. declineDispatchAttempt — marks attempt declined and re-dispatches", async () => {
  resetStores();
  const em = makeEmergency({ dispatchStatus: "offered", currentDispatchRadiusKm: 5 });
  const c1 = defaultCandidate(0); c1.id = makeObjectId("resp");
  const c2 = defaultCandidate(1); c2.id = makeObjectId("resp");
  mockCandidates = [c1, c2];
  mockEtas = null;

  const attempt = makeAttempt({ emergencyId: em._id, responderId: c1.id, status: "pending" });

  const result = await declineDispatchAttempt(attempt._id);

  logTest("declineDispatchAttempt returns { ok: true }", result.ok === true);
  logTest("declined attempt status is 'declined'", _attemptStore[attempt._id].status === "declined");
  logTest("re-dispatch offer sent to c2 (next candidate)",
    publishedOffers.some(o => o.responderId === c2.id));
  logTest("a new pending attempt exists for c2",
    Object.values(_attemptStore).some(a => a.responderId === c2.id && a.status === "pending"));
});

await runSection("8. declineDispatchAttempt — ignores already-resolved attempts, returns reason", async () => {
  resetStores();
  const em = makeEmergency();
  const acceptedAttempt = makeAttempt({ emergencyId: em._id, responderId: makeObjectId("r"), status: "accepted" });

  const result = await declineDispatchAttempt(acceptedAttempt._id);

  logTest("decline on accepted attempt returns { ok: false, reason: 'not_pending' }",
    result.ok === false && result.reason === "not_pending");
  logTest("attempt status unchanged (still 'accepted')", _attemptStore[acceptedAttempt._id].status === "accepted");
  logTest("no new offers published", publishedOffers.length === 0);
});

await runSection("8b. declineDispatchAttempt — reason: not_pending for expired, cancelled, nonexistent", async () => {
  resetStores();
  const em = makeEmergency();

  // Already declined
  const declinedAttempt = makeAttempt({ emergencyId: em._id, responderId: makeObjectId("r"), status: "declined" });
  const r1 = await declineDispatchAttempt(declinedAttempt._id);
  logTest("already-declined attempt returns { ok: false, reason: 'not_pending' }",
    r1.ok === false && r1.reason === "not_pending");

  // Already cancelled
  const cancelledAttempt = makeAttempt({ emergencyId: em._id, responderId: makeObjectId("r"), status: "cancelled" });
  const r2 = await declineDispatchAttempt(cancelledAttempt._id);
  logTest("cancelled attempt returns { ok: false, reason: 'not_pending' }",
    r2.ok === false && r2.reason === "not_pending");

  // Already expired status
  const expiredAttempt = makeAttempt({ emergencyId: em._id, responderId: makeObjectId("r"), status: "expired" });
  const r3 = await declineDispatchAttempt(expiredAttempt._id);
  logTest("expired-status attempt returns { ok: false, reason: 'not_pending' }",
    r3.ok === false && r3.reason === "not_pending");

  // Nonexistent ID
  const r4 = await declineDispatchAttempt(makeObjectId("nonexistent"));
  logTest("nonexistent attempt returns { ok: false, reason: 'not_pending' }",
    r4.ok === false && r4.reason === "not_pending");
});

await runSection("9. acceptDispatchAttempt — successful acceptance", async () => {
  resetStores();
  const responderId = makeObjectId("r");
  const em = makeEmergency({ dispatchStatus: "offered", currentDispatchRadiusKm: 5 });
  const attempt = makeAttempt({ emergencyId: em._id, responderId, etaSeconds: 90 });

  const result = await acceptDispatchAttempt(attempt._id, responderId);

  logTest("acceptDispatchAttempt returns { success: true }", result.success === true);
  logTest("attempt status is 'accepted'", _attemptStore[attempt._id].status === "accepted");
  logTest("emergency status is 'assigned'", _emergencyStore[em._id].status === "assigned");
  logTest("emergency dispatchStatus is 'assigned'", _emergencyStore[em._id].dispatchStatus === "assigned");
  logTest("emergency assignedResponder is set", _emergencyStore[em._id].assignedResponder === responderId);
  logTest("publishResponderAssigned was called once", publishedAssignments.length === 1);
  logTest("assignment payload has correct responderId",
    publishedAssignments[0]?.payload?.responderId === responderId);
});

await runSection("10. acceptDispatchAttempt — wrong responderId is rejected", async () => {
  resetStores();
  const realResponderId = makeObjectId("r");
  const fakeResponderId = makeObjectId("fake");
  const em = makeEmergency();
  const attempt = makeAttempt({ emergencyId: em._id, responderId: realResponderId });

  const result = await acceptDispatchAttempt(attempt._id, fakeResponderId);

  logTest("accept with wrong responderId returns { success: false, reason: 'already_assigned' }",
    result.success === false && result.reason === "already_assigned");
  logTest("attempt status unchanged (still 'pending')", _attemptStore[attempt._id].status === "pending");
  logTest("no assignment published", publishedAssignments.length === 0);
});

await runSection("11. acceptDispatchAttempt — concurrent accepts: exactly one wins", async () => {
  resetStores();
  const responderId = makeObjectId("r");
  const em = makeEmergency({ dispatchStatus: "offered" });
  const attempt = makeAttempt({ emergencyId: em._id, responderId });

  const [r1, r2] = await Promise.all([
    acceptDispatchAttempt(attempt._id, responderId),
    acceptDispatchAttempt(attempt._id, responderId)
  ]);

  const successes = [r1, r2].filter(r => r.success);
  logTest("exactly one accept succeeds", successes.length === 1);
  logTest("the failed contender gets { success: false, reason: 'already_assigned' }",
    [r1, r2].some(r => r.success === false && r.reason === "already_assigned"));
  logTest("exactly one publishResponderAssigned emitted", publishedAssignments.length === 1);
});

await runSection("12. acceptDispatchAttempt — cancels other pending attempts", async () => {
  resetStores();
  const responderId1 = makeObjectId("r1");
  const responderId2 = makeObjectId("r2");
  const em = makeEmergency({ dispatchStatus: "offered" });

  const attempt1 = makeAttempt({ emergencyId: em._id, responderId: responderId1 });
  const attempt2 = makeAttempt({ emergencyId: em._id, responderId: responderId2 });

  await acceptDispatchAttempt(attempt1._id, responderId1);

  logTest("accepting attempt1 cancels attempt2",
    _attemptStore[attempt2._id].status === "cancelled");
  logTest("accepted attempt1 stays 'accepted'",
    _attemptStore[attempt1._id].status === "accepted");
});

await runSection("13. runExpirySweep — expires pending attempts and re-dispatches", async () => {
  resetStores();
  const c1 = defaultCandidate(0); c1.id = makeObjectId("resp");
  const c2 = defaultCandidate(1); c2.id = makeObjectId("resp");
  mockCandidates = [c1, c2];
  mockEtas = null;

  const em = makeEmergency({ dispatchStatus: "offered", currentDispatchRadiusKm: 5 });
  const expiredAttempt = makeAttempt({
    emergencyId: em._id,
    responderId: c1.id,
    expiresAt: new Date(Date.now() - 1000)
  });

  await runExpirySweep();

  logTest("expired attempt is marked 'expired'", _attemptStore[expiredAttempt._id].status === "expired");
  logTest("re-dispatch offer sent to c2 after expiry",
    publishedOffers.some(o => o.responderId === c2.id));
  const newPending = Object.values(_attemptStore).find(
    a => a.status === "pending" && a.responderId === c2.id
  );
  logTest("new pending attempt created for c2", !!newPending);
});

await runSection("14. runExpirySweep — ignores already-resolved attempts", async () => {
  resetStores();
  mockCandidates = [];
  const em = makeEmergency();
  makeAttempt({ emergencyId: em._id, responderId: makeObjectId("r"), status: "accepted", expiresAt: new Date(Date.now() - 1000) });
  makeAttempt({ emergencyId: em._id, responderId: makeObjectId("r"), status: "declined", expiresAt: new Date(Date.now() - 1000) });

  await runExpirySweep();

  logTest("resolved/declined attempts not re-expired, no spurious offers",
    publishedOffers.length === 0);
});

await runSection("15. radius escalation — escalates step by step when no candidates", async () => {
  resetStores();
  mockCandidates = [];
  const em = makeEmergency({ dispatchStatus: "searching", currentDispatchRadiusKm: 5 });

  await dispatchNextResponder(em._id);
  const stored = _emergencyStore[em._id];
  logTest("radius escalates to 20 and sets unavailable when no candidates at any tier",
    stored.dispatchStatus === "unavailable" && stored.currentDispatchRadiusKm === 20);
});

await runSection("16a. OSRM failure — Feature 3 Haversine fallback ETAs are used, lowest selected", async () => {
  resetStores();
  const c1 = defaultCandidate(0); c1.id = makeObjectId("resp");
  const c2 = defaultCandidate(1); c2.id = makeObjectId("resp");
  const c3 = defaultCandidate(2); c3.id = makeObjectId("resp");
  mockCandidates = [c1, c2, c3];
  // Simulate getCandidateEtas returning estimated ETAs (as routeService fallback does)
  // c3 is closest in this scenario and gets the lowest estimated ETA
  mockEtas = [
    { responderId: c1.id, name: c1.name, durationSeconds: 480, estimated: true },
    { responderId: c2.id, name: c2.name, durationSeconds: 300, estimated: true },
    { responderId: c3.id, name: c3.name, durationSeconds: 90,  estimated: true }  // lowest
  ];

  const em = makeEmergency({ dispatchStatus: "searching", currentDispatchRadiusKm: 5 });
  await dispatchNextResponder(em._id);

  const attempt = Object.values(_attemptStore)[0];
  logTest("[16a] responder with lowest estimated ETA is selected",
    attempt && attempt.responderId === c3.id);
  logTest("[16a] exactly one offer published", publishedOffers.length === 1);
  logTest("[16a] published offer etaSeconds matches estimated ETA",
    publishedOffers[0]?.payload?.etaSeconds === 90);
  logTest("[16a] published offer carries etaEstimated: true",
    publishedOffers[0]?.payload?.etaEstimated === true);
  logTest("[16a] attempt etaSeconds is 90", attempt?.etaSeconds === 90);
  logTest("[16a] emergency dispatchStatus is 'offered'", _emergencyStore[em._id].dispatchStatus === "offered");
});

await runSection("16b. Genuine ETA failure (empty result) — no attempt, no offer, stays 'searching'", async () => {
  resetStores();
  const c1 = defaultCandidate(0); c1.id = makeObjectId("resp");
  mockCandidates = [c1];
  // Override getCandidateEtas to return an empty array — simulates total ETA unavailability
  serviceDeps.getCandidateEtas = async () => [];

  const em = makeEmergency({ dispatchStatus: "searching", currentDispatchRadiusKm: 5 });
  await dispatchNextResponder(em._id);

  logTest("[16b] no attempt created when ETA result is empty", Object.values(_attemptStore).length === 0);
  logTest("[16b] no offer published when ETA result is empty", publishedOffers.length === 0);
  // Emergency stays at its last saved state (searching); dispatchStatus not changed to offered/unavailable
  logTest("[16b] emergency dispatchStatus is not 'offered'",
    _emergencyStore[em._id].dispatchStatus !== "offered");

  // Restore the default mock
  serviceDeps.getCandidateEtas = mockGetCandidateEtas;
});

await runSection("17. dispatchNextResponder — no-op for non-active emergency", async () => {
  resetStores();
  const em = makeEmergency({ status: "resolved", dispatchStatus: "searching", currentDispatchRadiusKm: 5 });
  await dispatchNextResponder(em._id);
  logTest("resolved emergency produces no dispatch offer", publishedOffers.length === 0);

  resetStores();
  const em2 = makeEmergency({ status: "cancelled", currentDispatchRadiusKm: 5 });
  await dispatchNextResponder(em2._id);
  logTest("cancelled emergency produces no dispatch offer", publishedOffers.length === 0);
});

await runSection("18. dispatchNextResponder — no-op for already-assigned emergency", async () => {
  resetStores();
  const responderId = makeObjectId("r");
  const em = makeEmergency({ status: "active", dispatchStatus: "assigned", assignedResponder: responderId, currentDispatchRadiusKm: 5 });
  await dispatchNextResponder(em._id);
  logTest("assigned emergency not re-dispatched", publishedOffers.length === 0);
});

await runSection("19. acceptDispatchAttempt — non-active or already-assigned emergency rejected", async () => {
  resetStores();
  const responderId = makeObjectId("r");
  const em = makeEmergency({ status: "resolved" });
  const attempt = makeAttempt({ emergencyId: em._id, responderId });

  const result = await acceptDispatchAttempt(attempt._id, responderId);
  logTest("accept on resolved emergency returns { success: false, reason: 'already_assigned' }",
    result.success === false && result.reason === "already_assigned");
});

await runSection("19b. acceptDispatchAttempt — expired but still pending attempt must fail", async () => {
  resetStores();
  const responderId = makeObjectId("r");
  const em = makeEmergency({ status: "active" });
  const attempt = makeAttempt({
    emergencyId: em._id,
    responderId,
    expiresAt: new Date(Date.now() - 5000), // expired 5 seconds ago
    status: "pending"
  });

  const result = await acceptDispatchAttempt(attempt._id, responderId);
  logTest("accept on expired attempt returns { success: false, reason: 'already_assigned' }",
    result.success === false && result.reason === "already_assigned");
  logTest("expired attempt status is not accepted", _attemptStore[attempt._id].status === "pending");
});

await runSection("20. full flow: start → decline → expire → accept", async () => {
  resetStores();
  const c1 = defaultCandidate(0); c1.id = makeObjectId("rC1");
  const c2 = defaultCandidate(1); c2.id = makeObjectId("rC2");
  const c3 = defaultCandidate(2); c3.id = makeObjectId("rC3");

  mockCandidates = [c1, c2, c3];
  mockEtas = null;

  const em = makeEmergency();
  // 1. Start → offers c1
  await startDispatch(em._id);
  const firstAttempt = Object.values(_attemptStore).find(a => a.responderId === c1.id);
  logTest("[full flow] first offer goes to lowest-ETA responder (c1)", !!firstAttempt && _emergencyStore[em._id].dispatchStatus === "offered");

  // 2. c1 declines → re-dispatches → offers c2
  await declineDispatchAttempt(firstAttempt._id);
  const secondAttempt = Object.values(_attemptStore).find(a => a.responderId === c2.id && a.status === "pending");
  logTest("[full flow] after decline, c2 receives offer", !!secondAttempt);

  // 3. c2's attempt expires → re-dispatches → offers c3
  _attemptStore[secondAttempt._id] = { ..._attemptStore[secondAttempt._id], expiresAt: new Date(Date.now() - 1) };
  await runExpirySweep();
  const thirdAttempt = Object.values(_attemptStore).find(a => a.responderId === c3.id && a.status === "pending");
  logTest("[full flow] after expiry, c3 receives offer", !!thirdAttempt);

  // 4. c3 accepts
  const acceptResult = await acceptDispatchAttempt(thirdAttempt._id, c3.id);
  logTest("[full flow] c3 accept succeeds", acceptResult.success === true);
  logTest("[full flow] emergency status is 'assigned'", _emergencyStore[em._id].status === "assigned");
  logTest("[full flow] publishResponderAssigned called exactly once", publishedAssignments.length === 1);

  // 5. Verify all previous attempts cancelled/declined/expired
  const pendingLeft = Object.values(_attemptStore).filter(a => a.status === "pending");
  logTest("[full flow] no pending attempts remain after assignment", pendingLeft.length === 0);
});

await runSection("21. worker start and stop clean cleanup test", async () => {
  const workerObj = startDispatchWorker();
  logTest("worker starts successfully", typeof workerObj === "object" && typeof workerObj.stop === "function");
  workerObj.stop();
});

// ─── Results ──────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log("\nFailed tests:");
  failures.forEach(f => console.log(`  ✗ ${f}`));
}
console.log("─".repeat(60));

process.exit(failed > 0 ? 1 : 0);
