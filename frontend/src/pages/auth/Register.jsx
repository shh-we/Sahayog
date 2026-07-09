import { useState } from "react"
import { useNavigate } from "react-router-dom"
import toast from "react-hot-toast"
import { register } from "../../api/auth.js"
import logo from "../../assets/logo.svg"
import { LOGIN_ROUTE } from "../../constants/routes.js"

export default function RegisterPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    role: "user", // "user" maps to Reporter role in backend
    skills: []
  })
  const [loading, setLoading] = useState(false)

  const skillOptions = ["medical", "fire", "security", "general"]

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleRoleToggle = (selectedRole) => {
    setForm((prev) => ({
      ...prev,
      role: selectedRole,
      skills: [] // reset skills when toggling roles
    }))
  }

  const handleSkillToggle = (skill) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill]
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Basic validations
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters long")
      return
    }

    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    const phoneRegex = /^\d{10}$/
    if (!phoneRegex.test(form.phone)) {
      toast.error("Please enter a valid 10-digit phone number")
      return
    }

    if (form.role === "responder" && form.skills.length === 0) {
      toast.error("Please select at least one skill")
      return
    }

    setLoading(true)

    // Prepare register payload (exclude confirmPassword from payload)
    const payload = {
      name: form.name,
      email: form.email,
      password: form.password,
      phone: form.phone,
      role: form.role,
      skills: form.skills
    }

    try {
      await register(payload)
      toast.success("Registration Successful! Please log in.")
      navigate(LOGIN_ROUTE)
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fcfcfc] px-4 py-12">
      <div className="w-full max-w-[450px] bg-white rounded-3xl border border-gray-100 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">

        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center gap-2 mb-3">
            <img src={logo} alt="Sahayog Logo" className="h-20 object-contain" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Create your account</h2>
          <p className="text-sm text-gray-500 mt-1">
            Register as a {form.role === "user" ? "reporter" : "responder"}
          </p>
        </div>

        {/* Role Toggle Selector */}
        <div className="flex bg-gray-100/80 p-1.5 rounded-2xl mb-6">
          <button
            type="button"
            onClick={() => handleRoleToggle("user")}
            className={`flex-1 text-center py-2.5 text-sm font-semibold rounded-xl transition-all cursor-pointer ${form.role === "user"
              ? "bg-primary1/5 text-primary1 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
              }`}
          >
            Reporter
          </button>
          <button
            type="button"
            onClick={() => handleRoleToggle("responder")}
            className={`flex-1 text-center py-2.5 text-sm font-semibold rounded-xl transition-all cursor-pointer ${form.role === "responder"
              ? "bg-primary1/5 text-primary1 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
              }`}
          >
            Responder
          </button>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider" htmlFor="name">
              Full Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder=""
              value={form.name}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all bg-gray-50/50"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider" htmlFor="email">
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
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider" htmlFor="phone">
              Phone Number
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              pattern="[0-9]{10}"
              placeholder="e.g. 98XXXXXXXX"
              value={form.phone}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all bg-gray-50/50"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider" htmlFor="password">
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

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider" htmlFor="confirmPassword">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={form.confirmPassword}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all bg-gray-50/50"
              required
            />
          </div>

          {/* Responder Skill Selection */}
          {form.role === "responder" && (
            <div className="pt-2">
              <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">
                Select Skills (Choose at least one)
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {skillOptions.map((skill) => {
                  const isSelected = form.skills.includes(skill);
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => handleSkillToggle(skill)}
                      className={`flex items-center justify-center py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${isSelected
                        ? "border-primary1 bg-primary1/5 text-primary1 shadow-sm shadow-primary1/5"
                        : "border-gray-200 bg-gray-50/50 text-gray-600 hover:bg-gray-50"
                        }`}
                    >
                      {skill.charAt(0).toUpperCase() + skill.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary1 hover:bg-primary1/90 disabled:bg-primary1/35 text-white font-semibold py-3 px-4 rounded-xl text-sm transition-colors shadow-md shadow-primary1/10 cursor-pointer mt-4"
          >
            {loading ? "Registering..." : "Register"}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 mt-6">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => navigate(LOGIN_ROUTE)}
            className="font-bold text-blue-600 hover:underline cursor-pointer"
          >
            Log In
          </button>
        </div>

      </div>
    </div>
  )
}