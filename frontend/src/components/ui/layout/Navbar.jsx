import useAuthStore from "../../../stores/authStore.js"
import { useNavigate } from "react-router-dom"
import { HOME_ROUTE, LOGIN_ROUTE, REGISTER_ROUTE } from "../../../constants/routes.js"
import logo from "../../../assets/logo.svg"

export default function Navbar() {
  const user = useAuthStore((state) => state.user)
  const logoutUser = useAuthStore((state) => state.logoutUser)
  const navigate = useNavigate()

  return (
    <nav style={{ 
      borderBottom: "1px solid #e5e7eb", 
      padding: "0.75rem 3rem",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "2rem",
      background: "#fff"
    }}>
      <button 
        type="button" 
        onClick={() => navigate(HOME_ROUTE)} 
        style={{ 
          cursor: "pointer", 
          background: "none", 
          border: "none",
          display: "flex",
          alignItems: "center"
        }}
      >
        <img src={logo} alt="Sahayog" style={{ height: "40px" }} />
      </button>

      {!user && (
        <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          <a href="#how-it-works" style={{ color: "#64748b", fontWeight: 600, textDecoration: "none" }}>How it works</a>
          <a href="#features" style={{ color: "#64748b", fontWeight: 600, textDecoration: "none" }}>Features</a>
          <a href="#responders" style={{ color: "#64748b", fontWeight: 600, textDecoration: "none" }}>Responders</a>
        </div>
      )}
      
      <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        {user ? (
          <>
            <span>{user.name}</span>
            <button 
              type="button" 
              onClick={() => {
                logoutUser()
                navigate(HOME_ROUTE)
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => navigate(REGISTER_ROUTE)} style={{ background: "transparent", border: "none", color: "#0f172a", cursor: "pointer", fontWeight: 600 }}>
              Sign up
            </button>
            <button type="button" onClick={() => navigate(LOGIN_ROUTE)} style={{ background: "#e11d2e", border: "none", borderRadius: "10px", color: "#fff", cursor: "pointer", fontWeight: 700, padding: "0.7rem 1.1rem" }}>
              Log in
            </button>
          </>
        )}
      </div>
    </nav>
  )
}
