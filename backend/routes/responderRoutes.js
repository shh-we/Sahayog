import express from "express";
import {
  getNearbyResponders,
  getMyAssignments,
  acceptEmergency
} from "../controllers/ResponderController.js";
import {
  updateLocation,
  toggleAvailability
} from "../controllers/UserController.js";
import {
  updateResponderStatus
} from "../controllers/EmergencyController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// Responder only
router.put("/location", protect, authorize("responder"), updateLocation);
router.put("/availability", protect, authorize("responder"), toggleAvailability);
router.get("/my-assignments", protect, authorize("responder"), getMyAssignments);
router.post("/emergencies/:id/accept", protect, authorize("responder"), acceptEmergency);
router.put("/emergencies/:id/status", protect, authorize("responder"), updateResponderStatus);

// Any logged in user can view nearby responders
router.get("/nearby", protect, getNearbyResponders);

export default router;