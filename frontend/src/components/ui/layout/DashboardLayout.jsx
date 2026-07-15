import { Outlet } from "react-router-dom"
import Sidebar from "./Sidebar.jsx"

export default function DashboardLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — always rendered; handles its own mobile/desktop visibility */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto min-w-0 bg-gray-50">
        <Outlet />
      </div>
    </div>
  )
}
