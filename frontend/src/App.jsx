import { useEffect } from "react"
import { Routes, Route } from "react-router-dom"
import { Toaster } from "react-hot-toast"
import useAuthStore from "./stores/authStore.js"
import ProtectedRoute from "./components/ProtectedRoute.jsx"
import LandingLayout from "./components/ui/layout/LandingLayout.jsx"
import DashboardLayout from "./components/ui/layout/DashboardLayout.jsx"
import LandingPage from "./pages/LandingPage.jsx"
import Login from "./pages/auth/Login.jsx"
import Register from "./pages/auth/Register.jsx"
import UserDashboard from "./pages/user/UserDashboard.jsx"
import ResponderDashboard from "./pages/responder/ResponderDashboard.jsx"
import AdminDashboard from "./pages/admin/AdminDashboard.jsx"
import VerificationQueue from "./pages/admin/VerificationQueue.jsx"
import RespondersDirectory from "./pages/admin/RespondersDirectory.jsx"

import {
  HOME_ROUTE,
  LOGIN_ROUTE,
  REGISTER_ROUTE,
  USER_DASHBOARD,
  RESPONDER_DASHBOARD,
  ADMIN_DASHBOARD,
  ADMIN_VERIFICATION_QUEUE,
  ADMIN_RESPONDERS_DIRECTORY
} from "./constants/routes.js"

function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return (
    <>
      <Toaster position="top-center" />
      <Routes>
        {/* Landing Routes - With Navbar */}
        <Route element={<LandingLayout />}>
          <Route path={HOME_ROUTE} element={<LandingPage />} />
        </Route>

        {/* Auth Routes - Without Navbar */}
        <Route path={LOGIN_ROUTE} element={<Login />} />
        <Route path={REGISTER_ROUTE} element={<Register />} />

        {/* Dashboard Routes - With Sidebar, Protected */}
        <Route element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route path={USER_DASHBOARD} element={
            <ProtectedRoute roles={["user"]}>
              <UserDashboard />
            </ProtectedRoute>
          } />
          <Route path={ADMIN_DASHBOARD} element={
            <ProtectedRoute roles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path={ADMIN_VERIFICATION_QUEUE} element={
            <ProtectedRoute roles={["admin"]}>
              <VerificationQueue />
            </ProtectedRoute>
          } />
          <Route path={ADMIN_RESPONDERS_DIRECTORY} element={
            <ProtectedRoute roles={["admin"]}>
              <RespondersDirectory />
            </ProtectedRoute>
          } />
        </Route>

        <Route path={RESPONDER_DASHBOARD} element={
          <ProtectedRoute roles={["responder"]}>
            <ResponderDashboard />
          </ProtectedRoute>
        } />
      </Routes>
    </>
  )
}

export default App