import express from "express";
import {
  acceptEmergency,
  updateResponseStatus,
  getMyAssignments,
  submitFeedback
} from "../controllers/ResponderController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// Responder only
router.post("/emergencies/:id/accept", protect, authorize("responder"), acceptEmergency);
router.put("/emergencies/:id/status", protect, authorize("responder"), updateResponseStatus);
router.get("/my-assignments", protect, authorize("responder"), getMyAssignments);

router.post("/emergencies/:id/feedback", protect, submitFeedback);

export default router;