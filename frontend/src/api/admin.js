import api from "./axios.js"

// GET /api/admin/stats
// Get dashboard statistics
export const getStats = () => api.get("/admin/stats")

// GET /api/admin/emergencies
// Get all emergencies (admin view)
export const getAllEmergencies = (params) => 
  api.get("/admin/emergencies", { params })

// GET /api/admin/responders
// Get all responders (admin view)
export const getAllResponders = (params) => 
  api.get("/admin/responders", { params })

// GET /api/admin/users
// Get all users (admin view)
export const getAllUsers = (params) => 
  api.get("/admin/users", { params })
