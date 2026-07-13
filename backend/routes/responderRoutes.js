import express from "express";
import {
  getNearbyResponders
} from "../controllers/ResponderController.js";
import {
  updateLocation,
  toggleAvailability
} from "../controllers/UserController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// Responder only
router.put("/location", protect, authorize("responder"), updateLocation);
router.put("/availability", protect, authorize("responder"), toggleAvailability);

// Any logged in user can view nearby responders
router.get("/nearby", protect, getNearbyResponders);

export default router;