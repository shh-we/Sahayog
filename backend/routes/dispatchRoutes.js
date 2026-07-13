import express from "express";
import { acceptOffer, declineOffer } from "../controllers/DispatchController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Both are protected and only accessible by logged in responders (checked via attempt.responderId verification inside controllers)
router.post("/:attemptId/accept", protect, acceptOffer);
router.post("/:attemptId/decline", protect, declineOffer);

export default router;
