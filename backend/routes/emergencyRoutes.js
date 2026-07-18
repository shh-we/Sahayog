import express from "express";
import {
  createEmergency,
  getEmergencies,
  getEmergencyById,
  getNearbyEmergencies,
  updateStatus,
  deleteEmergency,
  updateResponderStatus,
  getResponderRouteHandler,
  getFacilityRouteHandler
} from "../controllers/EmergencyController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// Any logged in user
router.post("/", protect, createEmergency);
router.get("/", protect, getEmergencies);
router.get("/nearby", protect, getNearbyEmergencies);

// A* routing endpoints (must be before /:id to avoid param capture)
router.get("/:id/route/responder", protect, getResponderRouteHandler);
router.get("/:id/route/facility", protect, getFacilityRouteHandler);

router.get("/:id", protect, getEmergencyById);

// Responder or admin only
router.put("/:id/status", protect, authorize("responder", "admin"), updateStatus);
router.patch("/:id/status", protect, authorize("responder"), updateResponderStatus);

// Admin or creator (handled inside controller)
router.delete("/:id", protect, deleteEmergency);

export default router;