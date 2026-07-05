import { useState } from "react"
import { useNavigate } from "react-router-dom"
import toast from "react-hot-toast"
import { login as loginApi } from "../../api/auth.js"
import logo from "../../assets/logo.svg"
import useAuthStore from "../../stores/authStore.js"
import {
  REGISTER_ROUTE,
  ADMIN_DASHBOARD,
  RESPONDER_DASHBOARD,
  USER_DASHBOARD
} from "../../constants/routes.js"

export default function LoginPage() {
  const navigate = useNavigate()
  const loginUser = useAuthStore((state) => state.loginUser)

  const [form, setForm] = useState({
    email: "",
    password: ""
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await loginApi(form)
      loginUser(res.data.user, res.data.token)
      toast.success("Welcome back!")
      
      // Role-based redirect
      if (res.data.user.role === "admin") {
        navigate(ADMIN_DASHBOARD)
      } else if (res.data.user.role === "responder") {
        navigate(RESPONDER_DASHBOARD)
      } else {
        navigate(USER_DASHBOARD)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fcfcfc] px-4 py-12">
      <div className="w-full max-w-[420px] bg-white rounded-3xl border border-gray-100 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center gap-2 mb-3">
            <img src={logo} alt="Sahayog Logo" className="h-10 object-contain" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Log in to your account</h2>
          <p className="text-sm text-gray-500 mt-1">Log in to report and track emergencies.</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="e.g. name@example.com"
              value={form.email}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all bg-gray-50/50"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all bg-gray-50/50"
              required
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 text-gray-500 cursor-pointer select-none">
              <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4" />
              <span>Remember for 30 days</span>
            </label>
            <button type="button" className="font-semibold text-blue-600 hover:underline">
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1b6ca8] hover:bg-[#155483] disabled:bg-blue-300 text-white font-semibold py-3 px-4 rounded-xl text-sm transition-colors shadow-md shadow-blue-500/10 cursor-pointer"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 mt-8">
          New to Sahayog?{" "}
          <button
            type="button"
            onClick={() => navigate(REGISTER_ROUTE)}
            className="font-bold text-blue-600 hover:underline cursor-pointer"
          >
            Register
          </button>
        </div>

      </div>
    </div>
  )
}