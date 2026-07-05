import express from "express";
import {
  getStats,
  getAllEmergencies,
  getAllResponders,
  getAllUsersList
} from "../controllers/AdminController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// Admin only routes
router.get("/stats", protect, authorize("admin"), getStats);
router.get("/emergencies", protect, authorize("admin"), getAllEmergencies);
router.get("/responders", protect, authorize("admin"), getAllResponders);
router.get("/users", protect, authorize("admin"), getAllUsersList);

export default router;
