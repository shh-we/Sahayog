import { useAuth } from "../../../context/AuthContext.jsx"
import { useNavigate } from "react-router-dom"
import logo from "../../../assets/logo.svg"

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <nav style={{ 
      borderBottom: "1px solid #ccc", 
      padding: "1rem 2rem",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }}>
      <button 
        type="button" 
        onClick={() => navigate("/")} 
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
      
      <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        {user ? (
          <>
            <span>{user.name}</span>
            <button 
              type="button" 
              onClick={() => {
                logout()
                navigate("/")
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => navigate("/login")}>
              Login
            </button>
            <button type="button" onClick={() => navigate("/register")}>
              Register
            </button>
          </>
        )}
      </div>
    </nav>
  )
}
