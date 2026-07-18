import api from "./axios.js";
 
// POST /api/emergencies
// data: { type, description, longitude, latitude, address, radius }
// `radius` is optional and controls how far nearby responders will be searched.
export const createEmergency = (data) => api.post("/emergencies", data);
 
// GET /api/emergencies
// params: { status, type, page, limit }
// user sees own only, admin sees all
export const getEmergencies = (params) => api.get("/emergencies", { params });
 
export const getNearbyEmergencies = (params) =>
  api.get("/emergencies/nearby", { params });
 
// GET /api/emergencies/:id
export const getEmergencyById = (id) => api.get(`/emergencies/${id}`);
 
// PUT /api/emergencies/:id/status
// data: { status }
export const updateEmergencyStatus = (id, data) =>
  api.put(`/emergencies/${id}/status`, data);
 
// DELETE /api/emergencies/:id — soft delete (sets status to cancelled)
export const deleteEmergency = (id) => api.delete(`/emergencies/${id}`);

// A* Route endpoints
export const getResponderToIncidentRoute = (id) =>
  api.get(`/emergencies/${id}/route/responder`);

export const getIncidentToFacilityRoute = (id, facilityType) =>
  api.get(`/emergencies/${id}/route/facility`, {
    params: facilityType ? { facilityType } : {}
  });
 