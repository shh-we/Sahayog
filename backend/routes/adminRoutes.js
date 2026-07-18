import express from "express";
import {
  getStats,
  getAllEmergencies,
  getAllResponders,
  getAllUsersList,
  getPendingUsers,
  approveUser,
  rejectUser,
  createResponder
} from "../controllers/AdminController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// Admin only routes
router.get("/stats", protect, authorize("admin"), getStats);
router.get("/emergencies", protect, authorize("admin"), getAllEmergencies);
router.get("/responders", protect, authorize("admin"), getAllResponders);
router.get("/users", protect, authorize("admin"), getAllUsersList);

// Verification queue routes
router.get("/users/pending", protect, authorize("admin"), getPendingUsers);
router.patch("/users/:id/approve", protect, authorize("admin"), approveUser);
router.delete("/users/:id/reject", protect, authorize("admin"), rejectUser);

// Responder creation route
router.post("/responders", protect, authorize("admin"), createResponder);

export default router;
