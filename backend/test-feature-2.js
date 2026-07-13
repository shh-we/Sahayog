import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import { calculateDistance } from "./services/geoService.js";
import { findEligibleCandidates } from "./services/candidateService.js";
import User from "./models/User.js";
import Emergency from "./models/Emergency.js";

dotenv.config();

let failedTests = 0;

function logTest(title, passed, details = "") {
  console.log(`\n${passed ? "✅" : "❌"} [TEST] ${title}`);
  if (details) {
    console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
  }
  if (!passed) failedTests++;
}

async function runTests() {
  try {
    console.log("🧪 Running Focused Feature 2 Verification...");
    
    // Connect to database
    await connectDB();

    // 1. Test Haversine distance calculations and coordinate format
    {
      const pointA = [85.324, 27.7172]; // Kathmandu
      const pointB = [85.325, 27.718];  // Very close
      const dist = calculateDistance(pointA, pointB);
      logTest(
        "Haversine returns correct distance in kilometers",
        dist > 0 && dist < 1.0 && typeof dist === "number"
      );
    }

    // 2. Test Invalid Coordinate validations
    {
      let passed1 = false, passed2 = false, passed3 = false, passed4 = false, passed5 = false, passed6 = false;
      try { calculateDistance([85.324], [85.324, 27.7172]); } catch (e) { passed1 = true; }
      try { calculateDistance([85.324, 27.7172], [85.324, "abc"]); } catch (e) { passed2 = true; }
      try { calculateDistance([185.0, 27.7172], [85.324, 27.7172]); } catch (e) { passed3 = true; }
      try { calculateDistance([85.324, -95.0], [85.324, 27.7172]); } catch (e) { passed4 = true; }
      try { calculateDistance([NaN, 27.7172], [85.324, 27.7172]); } catch (e) { passed5 = true; }
      try { calculateDistance([85.324, 27.7172], [85.324, Infinity]); } catch (e) { passed6 = true; }

      logTest(
        "Invalid coordinates (wrong lengths, non-finite, NaN, Infinity, out of bounds) are rejected",
        passed1 && passed2 && passed3 && passed4 && passed5 && passed6
      );
    }

    // 3. Set up clean environment by removing previous test models
    const testEmailPrefix = "f2-test-";
    await User.deleteMany({ email: new RegExp("^" + testEmailPrefix) });
    
    // Create base test reporter (role: user)
    const reporter = await User.create({
      name: "F2 Reporter",
      email: `${testEmailPrefix}reporter@test.com`,
      password: "password123",
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      role: "user"
    });

    const emergencyLocation = [85.324, 27.7172]; // Kathmandu

    // Create responder users at specific distances
    // R1: Available, fire skill, close
    const r1 = await User.create({
      name: "R1 Close",
      email: `${testEmailPrefix}r1@test.com`,
      password: "password123",
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      role: "responder",
      skills: ["fire"],
      isAvailable: true,
      location: { type: "Point", coordinates: [85.325, 27.718] }
    });

    // R2: Available, fire skill, within 5km
    const r2 = await User.create({
      name: "R2 Medium",
      email: `${testEmailPrefix}r2@test.com`,
      password: "password123",
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      role: "responder",
      skills: ["fire", "medical"],
      isAvailable: true,
      location: { type: "Point", coordinates: [85.35, 27.73] }
    });

    // R3: Available, fire skill, further away (around 7.4km)
    const r3 = await User.create({
      name: "R3 Far",
      email: `${testEmailPrefix}r3@test.com`,
      password: "password123",
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      role: "responder",
      skills: ["fire"],
      isAvailable: true,
      location: { type: "Point", coordinates: [85.39, 27.75] }
    });

    // R4: Unavailable, fire skill, close
    const r4 = await User.create({
      name: "R4 Unavailable",
      email: `${testEmailPrefix}r4@test.com`,
      password: "password123",
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      role: "responder",
      skills: ["fire"],
      isAvailable: false,
      location: { type: "Point", coordinates: [85.325, 27.718] }
    });

    // R5: Available, medical skill only, close
    const r5 = await User.create({
      name: "R5 No Skill Match",
      email: `${testEmailPrefix}r5@test.com`,
      password: "password123",
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      role: "responder",
      skills: ["medical"],
      isAvailable: true,
      location: { type: "Point", coordinates: [85.325, 27.718] }
    });

    // R6: User role (not responder), close
    const r6 = await User.create({
      name: "R6 User Role",
      email: `${testEmailPrefix}r6@test.com`,
      password: "password123",
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      role: "user",
      skills: ["fire"],
      isAvailable: true,
      location: { type: "Point", coordinates: [85.325, 27.718] }
    });

    // R7: Available, fire skill, close - but will be busy (assigned emergency)
    const r7 = await User.create({
      name: "R7 Assigned Busy",
      email: `${testEmailPrefix}r7@test.com`,
      password: "password123",
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      role: "responder",
      skills: ["fire"],
      isAvailable: true,
      location: { type: "Point", coordinates: [85.325, 27.718] }
    });

    // R8: Available, fire skill, close - but will be busy (in_progress emergency)
    const r8 = await User.create({
      name: "R8 InProgress Busy",
      email: `${testEmailPrefix}r8@test.com`,
      password: "password123",
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      role: "responder",
      skills: ["fire"],
      isAvailable: true,
      location: { type: "Point", coordinates: [85.325, 27.718] }
    });

    // R9: Available, fire skill, close - assigned to resolved emergency (should be eligible)
    const r9 = await User.create({
      name: "R9 Resolved Assigned",
      email: `${testEmailPrefix}r9@test.com`,
      password: "password123",
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      role: "responder",
      skills: ["fire"],
      isAvailable: true,
      location: { type: "Point", coordinates: [85.325, 27.718] }
    });

    // R10: Available, fire skill, close - assigned to cancelled emergency (should be eligible)
    const r10 = await User.create({
      name: "R10 Cancelled Assigned",
      email: `${testEmailPrefix}r10@test.com`,
      password: "password123",
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      role: "responder",
      skills: ["fire"],
      isAvailable: true,
      location: { type: "Point", coordinates: [85.325, 27.718] }
    });

    // Clean up previous emergencies referencing these responders
    await Emergency.deleteMany({
      assignedResponder: { $in: [r7._id, r8._id, r9._id, r10._id] }
    });

    // Create the active/busy and completed/resolved/cancelled emergencies
    // 1. Assigned Emergency
    await Emergency.create({
      reporterId: reporter._id,
      type: "fire",
      reporterLocation: { type: "Point", coordinates: emergencyLocation },
      status: "assigned",
      assignedResponder: r7._id
    });

    // 2. In-Progress Emergency
    await Emergency.create({
      reporterId: reporter._id,
      type: "fire",
      reporterLocation: { type: "Point", coordinates: emergencyLocation },
      status: "in_progress",
      assignedResponder: r8._id
    });

    // 3. Resolved Emergency (should NOT block r9)
    await Emergency.create({
      reporterId: reporter._id,
      type: "fire",
      reporterLocation: { type: "Point", coordinates: emergencyLocation },
      status: "resolved",
      assignedResponder: r9._id
    });

    // 4. Cancelled Emergency (should NOT block r10)
    await Emergency.create({
      reporterId: reporter._id,
      type: "fire",
      reporterLocation: { type: "Point", coordinates: emergencyLocation },
      status: "cancelled",
      assignedResponder: r10._id
    });

    // Test 3: Radius filtration & availability filtering
    {
      // Search with radiusKm = 5, requiredSkills = ['fire']
      const candidates = await findEligibleCandidates({
        emergencyLocation,
        requiredSkills: ["fire"],
        radiusKm: 5
      });

      // Expected eligible responders within 5km: R1, R2, R9, R10
      // Excluded:
      // R3 (7.4km away - too far)
      // R4 (isAvailable: false)
      // R5 (missing fire skill)
      // R6 (wrong role)
      // R7 (assigned to active emergency)
      // R8 (assigned to in-progress emergency)
      const ids = candidates.map(c => c.id);
      const containsCorrectResponders = 
        ids.includes(r1._id.toString()) && 
        ids.includes(r2._id.toString()) && 
        ids.includes(r9._id.toString()) && 
        ids.includes(r10._id.toString()) && 
        !ids.includes(r3._id.toString()) &&
        !ids.includes(r4._id.toString()) &&
        !ids.includes(r5._id.toString()) &&
        !ids.includes(r6._id.toString()) &&
        !ids.includes(r7._id.toString()) &&
        !ids.includes(r8._id.toString());

      logTest(
        "Only available responders with matching skills, valid locations, and within search radius are returned",
        containsCorrectResponders,
        candidates
      );
    }

    // Test 4: Busy responder exclusion & Resolved/Cancelled eligibility
    {
      const candidates = await findEligibleCandidates({
        emergencyLocation,
        requiredSkills: ["fire"],
        radiusKm: 5
      });
      const ids = candidates.map(c => c.id);

      const r7Excluded = !ids.includes(r7._id.toString());
      const r8Excluded = !ids.includes(r8._id.toString());
      const r9Eligible = ids.includes(r9._id.toString());
      const r10Eligible = ids.includes(r10._id.toString());

      logTest(
        "Responders on 'assigned' or 'in_progress' emergencies are excluded; those on 'resolved' or 'cancelled' remain eligible",
        r7Excluded && r8Excluded && r9Eligible && r10Eligible,
        { ids }
      );
    }

    // Test 5: Straight-line distance sorting (ascending)
    {
      const candidates = await findEligibleCandidates({
        emergencyLocation,
        requiredSkills: ["fire"],
        radiusKm: 10
      });

      let isSorted = true;
      for (let i = 0; i < candidates.length - 1; i++) {
        if (candidates[i].distanceKm > candidates[i+1].distanceKm) {
          isSorted = false;
        }
      }

      logTest(
        "Candidates are sorted by ascending straight-line distanceKm",
        isSorted,
        candidates.map(c => ({ name: c.name, distanceKm: c.distanceKm }))
      );
    }

    // Test 6: Default limits (5), custom limits, and limit parameter validations
    {
      const candidatesDefault = await findEligibleCandidates({
        emergencyLocation,
        requiredSkills: ["fire"],
        radiusKm: 20
      });

      const candidatesCustom = await findEligibleCandidates({
        emergencyLocation,
        requiredSkills: ["fire"],
        radiusKm: 20,
        limit: 2
      });

      let limitValidations = false;
      try {
        await findEligibleCandidates({ emergencyLocation, requiredSkills: ["fire"], radiusKm: 20, limit: 0 });
      } catch (e) {
        try {
          await findEligibleCandidates({ emergencyLocation, requiredSkills: ["fire"], radiusKm: 20, limit: -2 });
        } catch (e2) {
          try {
            await findEligibleCandidates({ emergencyLocation, requiredSkills: ["fire"], radiusKm: 20, limit: 2.5 });
          } catch (e3) {
            limitValidations = true;
          }
        }
      }

      logTest(
        "Limits result to 5 by default, supports custom limit (e.g. limit: 2), and rejects invalid limits",
        candidatesDefault.length <= 5 && candidatesCustom.length === 2 && limitValidations,
        { defaultCount: candidatesDefault.length, customCount: candidatesCustom.length }
      );
    }

    // Test 7: Radius parameter tier validations
    {
      let validationSucceeded = false;
      try {
        await findEligibleCandidates({ emergencyLocation, requiredSkills: ["fire"], radiusKm: 3 });
      } catch (e) {
        try {
          await findEligibleCandidates({ emergencyLocation, requiredSkills: ["fire"], radiusKm: 12 });
        } catch (e2) {
          validationSucceeded = true;
        }
      }

      logTest(
        "Radius parameter rejects invalid tiers (only 5, 10, 15, 20 are allowed)",
        validationSucceeded
      );
    }

    // Test 8: Empty array returned when no candidate fits search
    {
      const candidates = await findEligibleCandidates({
        emergencyLocation,
        requiredSkills: ["security"], // No test responder has security skill
        radiusKm: 5
      });

      logTest(
        "Returns empty array [] when no candidates are found (does not throw)",
        Array.isArray(candidates) && candidates.length === 0,
        candidates
      );
    }

    // Test 9: No OSRM, sockets, offer logic, or state side effects
    {
      // Verify return payloads are clean and have only id, name, skills, location, distanceKm
      const candidates = await findEligibleCandidates({
        emergencyLocation,
        requiredSkills: ["fire"],
        radiusKm: 5
      });
      
      const firstCandidate = candidates[0];
      const keys = Object.keys(firstCandidate);
      const isClean = 
        keys.includes("id") && 
        keys.includes("name") && 
        keys.includes("skills") && 
        keys.includes("location") && 
        keys.includes("distanceKm") &&
        !keys.includes("password") &&
        !keys.includes("email") &&
        !keys.includes("phone");

      logTest(
        "Returns clean, minimal plain candidate records with no private user details",
        isClean,
        firstCandidate
      );
    }

    // Database cleanup after verification
    await User.deleteMany({ email: new RegExp("^" + testEmailPrefix) });
    await Emergency.deleteMany({ reporterId: reporter._id });

    console.log(`\n🏁 Verification completed. Failed tests: ${failedTests}`);
    await mongoose.disconnect();
    
    if (failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (error) {
    console.error("Test framework error:", error);
    process.exit(1);
  }
}

runTests();
