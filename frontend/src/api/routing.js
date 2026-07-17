import api from "./axios.js";

// GET /api/routes/driving
export const getDrivingRoute = (params) =>
  api.get("/routes/driving", { params });
