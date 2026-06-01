import { useState } from "react"
import { useNavigate } from "react-router-dom"
import toast from "react-hot-toast"
import { login as loginApi } from "../../api/auth.js"
import { useAuth } from "../../context/AuthContext.jsx"

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

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
      login(res.data.user, res.data.token)
      toast.success("Welcome back!")
      
      // Role-based redirect
      if (res.data.user.role === "admin") {
        navigate("/admin-dashboard")
      } else if (res.data.user.role === "responder") {
        navigate("/responder-dashboard")
      } else {
        navigate("/user-dashboard")
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1>Login</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            required
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      <p>
        Don't have an account?{" "}
        <button type="button" onClick={() => navigate("/register")}>Register</button>
      </p>
    </div>
  )
}