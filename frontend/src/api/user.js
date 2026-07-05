import api from "./axios.js";
 
// GET /api/users/profile — role based response
export const getProfile = () => api.get("/users/profile");
 
// PUT /api/users/profile
// data: { name, phone }
export const updateProfile = (data) => api.put("/users/profile", data);
 
// PUT /api/responders/location — responder only
// data: { longitude, latitude }
export const updateLocation = (data) => api.put("/responders/location", data);
 
// PUT /api/responders/availability — responder only, flips isAvailable
export const toggleAvailability = () => api.put("/responders/availability");
 
// PUT /api/users/change-password
// data: { currentPassword, newPassword }
export const changePassword = (data) => api.put("/users/change-password", data);
 
// ── Admin only ────────────────────────────────────────────────────────────────
 
// GET /api/users — params: { role, page, limit }
export const getAllUsers = (params) => api.get("/users", { params });
 
// GET /api/users/:id
export const getUserById = (id) => api.get(`/users/${id}`);
 
// DELETE /api/users/:id
export const deleteUser = (id) => api.delete(`/users/${id}`);