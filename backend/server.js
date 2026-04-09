import express from 'express';
import cors from 'cors'
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js"
import userRoutes from "./routes/userRoutes.js";
import emergencyRoutes from "./routes/emergencyRoutes.js";
import responderRoutes from "./routes/responderRoutes.js";
import {connectDB} from'./config/db.js';

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

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





// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Visit: http://localhost:${PORT}`);
});