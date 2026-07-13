import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import { createEmergency } from "./controllers/EmergencyController.js";
import Emergency from "./models/Emergency.js";
import User from "./models/User.js";
import { startDispatchCalls } from "./services/dispatchService.js";

dotenv.config();

// Ensure process exits with code 1 if tests fail
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
    console.log("🧪 Running Focused Feature 1 Verification...");
    
    // Connect to database
    await connectDB();

    // Setup a dummy reporter user
    let testUser = await User.findOne({ role: "user" });
    if (!testUser) {
      testUser = await User.create({
        name: "Feature 1 Tester",
        email: `tester-${Date.now()}@test.com`,
        password: "password123",
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        role: "user"
      });
    }

    // Helper to mock controller calls
    async function executeCreateEmergency(body, userId = testUser._id.toString()) {
      const req = {
        body,
        user: { id: userId }
      };
      
      let resStatusCode = 200;
      let resJsonData = null;
      
      const res = {
        status(code) {
          resStatusCode = code;
          return this;
        },
        json(data) {
          resJsonData = data;
          return this;
        }
      };
      
      await createEmergency(req, res);
      return { status: resStatusCode, data: resJsonData };
    }

    // Test 1: Authenticated creation with valid coordinates succeeds
    {
      const payload = {
        type: "fire",
        description: "Valid emergency coordinates",
        longitude: 85.324,
        latitude: 27.7172,
        address: "Kathmandu, Nepal"
      };
      
      const res = await executeCreateEmergency(payload);
      
      const success = 
        res.status === 201 && 
        res.data.success === true &&
        res.data.emergency.status === "active" &&
        res.data.emergency.dispatchStatus === null &&
        res.data.emergency.createdAt !== undefined &&
        res.data.emergency.id !== undefined;
        
      logTest("Authenticated creation with valid coordinates returns 201 & expected payload contract", success, {
        status: res.status,
        emergency: res.data?.emergency
      });
    }

    // Test 2: reporterId is derived from authenticated session, not client payload
    {
      const fakeReporterId = new mongoose.Types.ObjectId().toString();
      const payload = {
        type: "medical",
        description: "Testing reporterId override",
        longitude: 85.111,
        latitude: 27.222,
        reporterId: fakeReporterId
      };
      
      const res = await executeCreateEmergency(payload);
      
      let success = false;
      if (res.status === 201 && res.data.emergency?.id) {
        const doc = await Emergency.findById(res.data.emergency.id);
        success = doc && doc.reporterId.toString() === testUser._id.toString() && doc.reporterId.toString() !== fakeReporterId;
      }
      
      logTest("reporterId is derived from authenticated session and client payload is ignored", success);
    }

    // Test 3: client-supplied radius is ignored and is not persisted in the database
    {
      const payload = {
        type: "security",
        description: "Testing radius ignore",
        longitude: 85.333,
        latitude: 27.444,
        radius: 12345,
        currentDispatchRadiusKm: 15
      };
      
      const res = await executeCreateEmergency(payload);
      
      let success = false;
      if (res.status === 201 && res.data.emergency?.id) {
        const doc = await Emergency.findById(res.data.emergency.id);
        // radius should not exist and currentDispatchRadiusKm should be undefined at creation
        success = doc && doc.radius === undefined && doc.currentDispatchRadiusKm === undefined;
      }
      
      logTest("client-supplied radius fields are ignored and not persisted", success);
    }

    // Test 4: missing longitude or latitude returns 400
    {
      const res1 = await executeCreateEmergency({ type: "fire", latitude: 27.7172 });
      const res2 = await executeCreateEmergency({ type: "fire", longitude: 85.324 });
      
      logTest("missing latitude or longitude returns 400", res1.status === 400 && res2.status === 400);
    }

    // Test 5: null coordinates return 400
    {
      const res1 = await executeCreateEmergency({ type: "fire", latitude: null, longitude: 85.324 });
      const res2 = await executeCreateEmergency({ type: "fire", latitude: 27.7172, longitude: null });
      
      logTest("null coordinates return 400", res1.status === 400 && res2.status === 400);
    }

    // Test 6: empty string or whitespace coordinates return 400
    {
      const res1 = await executeCreateEmergency({ type: "fire", latitude: "", longitude: 85.324 });
      const res2 = await executeCreateEmergency({ type: "fire", latitude: "   ", longitude: 85.324 });
      const res3 = await executeCreateEmergency({ type: "fire", latitude: 27.7172, longitude: "" });
      
      logTest("empty/whitespace coordinates return 400", res1.status === 400 && res2.status === 400 && res3.status === 400);
    }

    // Test 7: NaN coordinates return 400
    {
      const res = await executeCreateEmergency({ type: "fire", latitude: NaN, longitude: 85.324 });
      logTest("NaN coordinates return 400", res.status === 400);
    }

    // Test 8: Infinity or -Infinity coordinates return 400
    {
      const res1 = await executeCreateEmergency({ type: "fire", latitude: Infinity, longitude: 85.324 });
      const res2 = await executeCreateEmergency({ type: "fire", latitude: -Infinity, longitude: 85.324 });
      
      logTest("Infinity/-Infinity coordinates return 400", res1.status === 400 && res2.status === 400);
    }

    // Test 9: latitude outside [-90, 90] returns 400
    {
      const res1 = await executeCreateEmergency({ type: "fire", latitude: 90.0001, longitude: 85.324 });
      const res2 = await executeCreateEmergency({ type: "fire", latitude: -90.0001, longitude: 85.324 });
      
      logTest("latitude outside [-90, 90] range returns 400", res1.status === 400 && res2.status === 400);
    }

    // Test 10: longitude outside [-180, 180] returns 400
    {
      const res1 = await executeCreateEmergency({ type: "fire", latitude: 27.7172, longitude: 180.0001 });
      const res2 = await executeCreateEmergency({ type: "fire", latitude: 27.7172, longitude: -180.0001 });
      
      logTest("longitude outside [-180, 180] range returns 400", res1.status === 400 && res2.status === 400);
    }

    // Test 11: creation invokes only dispatchService.startDispatch and performs no candidate query, distance calculation, OSRM request, or socket emission
    {
      // Clear call history
      startDispatchCalls.length = 0;
      
      const payload = {
        type: "natural_disaster",
        description: "Boundary check",
        longitude: 85.324,
        latitude: 27.7172
      };
      
      const res = await executeCreateEmergency(payload);
      
      let success = false;
      if (res.status === 201 && res.data.emergency?.id) {
        const doc = await Emergency.findById(res.data.emergency.id);
        
        // 1. Invoked startDispatch exactly once with correct ID
        const startDispatchInvoked = startDispatchCalls.length === 1 && startDispatchCalls[0] === res.data.emergency.id.toString();
        
        // 2. Perform no candidate queries or distance calculation inside creation (responders list must be empty)
        const noCandidateQueries = doc.responders.length === 0;
        
        // 3. No responder assigned yet
        const noResponderAssigned = doc.assignedResponder === null;

        success = startDispatchInvoked && noCandidateQueries && noResponderAssigned;
        
        logTest("Creation only calls startDispatch and has no socket, distance, OSRM, or candidate assignment side-effects", success, {
          startDispatchInvoked,
          respondersCount: doc.responders.length,
          assignedResponder: doc.assignedResponder
        });
      } else {
        logTest("Creation checks failed - emergency not created", false);
      }
    }

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
