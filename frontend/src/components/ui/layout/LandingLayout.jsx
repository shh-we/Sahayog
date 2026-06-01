import { Outlet } from "react-router-dom"
import Navbar from "./Navbar.jsx"

export default function LandingLayout() {
  return (
    <div>
      <Navbar />
      <Outlet />
    </div>
  )
}
