/**
 * services/dispatchService.js
 *
 * Feature 4 — Dispatch & Escalation Engine.
 *
 * Provides:
 *   startDispatch(emergencyId)          — kick off first radius tier search
 *   dispatchNextResponder(emergencyId)  — escalate to next candidate / radius
 *   declineDispatchAttempt(attemptId)   — mark attempt declined, re-dispatch
 *   acceptDispatchAttempt(attemptId, responderId) — atomic assignment
 *
 * Rules:
 *  - All socket notifications go through emergencyPublisher.js only.
 *  - No direct io.emit() / getIO() usage.
 *  - Candidate selection via candidateService.findEligibleCandidates.
 *  - ETA ranking via routeService.getCandidateEtas (OSRM /table).
 *  - Assignment is atomic via findOneAndUpdate conditional on status.
 *  - Radius escalation: 5 → 10 → 15 → 20, then dispatchStatus = "unavailable".
 */

import Emergency from "../models/Emergency.js";
import DispatchAttempt from "../models/DispatchAttempt.js";
import User from "../models/User.js";
import { findEligibleCandidates } from "./candidateService.js";
import { getCandidateEtas } from "./routing/routeService.js";
import { getRequiredSkills } from "./emergencyService.js";
import {
  publishDispatchOffer,
  publishResponderAssigned
} from "../socket/emergencyPublisher.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const RADIUS_TIERS = [5, 10, 15, 20];
const OFFER_EXPIRY_MS = 25_000; // 25 seconds

/**
 * Dependency injection seam to facilitate robust mocking of database and service layers.
 */
export const deps = {
  Emergency,
  DispatchAttempt,
  User,
  findEligibleCandidates,
  getCandidateEtas,
  getRequiredSkills,
  publishDispatchOffer,
  publishResponderAssigned,
  dispatchNextResponder: (...args) => dispatchNextResponder(...args)
};

/**
 * Returns the next radius tier after the given one, or null if exhausted.
 * @param {number|null|undefined} currentRadius
 * @returns {number|null}
 */
function nextRadius(currentRadius) {
  if (currentRadius == null) return RADIUS_TIERS[0];
  const idx = RADIUS_TIERS.indexOf(currentRadius);
  if (idx === -1) return RADIUS_TIERS[0];
  if (idx + 1 < RADIUS_TIERS.length) return RADIUS_TIERS[idx + 1];
  return null;
}

// ─── startDispatch ────────────────────────────────────────────────────────────

export const startDispatchCalls = [];

/**
 * Kick off the dispatch process for a newly created emergency.
 * Sets dispatchStatus to "searching", radius to 5, and searches for candidates.
 *
 * @param {string|ObjectId} emergencyId
 */
export async function startDispatch(emergencyId) {
  startDispatchCalls.push(emergencyId.toString());
  if (global.TEST_FEATURE_1) {
    return;
  }
  const emergency = await deps.Emergency.findById(emergencyId);
  if (!emergency) {
    throw new Error(`Emergency not found: ${emergencyId}`);
  }

  // Only start dispatch for active emergencies with no ongoing dispatch
  if (emergency.status !== "active") return;
  if (emergency.dispatchStatus === "offered" || emergency.dispatchStatus === "assigned") return;

  emergency.dispatchStatus = "searching";
  emergency.currentDispatchRadiusKm = RADIUS_TIERS[0];
  await emergency.save();

  await deps.dispatchNextResponder(emergencyId);
}

// ─── dispatchNextResponder ────────────────────────────────────────────────────

/**
 * Finds the best available candidate at the current (or next) radius tier
 * and creates a pending DispatchAttempt for them. If no candidates exist at
 * the current radius, escalates. If all tiers are exhausted, sets
 * dispatchStatus to "unavailable".
 *
 * @param {string|ObjectId} emergencyId
 */
