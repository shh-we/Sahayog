/**
 * test-diag-candidate.js
 * Diagnostic: directly calls findEligibleCandidates against the live MongoDB
 * to pinpoint why dispatch:offer is not being produced.
 *
 * Usage: node test-diag-candidate.js <responderId> <lat> <lon>
 * e.g.:  node test-diag-candidate.js 6a55dbd4a94f1be187cbad9a 27.7172 85.3240
 *
 * Run from /backend with the server NOT running (or it will share the connection).
 */

import "dotenv/config";
import mongoose from "mongoose";
import { findEligibleCandidates } from "./services/candidateService.js";
import User from "./models/User.js";
import Emergency from "./models/Emergency.js";

const [,, responderId, latArg, lonArg] = process.argv;
const LAT = latArg ? Number(latArg) : 27.7172;
const LON = lonArg ? Number(lonArg) : 85.3240;
const RADIUS_TIERS = [5, 10, 15, 20];

async function run() {
  console.log("\n─── Diagnostic: findEligibleCandidates ───────────────────\n");
  
  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB connected.\n");

  // 1. Show the responder doc
  if (responderId) {
    const r = await User.findById(responderId).select("-password");
    if (!r) {
      console.error(`Responder ${responderId} not found.`);
    } else {
      console.log("Responder doc:");
      console.log(`  _id:         ${r._id}`);
      console.log(`  role:        ${r.role}`);
      console.log(`  isAvailable: ${r.isAvailable}`);
      console.log(`  skills:      ${JSON.stringify(r.skills)}`);
      console.log(`  location:    ${JSON.stringify(r.location)}`);
      console.log();
    }
  }

  // 2. Try all radius tiers
  const emergencyLocation = [LON, LAT]; // [lon, lat]
  console.log(`Emergency location: [lon=${LON}, lat=${LAT}]`);
  console.log(`Required skills: ["medical"]\n`);

  for (const radius of RADIUS_TIERS) {
    try {
      const candidates = await findEligibleCandidates({
        emergencyLocation,
        requiredSkills: ["medical"],
        radiusKm: radius,
        limit: 10
      });
      console.log(`Radius ${radius}km: ${candidates.length} candidate(s)`);
      if (candidates.length > 0) {
        candidates.forEach(c => console.log(`  • ${c.id} ${c.name} (${c.distanceKm}km)`));
      }
    } catch (err) {
      console.error(`Radius ${radius}km: ERROR — ${err.message}`);
    }
  }

  // 3. Raw MongoDB $near query (bypass Mongoose schema interpretation)
  console.log("\n─── Raw $near query via Mongoose ───────────────────────\n");
  try {
    const raw = await User.find({
      role: "responder",
      isAvailable: true,
      skills: { $in: ["medical"] },
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [LON, LAT] },
          $maxDistance: 20 * 1000
        }
      }
    }).select("_id name location isAvailable skills");
    console.log(`Raw $near (20km) results: ${raw.length}`);
    raw.forEach(r => console.log(`  • ${r._id} ${r.name} loc=${JSON.stringify(r.location)}`));
  } catch (err) {
    console.error(`Raw $near query ERROR: ${err.message}`);
  }

  // 4. Count all available responders without geo filter
  const allAvail = await User.find({ role: "responder", isAvailable: true }).select("_id name location skills");
  console.log(`\nAll available responders in DB: ${allAvail.length}`);
  allAvail.forEach(r => {
    console.log(`  • ${r._id} ${r.name} skills=${JSON.stringify(r.skills)} location=${JSON.stringify(r.location)}`);
  });

  await mongoose.disconnect();
  console.log("\nDone.\n");
}

run().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
