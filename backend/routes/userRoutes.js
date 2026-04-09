import express from "express";
import {
  getProfile,
  updateProfile,
  updateLocation,
  toggleAvailability,
  changePassword,
  getAllUsers,
  getUserById,
  deleteUser
} from "../controllers/UserController.js";
import { protect, authorize } from "../middleware/auth.js";



const router = express.Router();

// Any logged in user
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);

// Responder only
router.put("/location", protect, authorize("responder"), updateLocation);
router.put("/availability", protect, authorize("responder"), toggleAvailability);

// Admin only
router.get("/", protect, authorize("admin"), getAllUsers);
router.get("/:id", protect, authorize("admin"), getUserById);
router.delete("/:id", protect, authorize("admin"), deleteUser);

export default router;