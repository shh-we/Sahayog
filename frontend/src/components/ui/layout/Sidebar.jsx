import { useState } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import useAuthStore from "../../../stores/authStore.js"
import { HOME_ROUTE, USER_DASHBOARD, RESPONDER_DASHBOARD, ADMIN_DASHBOARD, ADMIN_VERIFICATION_QUEUE, ADMIN_RESPONDERS_DIRECTORY } from "../../../constants/routes.js"
import logo from "../../../assets/logo.svg"
import {
  LayoutDashboard,
  AlertTriangle,
  History,
  BookOpen,
  PhoneCall,
  User,
  AlertCircle,
  CheckSquare,
  Activity,
  MapPin,
  Users,
  Shield,
  BarChart3,
  LogOut,
  ChevronDown,
  Menu,
  X,
  UserCheck,
} from "lucide-react"

export default function Sidebar() {
  const user = useAuthStore((state) => state.user)
  const logoutUser = useAuthStore((state) => state.logoutUser)
  const navigate = useNavigate()
  const location = useLocation()
  const currentPath = location.pathname + location.search

  const [expandedItems, setExpandedItems] = useState({})
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // Helper to determine if a link is active based on path and query parameters
  const isLinkActive = (itemPath) => {
    if (itemPath.includes("?")) {
      return currentPath === itemPath
    }
    const searchParams = new URLSearchParams(location.search)
    return location.pathname === itemPath && !searchParams.get("tab")
  }

  // Get configuration of sidebar items based on the user's role
  const getSidebarItems = (role) => {
    switch (role) {
      case "user":
        return [
          {
            label: "Dashboard",
            path: USER_DASHBOARD,
            icon: LayoutDashboard,
          },
          {
            label: "My Emergency History",
            path: `${USER_DASHBOARD}?tab=history`,
            icon: History,
          },
          {
            label: "First Aid Guides",
            path: `${USER_DASHBOARD}?tab=guides`,
            icon: BookOpen,
            children: [
              { label: "CPR", path: `${USER_DASHBOARD}?tab=guides&topic=cpr` },
              { label: "Choking", path: `${USER_DASHBOARD}?tab=guides&topic=choking` },
              { label: "Bleeding Control", path: `${USER_DASHBOARD}?tab=guides&topic=bleeding` },
              { label: "Fractures & Burns", path: `${USER_DASHBOARD}?tab=guides&topic=fractures` },
            ],
          },
          {
            label: "Emergency Contacts",
            path: `${USER_DASHBOARD}?tab=contacts`,
            icon: PhoneCall,
          },
          {
            label: "My Profile",
            path: `${USER_DASHBOARD}?tab=profile`,
            icon: User,
          },
        ]
      case "responder":
        return [
          {
            label: "Dashboard",
            path: RESPONDER_DASHBOARD,
            icon: LayoutDashboard,
          },
          {
            label: "Nearby Emergencies",
            path: `${RESPONDER_DASHBOARD}?tab=nearby`,
            icon: AlertCircle,
          },
          {
            label: "Active Assignments",
            path: `${RESPONDER_DASHBOARD}?tab=assignments`,
            icon: CheckSquare,
            children: [
              { label: "En Route", path: `${RESPONDER_DASHBOARD}?tab=assignments&status=en_route` },
              { label: "On Scene", path: `${RESPONDER_DASHBOARD}?tab=assignments&status=on_scene` },
            ],
          },
          {
            label: "Availability Status",
            path: `${RESPONDER_DASHBOARD}?tab=availability`,
            icon: Activity,
          },
          {
            label: "My Location",
            path: `${RESPONDER_DASHBOARD}?tab=location`,
            icon: MapPin,
          },
          {
            label: "My Profile",
            path: `${RESPONDER_DASHBOARD}?tab=profile`,
            icon: User,
          },
        ]
      case "admin":
        return [
          {
            label: "Live Overview",
            path: ADMIN_DASHBOARD,
            icon: LayoutDashboard,
          },
          {
            label: "Verification Queue",
            path: ADMIN_VERIFICATION_QUEUE,
            icon: UserCheck,
          },
          {
            label: "Responders Directory",
            path: ADMIN_RESPONDERS_DIRECTORY,
            icon: Users,
          },
        ]
      default:
        return []
    }
  }

  const items = getSidebarItems(user?.role)

  // Automatically expand parent items if a child path is currently active (derived state)
  const isItemExpanded = (item) => {
    if (expandedItems[item.label] !== undefined) {
      return expandedItems[item.label]
    }
    return !!item.children?.some((child) => isLinkActive(child.path))
  }

  const toggleExpand = (label, path) => {
    setExpandedItems((prev) => {
      const item = items.find((i) => i.label === label)
      const currentVal = prev[label] !== undefined ? prev[label] : !!item?.children?.some((child) => isLinkActive(child.path))
      return {
        ...prev,
        [label]: !currentVal,
      }
    })
    navigate(path)
  }

  const getLinkClass = (itemPath) => {
    const isActive = isLinkActive(itemPath)
    if (user?.role === "admin") {
      return `flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-md transition-all duration-200 cursor-pointer w-full ${
        isActive
          ? "bg-gray-100 text-gray-800"
          : "bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800"
      }`
    }
    return `flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-xl transition-all duration-200 cursor-pointer w-full ${
      isActive
        ? "bg-gray-100 text-gray-900 font-semibold shadow-xs"
        : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
    }`
  }

  const getSubLinkClass = (itemPath) => {
    const isActive = isLinkActive(itemPath)
    return `flex items-center gap-2 pl-9 pr-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 cursor-pointer w-full ${
      isActive
        ? "bg-gray-50 text-gray-900 font-semibold"
        : "text-gray-500 hover:bg-gray-50/50 hover:text-gray-900"
    }`
  }

  const getProfileRoute = () => {
    if (user?.role === "admin") return `${ADMIN_DASHBOARD}?tab=profile`
    if (user?.role === "responder") return `${RESPONDER_DASHBOARD}?tab=profile`
    return `${USER_DASHBOARD}?tab=profile`
  }

  const isAdmin = user?.role === "admin"

  return (
    <>
      {/* Floating Toggle Button (Mobile Only) */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed top-4 left-4 z-[99] p-2 bg-white rounded-xl border border-gray-200 shadow-sm md:hidden cursor-pointer hover:bg-gray-50 text-gray-700"
        aria-label="Toggle Menu"
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Backdrop (Mobile Only) */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
        />
      )}

      {/* Sidebar Aside */}
      <aside
        className={`
          flex flex-col h-screen bg-white border-r border-gray-200 shrink-0 select-none
          transition-all duration-300
          fixed z-50 top-0 left-0
          md:static md:translate-x-0 md:z-auto
          ${isMobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"}
          w-64
        `}
      >
        {/* Logo Section */}
        <div className={`flex items-center shrink-0 ${isAdmin ? "px-4 pt-5 pb-3 justify-start" : "gap-3 px-5 py-6 border-b border-gray-100"}`}>
          <Link to={HOME_ROUTE} className="flex items-center gap-2">
            <span className={`overflow-hidden shrink-0 flex items-start justify-center ${isAdmin ? "h-6 w-7" : "h-9 w-10"}`}>
              <img
                src={logo}
                alt="Sahayog"
                className={`max-w-none object-contain ${isAdmin ? "h-11 w-11 -mt-0.5" : "h-16 w-16 -mt-1"}`}
              />
            </span>
            <span className={`font-bold text-[#1f73b7] leading-none ${isAdmin ? "text-lg" : "text-2xl"}`}>
              Sahayog
            </span>
          </Link>
        </div>

        {/* Main Navigation (Scrollable) */}
        <div className={`flex-1 overflow-y-auto ${isAdmin ? "px-2.5 py-3 space-y-0.5" : "px-3 py-4 space-y-1"}`}>
          <nav className={isAdmin ? "space-y-0.5" : "space-y-1"}>
            {items.map((item) => {
              const Icon = item.icon
              const hasChildren = !!item.children
              const isExpanded = isItemExpanded(item)

              if (hasChildren) {
                return (
                  <div key={item.label} className="space-y-1">
                    <button
                      onClick={() => toggleExpand(item.label, item.path)}
                      className="flex items-center justify-between px-3 py-3 text-sm font-medium rounded-xl transition-all duration-200 cursor-pointer w-full text-left text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                      title={item.label}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 shrink-0" />
                        <span>{item.label}</span>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* Collapsible Children */}
                    {isExpanded && (
                      <div className="mt-1 space-y-1">
                        {item.children.map((child) => (
                          <Link
                            key={child.label}
                            to={child.path}
                            className={getSubLinkClass(child.path)}
                            onClick={() => setIsMobileOpen(false)}
                          >
                            <span className="text-gray-600 hover:text-gray-900 truncate">
                              {child.label}
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <Link
                  key={item.label}
                  to={item.path}
                  className={getLinkClass(item.path)}
                  title={item.label}
                  onClick={() => setIsMobileOpen(false)}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Sticky Bottom Section */}
        {!isAdmin && (
          <div className="p-3 border-t border-gray-100 flex flex-col gap-2 shrink-0">
            {/* Logout */}
            <button
              onClick={() => {
                logoutUser()
                navigate(HOME_ROUTE)
              }}
              className="flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-xl text-red-600 hover:bg-red-50 transition-all duration-200 cursor-pointer w-full text-left"
              title="Logout"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span>Logout</span>
            </button>

            {/* User Profile */}
            <Link
              to={getProfileRoute()}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-all duration-200 cursor-pointer"
              title="My Profile"
              onClick={() => setIsMobileOpen(false)}
            >
              <div className="h-9 w-9 shrink-0 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm select-none">
                {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="overflow-hidden text-left">
                <p className="text-sm font-semibold text-gray-900 truncate leading-none mb-1">
                  {user?.name || "User"}
                </p>
                <p className="text-xs text-gray-500 capitalize leading-none">
                  {user?.role || "Civilian"}
                </p>
              </div>
            </Link>
          </div>
        )}
      </aside>
    </>
  )
}