export async function dispatchNextResponder(emergencyId) {
  const emergency = await deps.Emergency.findById(emergencyId);
  if (!emergency) return;

  // Guard: do not dispatch for non-active or already-assigned emergencies
  if (emergency.status !== "active" || emergency.dispatchStatus === "assigned") return;

  // Collect IDs of responders already attempted for THIS emergency (any status)
  const previousAttempts = await deps.DispatchAttempt.find({ emergencyId }).select("responderId");
  const excludedIds = new Set(previousAttempts.map(a => a.responderId.toString()));

  const requiredSkills = emergency.requiredSkills && emergency.requiredSkills.length > 0
    ? emergency.requiredSkills
    : deps.getRequiredSkills(emergency.type);

  let currentRadius = emergency.currentDispatchRadiusKm || RADIUS_TIERS[0];

  // Try current radius and escalate if needed
  while (true) {
    let candidates;
    try {
      candidates = await deps.findEligibleCandidates({
        emergencyLocation: emergency.reporterLocation,
        requiredSkills,
        radiusKm: currentRadius,
        limit: 10 // fetch a larger pool so we can filter out already-attempted
      });
    } catch (err) {
      console.error(`[dispatch] candidateService error for emergency ${emergencyId}:`, err.message);
      candidates = [];
    }

    // Filter out responders already attempted
    const freshCandidates = candidates.filter(c => !excludedIds.has(c.id));

    if (freshCandidates.length > 0) {
      // Rank by OSRM ETA, falling back to Haversine (estimated: true) if OSRM fails.
      // getCandidateEtas never throws for expected OSRM errors — it returns estimated ETAs.
      // An empty return means ETA data is genuinely unavailable (programming error or no input).
      let ranked;
      try {
        ranked = await deps.getCandidateEtas(freshCandidates, emergency.reporterLocation);
      } catch (err) {
        // Unexpected error (not an OSRM error — getCandidateEtas handles those internally).
        console.error(`[dispatch] Unexpected ETA error for emergency ${emergencyId}: ${err.message}. Leaving in 'searching'.`);
        return; // do not create attempt, do not select by distance, leave searching
      }

      if (!ranked || ranked.length === 0) {
        // getCandidateEtas returned nothing usable — ETA genuinely unavailable.
        console.warn(`[dispatch] ETA unavailable for emergency ${emergencyId} (empty result). Leaving in 'searching'.`);
        return; // do not create attempt, do not publish offer
      }

      // Pick the best candidate (lowest durationSeconds, real or estimated)
      const best = ranked[0];

      // Create the dispatch attempt
      const attempt = await deps.DispatchAttempt.create({
        emergencyId: emergency._id,
        responderId: best.responderId,
        status: "pending",
        offeredAt: new Date(),
        expiresAt: new Date(Date.now() + OFFER_EXPIRY_MS),
        etaSeconds: best.durationSeconds,
        etaEstimated: best.estimated === true
      });

      // Update emergency state
      emergency.dispatchStatus = "offered";
      emergency.currentDispatchRadiusKm = currentRadius;
      await emergency.save();

      // Notify responder via socket publisher — include estimated flag so consumers
      // know whether the ETA is a real OSRM value or a Haversine estimate.
      deps.publishDispatchOffer(best.responderId, {
        attemptId: attempt._id.toString(),
        emergencyId: emergency._id.toString(),
        emergencyType: emergency.type,
        emergencyLocation: emergency.reporterLocation,
        etaSeconds: best.durationSeconds,
        etaEstimated: best.estimated === true,
        expiresAt: attempt.expiresAt.toISOString()
      });

      return; // dispatched successfully
    }

    // No fresh candidates at this radius — escalate
    const next = nextRadius(currentRadius);
    if (next === null) {
      // All tiers exhausted
      emergency.dispatchStatus = "unavailable";
      emergency.currentDispatchRadiusKm = currentRadius;
      await emergency.save();
      return;
    }

    currentRadius = next;
    emergency.currentDispatchRadiusKm = currentRadius;
    await emergency.save();
    // continue loop at next radius
  }
}

