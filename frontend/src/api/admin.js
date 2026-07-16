import api from "./axios.js"

// GET /api/admin/stats
export const getStats = () => api.get("/admin/stats")

// GET /api/admin/emergencies
export const getAllEmergencies = (params) =>
  api.get("/admin/emergencies", { params })

// GET /api/admin/responders
export const getAllResponders = (params) =>
  api.get("/admin/responders", { params })

// GET /api/admin/users
export const getAllUsers = (params) =>
  api.get("/admin/users", { params })

// GET /api/admin/users/pending  — verification queue
export const getPendingUsers = (params) =>
  api.get("/admin/users/pending", { params })

// PATCH /api/admin/users/:id/approve
export const approveUser = (id) =>
  api.patch(`/admin/users/${id}/approve`)

// DELETE /api/admin/users/:id/reject
export const rejectUser = (id) =>
  api.delete(`/admin/users/${id}/reject`)

// POST /api/admin/responders
export const createResponder = (data) =>
  api.post("/admin/responders", data)
