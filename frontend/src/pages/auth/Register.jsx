import { useState } from "react"
import { useNavigate } from "react-router-dom"
import toast from "react-hot-toast"
import { register } from "../../api/auth.js"

export default function RegisterPage() {
  const navigate = useNavigate()
  
  const [isResponder, setIsResponder] = useState(false)
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "user",
    skills: []
  })
  const [loading, setLoading] = useState(false)

  const skillOptions = ["medical", "fire", "security", "general"]

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSkillToggle = (skill) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill]
    }))
  }

  const handleResponderToggle = () => {
    setIsResponder((prevResponder) => {
      const nextResponder = !prevResponder
      setForm((prevForm) => ({
        ...prevForm,
        role: nextResponder ? "responder" : "user",
        skills: []
      }))
      return nextResponder
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      await register(form)   //api call in auth.js
      
      toast.success("Registration Successful!")
      
      navigate("/login")
    } catch (err) {
      console.log(err) 
      toast.error(err.response?.data?.message || "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1>Register</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="name">Name</label>
          <input
            id="name"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
          />
        </div>

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

        <div>
          <label htmlFor="phone">Phone</label>
          <input
            id="phone"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            required
          />
        </div>

        {isResponder && (
          <fieldset>
            <legend>Skills</legend>
            {skillOptions.map((skill) => (
              <div key={skill}>
                <input
                  id={`skill-${skill}`}
                  type="checkbox"
                  checked={form.skills.includes(skill)}
                  onChange={() => handleSkillToggle(skill)}
                />
                <label htmlFor={`skill-${skill}`}>{skill}</label>
              </div>
            ))}
          </fieldset>
        )}

        <button type="submit" disabled={loading}>
          {loading ? "Registering..." : "Register"}
        </button>
      </form>

      <button type="button" onClick={handleResponderToggle}>
        {isResponder ? "Cancel — Register as User" : "Join as Responder"}
      </button>

      <p>
        Already have an account?{" "}
        <button type="button" onClick={() => navigate("/login")}>Login</button>
      </p>
    </div>
  )
}