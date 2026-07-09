import { useState } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import useAuthStore from "../../../stores/authStore.js"
import { HOME_ROUTE, USER_DASHBOARD, RESPONDER_DASHBOARD, ADMIN_DASHBOARD } from "../../../constants/routes.js"
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
} from "lucide-react"

export default function Sidebar() {
  const user = useAuthStore((state) => state.user)
  const logoutUser = useAuthStore((state) => state.logoutUser)
  const navigate = useNavigate()
  const location = useLocation()
  const currentPath = location.pathname + location.search

  const [expandedItems, setExpandedItems] = useState({})

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
            label: "Report Emergency",
            path: `${USER_DASHBOARD}?tab=report`,
            icon: AlertTriangle,
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
              { label: "CPR & Choking", path: `${USER_DASHBOARD}?tab=guides&topic=cpr` },
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
            label: "Dashboard",
            path: ADMIN_DASHBOARD,
            icon: LayoutDashboard,
          },
          {
            label: "Users",
            path: `${ADMIN_DASHBOARD}?tab=users`,
            icon: Users,
          },
          {
            label: "Responders",
            path: `${ADMIN_DASHBOARD}?tab=responders`,
            icon: Shield,
          },
          {
            label: "All Emergencies",
            path: `${ADMIN_DASHBOARD}?tab=emergencies`,
            icon: AlertTriangle,
            children: [
              { label: "Active Cases", path: `${ADMIN_DASHBOARD}?tab=emergencies&filter=active` },
              { label: "Resolved Cases", path: `${ADMIN_DASHBOARD}?tab=emergencies&filter=resolved` },
            ],
          },
          {
            label: "Analytics",
            path: `${ADMIN_DASHBOARD}?tab=analytics`,
            icon: BarChart3,
          },
          {
            label: "My Profile",
            path: `${ADMIN_DASHBOARD}?tab=profile`,
            icon: User,
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
    return `flex items-center justify-center md:justify-start gap-3 px-3 py-3 md:px-4 md:py-3 text-sm font-medium rounded-xl transition-all duration-200 cursor-pointer w-full ${
      isActive
        ? "bg-gray-100 text-gray-900 font-semibold shadow-xs"
        : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
    }`
  }

  const getSubLinkClass = (itemPath) => {
    const isActive = isLinkActive(itemPath)
    return `flex items-center justify-center md:justify-start gap-2 pl-3 md:pl-9 pr-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 cursor-pointer w-full ${
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

  return (
    <aside className="flex flex-col h-screen bg-white border-r border-gray-200 shrink-0 select-none transition-all duration-300 w-16 md:w-64">
      {/* Logo Section */}
      <div className="flex items-center justify-center md:justify-start gap-3 px-4 md:px-6 py-5 border-b border-gray-100 shrink-0">
        <Link to={HOME_ROUTE} className="flex items-center gap-3">
          <img src={logo} alt="Sahayog" className="h-9 w-9 object-contain shrink-0" />
          <span className="font-bold text-xl text-gray-900 tracking-tight hidden md:inline-block">
            Sahayog
          </span>
        </Link>
      </div>

      {/* Main Navigation (Scrollable) */}
      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        {/* Urgent Emergency Shortcut for Users Only */}
        {user?.role === "user" && (
          <div className="px-1 md:px-2 py-2">
            <Link
              to={`${USER_DASHBOARD}?tab=report`}
              className="flex items-center justify-center gap-2 px-2 py-3 md:px-4 md:py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md shadow-red-500/10 cursor-pointer w-full text-center"
              title="Report Emergency"
            >
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span className="hidden md:inline text-sm whitespace-nowrap">
                Report Emergency
              </span>
            </Link>
          </div>
        )}

        {/* Dynamic Navigation Links */}
        <nav className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon
            const hasChildren = !!item.children
            const isExpanded = isItemExpanded(item)

            if (hasChildren) {
              return (
                <div key={item.label} className="space-y-1">
                  <button
                    onClick={() => toggleExpand(item.label, item.path)}
                    className="flex items-center justify-center md:justify-between px-3 py-3 md:px-4 md:py-3 text-sm font-medium rounded-xl transition-all duration-200 cursor-pointer w-full text-left text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                    title={item.label}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="hidden md:inline">{item.label}</span>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 transition-transform duration-200 hidden md:block ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Collapsible Children items */}
                  {isExpanded && (
                    <div className="mt-1 space-y-1 hidden md:block">
                      {item.children.map((child) => (
                        <Link
                          key={child.label}
                          to={child.path}
                          className={getSubLinkClass(child.path)}
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
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="hidden md:inline whitespace-nowrap">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Sticky Bottom Section */}
      <div className="p-2 md:p-4 border-t border-gray-100 flex flex-col gap-2 shrink-0">
        {/* Logout Option */}
        <button
          onClick={() => {
            logoutUser()
            navigate(HOME_ROUTE)
          }}
          className="flex items-center justify-center md:justify-start gap-3 px-3 py-3 md:px-4 md:py-3 text-sm font-medium rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200 cursor-pointer w-full text-left"
          title="Logout"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span className="hidden md:inline">Logout</span>
        </button>

        {/* User Account / Profile Details */}
        <Link
          to={getProfileRoute()}
          className="flex items-center justify-center md:justify-start gap-3 p-2 rounded-xl hover:bg-gray-50 transition-all duration-200 cursor-pointer"
          title="My Profile"
        >
          <div className="h-10 w-10 shrink-0 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm select-none">
            {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="hidden md:block overflow-hidden text-left">
            <p className="text-sm font-semibold text-gray-900 truncate leading-none mb-1">
              {user?.name || "User"}
            </p>
            <p className="text-xs text-gray-500 capitalize leading-none">
              {user?.role || "Civilian"}
            </p>
          </div>
        </Link>
      </div>
    </aside>
  )
}
