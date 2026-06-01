import api from "./axios.js";
 
//  POST /api/auth/register data: { name, email, password, phone, role }
export const register = (data) => api.post("/auth/register", data);

//POST /api/auth/login  data: { email, password }
export const login = (data) => api.post("/auth/login", data);
 
// GET /api/auth/me 
// returns logged in user from token
export const getMe = () => api.get("/auth/me");
 