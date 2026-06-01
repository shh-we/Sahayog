import { Navigate, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext.jsx"

export default function LandingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // If already logged in, redirect to appropriate dashboard
  if (user) {
    if (user.role === "admin") {
      return <Navigate to="/admin-dashboard" replace />
    } else if (user.role === "responder") {
      return <Navigate to="/responder-dashboard" replace />
    } else {
      return <Navigate to="/user-dashboard" replace />
    }
  }

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>Sahayog</h1>
      <p>Emergency Response Platform</p>
      <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
        <button type="button" onClick={() => navigate("/register")}>Register</button>
        <button type="button" onClick={() => navigate("/login")}>Login</button>
      </div>
    </div>
  )
}