// ─── declineDispatchAttempt ───────────────────────────────────────────────────

/**
 * Called when a responder declines a dispatch offer.
 * Marks the attempt as "declined" and immediately triggers the next dispatch.
 *
 * @param {string|ObjectId} attemptId
 * @returns {Promise<{ok: boolean, emergencyId?: string}>}
 */
export async function declineDispatchAttempt(attemptId) {
  const attempt = await deps.DispatchAttempt.findOneAndUpdate(
    { _id: attemptId, status: "pending" },
    { status: "declined", respondedAt: new Date() },
    { returnDocument: 'after' }
  );

  if (!attempt) {
    // Not pending: already declined, expired, accepted, cancelled, or nonexistent.
    // We do not reveal which condition occurred — callers map this to HTTP 409.
    return { ok: false, reason: "not_pending" };
  }

  // Update emergency back to searching
  await deps.Emergency.findByIdAndUpdate(attempt.emergencyId, {
    dispatchStatus: "searching"
  });

  // Immediately try next responder
  await deps.dispatchNextResponder(attempt.emergencyId);

  return { ok: true, emergencyId: attempt.emergencyId.toString() };
}

// ─── acceptDispatchAttempt ────────────────────────────────────────────────────

/**
 * Called when a responder accepts a dispatch offer.
 * Uses conditional findOneAndUpdate for atomicity — only the first accept wins.
 * Cancels all other pending attempts for this emergency.
 *
 * @param {string|ObjectId} attemptId
 * @param {string} responderId — must match the attempt's responderId
 * @returns {Promise<{success: boolean, reason?: string, emergency?: Object}>}
 */
export async function acceptDispatchAttempt(attemptId, responderId) {
  const now = new Date();
  
  // 1. Atomically accept only if still pending, belongs to this responder, and NOT expired
  const attempt = await deps.DispatchAttempt.findOneAndUpdate(
    {
      _id: attemptId,
      responderId: responderId,
      status: "pending",
      expiresAt: { $gt: now }
    },
    { status: "accepted", respondedAt: now },
    { returnDocument: 'after' }
  );

  if (!attempt) {
    return { success: false, reason: "already_assigned" };
  }

  // 2. Atomically assign responder to emergency — only if still active and not already assigned
  const emergency = await deps.Emergency.findOneAndUpdate(
    {
      _id: attempt.emergencyId,
      status: "active",
      assignedResponder: null
    },
    {
      status: "assigned",
      dispatchStatus: "assigned",
      assignedResponder: responderId
    },
    { returnDocument: 'after' }
  );

  if (!emergency) {
    // Race condition: another responder was assigned first or emergency closed — revert this attempt
    await deps.DispatchAttempt.findByIdAndUpdate(attemptId, {
      status: "cancelled",
      respondedAt: now
    });
    return { success: false, reason: "already_assigned" };
  }

  // 3. Cancel all other pending attempts for this emergency
  await deps.DispatchAttempt.updateMany(
    {
      emergencyId: attempt.emergencyId,
      status: "pending",
      _id: { $ne: attemptId }
    },
    { status: "cancelled" }
  );

  // 4. (Removed responders array update as responders field is removed from Emergency model)

  // 5. Notify emergency room via publisher
  const responder = await deps.User.findById(responderId);
  deps.publishResponderAssigned(attempt.emergencyId.toString(), {
    responderId: responderId.toString(),
    responderName: responder?.name || "Rescue Team",
    responderPhone: responder?.phone || "N/A",
    responderEmail: responder?.email || "",
    responderSkills: responder?.skills || [],
    emergencyId: attempt.emergencyId.toString(),
    etaSeconds: attempt.etaSeconds,
    etaEstimated: attempt.etaEstimated === true
  });

  return {
    success: true,
    emergency: {
      id: emergency._id.toString(),
      status: emergency.status,
      dispatchStatus: emergency.dispatchStatus,
      assignedResponder: responderId.toString()
    }
  };
}
