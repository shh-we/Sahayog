import api from "./axios.js";
 
// POST /api/responders/emergencies/:id/accept
export const acceptEmergency = (id) =>
  api.post(`/responders/emergencies/${id}/accept`);
 
// PUT /api/responders/emergencies/:id/status
// data: { status } — en_route | on_scene | completed
// journeyData: { routeCoordinates, journeyStartedAt } — only when status = en_route
export const updateResponseStatus = (id, status, journeyData = {}) =>
  api.put(`/responders/emergencies/${id}/status`, { status, ...journeyData });
 
// GET /api/responders/my-assignments
// returns emergencies this responder has accepted (assigned or in_progress)
export const getMyAssignments = (history = false) => api.get(`/responders/my-assignments${history ? "?history=true" : ""}`);

// PUT /api/responders/availability
// Toggle responder availability (online/offline)
export const toggleAvailability = () => api.put("/responders/availability");

export const updateLocation = (data) => api.put("/responders/location", data);

export const getNearbyResponders = (params) =>
  api.get("/responders/nearby", { params });


// POST /api/dispatch/:attemptId/accept
export const acceptDispatchAttempt = (attemptId) =>
  api.post(`/dispatch/${attemptId}/accept`);

// POST /api/dispatch/:attemptId/decline
export const declineDispatchAttempt = (attemptId) =>
  api.post(`/dispatch/${attemptId}/decline`);