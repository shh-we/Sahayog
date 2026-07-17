import express from "express";
import { getDrivingRoute } from "../controllers/RouteController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// GET /api/routes/driving (protected)
router.get("/driving", protect, getDrivingRoute);

export default router;
