/**
 * workers/dispatchWorker.js
 *
 * Background sweep for expired dispatch attempts.
 *
 * On startup (and then on every SWEEP_INTERVAL_MS tick) it:
 *   1. Finds all DispatchAttempt documents with status "pending" whose
 *      expiresAt has passed.
 *   2. Marks each as "expired" (one by one so each emergency gets exactly
 *      one dispatchNextResponder call per expired attempt).
 *   3. Calls dispatchNextResponder for the related emergency.
 *
 * The worker also runs an immediate startup sweep to recover attempts that
 * expired while the server was offline.
 *
 * Call stop() (returned by start()) to cancel the interval — useful in tests.
 */

import DispatchAttempt from "../models/DispatchAttempt.js";
import Emergency from "../models/Emergency.js";
import { dispatchNextResponder } from "../services/dispatchService.js";

const SWEEP_INTERVAL_MS = 10_000; // 10 seconds between sweeps

/**
 * Dependency injection seam to facilitate robust mocking of database and service layers.
 */
export const deps = {
  DispatchAttempt,
  Emergency,
  dispatchNextResponder
};

/**
 * Performs one sweep: finds and processes all expired pending attempts.
 * Exported for direct use in tests.
 */
export async function runExpirySweep() {
  const now = new Date();

  // Find all pending attempts whose expiry has passed
  const expired = await deps.DispatchAttempt.find({
    status: "pending",
    expiresAt: { $lte: now }
  }).select("_id emergencyId");

  for (const attempt of expired) {
    // Atomically mark as expired — skip if another process already changed it
    const updated = await deps.DispatchAttempt.findOneAndUpdate(
      { _id: attempt._id, status: "pending" },
      { status: "expired" },
      { new: true }
    );

    if (!updated) continue; // already handled

    // Re-set emergency dispatch status to searching (if still active/offered)
    await deps.Emergency.findOneAndUpdate(
      {
        _id: attempt.emergencyId,
        status: "active",
        dispatchStatus: "offered"
      },
      { dispatchStatus: "searching" }
    );

    // Trigger next dispatch cycle for this emergency
    try {
      await deps.dispatchNextResponder(attempt.emergencyId);
    } catch (err) {
      console.error(
        `[dispatchWorker] dispatchNextResponder failed for emergency ${attempt.emergencyId}:`,
        err.message
      );
    }
  }

  if (expired.length > 0) {
    console.log(`[dispatchWorker] Processed ${expired.length} expired attempt(s).`);
  }
}

/**
 * Starts the dispatch worker.
 * Performs an immediate startup sweep then schedules recurring sweeps.
 *
 * @returns {{ stop: Function }} — call stop() to cancel the interval.
 */
export function startDispatchWorker() {
  console.log("[dispatchWorker] Starting — running startup sweep...");

  // Immediate sweep to recover from server restarts
  runExpirySweep().catch(err =>
    console.error("[dispatchWorker] Startup sweep error:", err.message)
  );

  // Recurring sweep
  const intervalId = setInterval(() => {
    runExpirySweep().catch(err =>
      console.error("[dispatchWorker] Sweep error:", err.message)
    );
  }, SWEEP_INTERVAL_MS);

  return {
    stop() {
      clearInterval(intervalId);
      console.log("[dispatchWorker] Stopped.");
    }
  };
}
