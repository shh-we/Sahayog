import express from 'express';
import cors from 'cors'
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js"
import userRoutes from "./routes/userRoutes.js";
import emergencyRoutes from "./routes/emergencyRoutes.js";
import responderRoutes from "./routes/responderRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import dispatchRoutes from "./routes/dispatchRoutes.js";
import routeRoutes from "./routes/routeRoutes.js";
import {connectDB} from'./config/db.js';
import { initializeSocket } from "./socket/index.js";
import { startDispatchWorker } from "./workers/dispatchWorker.js";
import { loadGraph } from "./services/routing/aStarGraphLoader.js";

// Load environment variables
dotenv.config();


// Create Express app
const app = express();

// Middleware
app.use(cors());

// body parsing
app.use(express.json());
app.use(express.urlencoded({
   extended: true 
  }));

  //Routes
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/emergencies", emergencyRoutes);
  app.use("/api/responders", responderRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/dispatch", dispatchRoutes);
  app.use("/api/routes", routeRoutes);





// Start server
const PORT = process.env.PORT || 5000;

await connectDB();
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

initializeSocket(server);

// Start the dispatch expiry worker (Feature 4)
startDispatchWorker();

// Load the A* road graph into memory (Feature: A* routing)
loadGraph();