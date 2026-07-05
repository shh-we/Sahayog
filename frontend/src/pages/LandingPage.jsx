import { Navigate, useNavigate } from "react-router-dom"
import useAuthStore from "../stores/authStore.js"
import {
  REGISTER_ROUTE,
  LOGIN_ROUTE,
  ADMIN_DASHBOARD,
  RESPONDER_DASHBOARD,
  USER_DASHBOARD
} from "../constants/routes.js"

export default function LandingPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)

  // If already logged in, redirect to appropriate dashboard
  if (user) {
    if (user.role === "admin") {
      return <Navigate to={ADMIN_DASHBOARD} replace />
    } else if (user.role === "responder") {
      return <Navigate to={RESPONDER_DASHBOARD} replace />
    } else {
      return <Navigate to={USER_DASHBOARD} replace />
    }
  }

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>Sahayog</h1>
      <p>Emergency Response Platform</p>
      <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
        <button type="button" onClick={() => navigate(REGISTER_ROUTE)}>Register</button>
        <button type="button" onClick={() => navigate(LOGIN_ROUTE)}>Login</button>
      </div>
    </div>
  )
}