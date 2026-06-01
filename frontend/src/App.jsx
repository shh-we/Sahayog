import { Routes, Route } from "react-router-dom"
import { Toaster } from "react-hot-toast"
import { AuthProvider } from "./context/AuthContext.jsx"
import ProtectedRoute from "./components/ProtectedRoute.jsx"
import LandingLayout from "./components/ui/layout/LandingLayout.jsx"
import DashboardLayout from "./components/ui/layout/DashboardLayout.jsx"
import LandingPage from "./pages/LandingPage.jsx"
import Login from "./pages/auth/Login.jsx"
import Register from "./pages/auth/Register.jsx"
import UserDashboard from "./pages/user/UserDashboard.jsx"
import ResponderDashboard from "./pages/responder/ResponderDashboard.jsx"
import AdminDashboard from "./pages/admin/AdminDashboard.jsx"

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-center" />
      <Routes>
        {/* Landing Routes - With Navbar */}
        <Route element={<LandingLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* Dashboard Routes - With Sidebar, Protected */}
        <Route element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route path="/user-dashboard" element={
            <ProtectedRoute roles={["user"]}>
              <UserDashboard />
            </ProtectedRoute>
          } />
          <Route path="/responder-dashboard" element={
            <ProtectedRoute roles={["responder"]}>
              <ResponderDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin-dashboard" element={
            <ProtectedRoute roles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App