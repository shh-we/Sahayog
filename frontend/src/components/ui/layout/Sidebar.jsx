import { useAuth } from "../../../context/AuthContext.jsx"
import { useNavigate } from "react-router-dom"

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const sidebarItems = {
    user: [
      { label: "Profile", action: () => {} },
      { label: "My Emergencies", action: () => {} },
      { label: "Create Emergency", action: () => {} },
      { label: "Settings", action: () => {} },
    ],
    responder: [
      { label: "Profile", action: () => {} },
      { label: "Availability", action: () => {} },
      { label: "My Location", action: () => {} },
      { label: "Active Assignments", action: () => {} },
      { label: "Nearby Emergencies", action: () => {} },
      { label: "Settings", action: () => {} },
    ],
    admin: [
      { label: "Dashboard", action: () => {} },
      { label: "Users", action: () => {} },
      { label: "Responders", action: () => {} },
      { label: "All Emergencies", action: () => {} },
      { label: "Analytics", action: () => {} },
      { label: "Profile", action: () => {} },
    ],
  }

  const items = sidebarItems[user?.role] || []

  return (
    <aside style={{
      width: "250px",
      borderRight: "1px solid #ccc",
      padding: "2rem 0",
      display: "flex",
      flexDirection: "column",
      height: "100vh",
    }}>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <nav style={{ display: "flex", flexDirection: "column" }}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.action}
              style={{
                padding: "1rem 1.5rem",
                textAlign: "left",
                border: "none",
                background: "none",
                cursor: "pointer",
                borderLeft: "3px solid transparent",
                fontSize: "1rem",
              }}
              onMouseEnter={(e) => e.target.style.background = "#f5f5f5"}
              onMouseLeave={(e) => e.target.style.background = "none"}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div style={{ borderTop: "1px solid #ccc", padding: "1rem 1.5rem" }}>
        <button
          type="button"
          onClick={() => {
            logout()
            navigate("/")
          }}
          style={{
            width: "100%",
            padding: "0.75rem",
            background: "#ff4444",
            color: "white",
            border: "none",
            cursor: "pointer",
            borderRadius: "4px",
          }}
        >
          Logout
        </button>
      </div>
    </aside>
  )
}
