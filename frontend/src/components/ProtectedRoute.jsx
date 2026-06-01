import { Navigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext.jsx"

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()

  // Wait until AuthContext finishes checking localStorage
  if (loading) return <div>Loading...</div>

  // Not logged in — send to login
  if (!user) return <Navigate to="/login" replace />

  // Logged in but wrong role — send back to dashboard
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}