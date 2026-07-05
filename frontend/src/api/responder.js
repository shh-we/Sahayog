import api from "./axios.js";
 
// POST /api/responders/emergencies/:id/accept
export const acceptEmergency = (id) =>
  api.post(`/responders/emergencies/${id}/accept`);
 
// PUT /api/responders/emergencies/:id/status
// data: { status } — en_route | on_scene | completed
export const updateResponseStatus = (id, status) =>
  api.put(`/responders/emergencies/${id}/status`, { status });
 
// GET /api/responders/my-assignments
// returns emergencies this responder has accepted (assigned or in_progress)
export const getMyAssignments = () => api.get("/responders/my-assignments");

// PUT /api/responders/availability
// Toggle responder availability (online/offline)
export const toggleAvailability = () => api.put("/responders/availability");

export const updateLocation = (data) => api.put("/responders/location", data);

export const getNearbyResponders = (params) =>
  api.get("/responders/nearby", { params });
 
// POST /api/responders/emergencies/:id/feedback
// data: { rating, comment } — only emergency creator can submit
export const submitFeedback = (id, data) =>
  api.post(`/responders/emergencies/${id}/feedback`, data);