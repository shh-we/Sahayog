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
      borderBottom: "1px solid #ccc", 
      padding: "1rem 2rem",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
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
            <button type="button" onClick={() => navigate(LOGIN_ROUTE)}>
              Login
            </button>
            <button type="button" onClick={() => navigate(REGISTER_ROUTE)}>
              Register
            </button>
          </>
        )}
      </div>
    </nav>
  )
}
