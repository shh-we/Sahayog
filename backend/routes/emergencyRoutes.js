import express from "express";
import {
  createEmergency,
  getEmergencies,
  getEmergencyById,
  getNearbyEmergencies,
  updateStatus,
  deleteEmergency
} from "../controllers/EmergencyController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// Any logged in user
router.post("/", protect, createEmergency);
router.get("/", protect, getEmergencies);
router.get("/nearby", protect, getNearbyEmergencies);
router.get("/:id", protect, getEmergencyById);

// Responder or admin only
router.put("/:id/status", protect, authorize("responder", "admin"), updateStatus);

// Admin or creator (handled inside controller)
router.delete("/:id", protect, deleteEmergency);

export default router;