import { Navigate } from "react-router-dom"
import useAuthStore from "../stores/authStore.js"
import { LOGIN_ROUTE, ADMIN_DASHBOARD, RESPONDER_DASHBOARD, USER_DASHBOARD } from "../constants/routes.js"

export default function ProtectedRoute({ children, roles }) {
  const user = useAuthStore((state) => state.user)
  const loading = useAuthStore((state) => state.loading)

  // Wait until authStore finishes checking token
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="text-gray-500 font-medium">Loading...</div>
      </div>
    )
  }

  // Not logged in — send to login
  if (!user) {
    return <Navigate to={LOGIN_ROUTE} replace />
  }

  // Logged in but wrong role — redirect to their correct dashboard
  if (roles && !roles.includes(user.role)) {
    if (user.role === "admin") {
      return <Navigate to={ADMIN_DASHBOARD} replace />
    } else if (user.role === "responder") {
      return <Navigate to={RESPONDER_DASHBOARD} replace />
    } else {
      return <Navigate to={USER_DASHBOARD} replace />
    }
  }

  return children
}