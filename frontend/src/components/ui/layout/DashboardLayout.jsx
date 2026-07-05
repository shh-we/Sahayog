import { Outlet } from "react-router-dom"
import Sidebar from "./Sidebar.jsx"

export default function DashboardLayout() {
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <Sidebar />
      <div style={{ flex: 1, overflowY: "auto", padding: "2rem" }}>
        <Outlet />
      </div>
    </div>
  )
}
