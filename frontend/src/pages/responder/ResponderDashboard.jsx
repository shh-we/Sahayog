import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import logo from "../../assets/logo.svg"
import useAuthStore from "../../stores/authStore.js"

import EmergencyForm from "../../components/emergency/EmergencyForm.jsx"
import StatusUpdateForm from "../../components/responder/StatusUpdateForm.jsx"
import { useSocketInstance, SOCKET_EVENTS } from "../../sockets/SocketProvider.jsx"
import { useEmergencyRoom } from "../../hooks/useEmergencyRoom.js"
import { getNearbyEmergencies } from "../../api/emergency.js"
import { toggleAvailability, updateLocation, getMyAssignments, acceptEmergency } from "../../api/responder.js"
import { HOME_ROUTE } from "../../constants/routes.js"
import toast from "react-hot-toast"
import {
  AlertCircle,
  History,
  User,
  LogOut,
  Menu,
  X,
  MapPin,
  Activity,
  CheckCircle,
  CheckCircle2,
  ShieldCheck,
  Mail,
  Phone,
  Calendar
} from "lucide-react"

export default function ResponderDashboard() {
  const user = useAuthStore((state) => state.user)
  const logoutUser = useAuthStore((state) => state.logoutUser)
  const navigate = useNavigate()

  // Navigation tab state
  const [activeTab, setActiveTab] = useState("alerts") // alerts | history | profile

  const [isAvailable, setIsAvailable] = useState(user?.isAvailable || false)
  const [responderLocation, setResponderLocation] = useState([27.7172, 85.3240]) // Kathmandu
  const [nearbyEmergencies, setNearbyEmergencies] = useState([])
  const [assignments, setAssignments] = useState([])
  const [historyAssignments, setHistoryAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedEmergency, setSelectedEmergency] = useState(null)
  const [acceptingId, setAcceptingId] = useState(null)
  const [showEmergencyForm, setShowEmergencyForm] = useState(false)
  const [showStatusForm, setShowStatusForm] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // Get responder location on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Get responder's current location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords
              setResponderLocation([latitude, longitude])

              // Update location in backend
              try {
                await updateLocation({ latitude, longitude })
              } catch (err) {
                console.error("Error updating location:", err)
              }

              // Fetch nearby emergencies and assignments
              await fetchNearbyData(latitude, longitude)
            },
            (error) => {
              console.warn("Geolocation error:", error)
              fetchNearbyData(responderLocation[0], responderLocation[1])
            }
          )
        } else {
          fetchNearbyData(responderLocation[0], responderLocation[1])
        }
      } catch (err) {
        console.error("Error in fetchData:", err)
        setLoading(false)
      }
    }

    fetchData()
  }, []) // Empty dependency array to avoid continuous re-triggers

  // Fetch History whenever the History tab is opened
  const fetchHistory = async () => {
    try {
      setHistoryLoading(true)
      const res = await getMyAssignments(true)
      setHistoryAssignments(res.data.emergencies || [])
    } catch (err) {
      console.error("Error fetching history:", err)
      toast.error("Failed to load assignment history")
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory()
    }
  }, [activeTab])

  // Socket.IO real-time updates
  const socket = useSocketInstance()
  useEmergencyRoom(selectedEmergency?._id || selectedAssignment?._id || null)

  useEffect(() => {
    if (!socket || !user?.id) return

    // Received on the responder's private user room
    socket.on(SOCKET_EVENTS.DISPATCH_OFFER, (offer) => {
      // TODO (Feature dispatch modal): show offer modal with offer.attemptId
    })

    // Received via the emergency room joined by useEmergencyRoom above.
    socket.on(SOCKET_EVENTS.RESPONDER_ASSIGNED, (data) => {
      setAssignments(prev =>
        prev.map(a => a._id === data.emergencyId ? { ...a, status: "assigned", assignedResponder: data.responderId } : a)
      )
    })

    // emergency:statusUpdate fires when the responder updates progress
    socket.on(SOCKET_EVENTS.EMERGENCY_STATUS_UPDATE, (data) => {
      setAssignments(prev =>
        prev.map(a => a._id === data.emergencyId ? { ...a, status: data.status } : a)
      )
    })

    return () => {
      socket.off(SOCKET_EVENTS.DISPATCH_OFFER)
      socket.off(SOCKET_EVENTS.RESPONDER_ASSIGNED)
      socket.off(SOCKET_EVENTS.EMERGENCY_STATUS_UPDATE)
    }
  }, [socket, user?.id])

  const fetchNearbyData = async (lat, lng) => {
    try {
      const radius = 15000 // 15km radius
      const params = { latitude: lat, longitude: lng, radius }

      // Fetch nearby emergencies and my assignments
      const [emergenciesRes, assignmentsRes] = await Promise.all([
        getNearbyEmergencies(params),
        getMyAssignments(false)
      ])

      setNearbyEmergencies(emergenciesRes.data.emergencies || [])
      setAssignments(assignmentsRes.data.emergencies || [])
      setLoading(false)
    } catch (err) {
      console.error("Error fetching data:", err)
      toast.error("Failed to fetch data")
      setLoading(false)
    }
  }

  const handleToggleAvailability = async () => {
    try {
      await toggleAvailability()
      setIsAvailable(!isAvailable)
      toast.success(!isAvailable ? "You are now available for dispatch" : "Availability toggled off")
    } catch (error) {
      console.error("Error updating availability:", error)
      toast.error("Failed to update availability")
    }
  }

  const handleAcceptEmergency = async (emergencyId) => {
    try {
      setAcceptingId(emergencyId)
      await acceptEmergency(emergencyId)
      toast.success("Emergency accepted!")
      
      // Remove from nearby emergencies
      setNearbyEmergencies(nearbyEmergencies.filter(e => e._id !== emergencyId))
      
      // Refresh assignments
      const assignmentsRes = await getMyAssignments(false)
      setAssignments(assignmentsRes.data.emergencies || [])
      
      setSelectedEmergency(null)
    } catch (err) {
      console.error("Error accepting emergency:", err)
      toast.error(err.response?.data?.message || "Failed to accept emergency")
    } finally {
      setAcceptingId(null)
    }
  }

  const handleLogout = () => {
    logoutUser()
    navigate(HOME_ROUTE)
  }

  const hasNotification = assignments.length > 0 || nearbyEmergencies.length > 0

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 text-gray-500 font-sans">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-sm font-medium">Initializing Responder System...</span>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans antialiased text-gray-800 overflow-hidden">
      {/* Floating Toggle Button (Mobile Only) */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed top-4 left-4 z-40 p-2 bg-white rounded-xl border border-gray-200 shadow-sm md:hidden cursor-pointer hover:bg-gray-50 text-gray-700 focus:outline-none"
        aria-label="Toggle Menu"
      >
        {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Backdrop (Mobile Only) */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
        />
      )}

      {/* Fixed Left Sidebar (same width as user dashboard sidebar) */}
      <aside
        className={`
          flex flex-col h-screen bg-white border-r border-gray-200 shrink-0 select-none
          transition-all duration-300
          fixed z-35 top-0 left-0
          md:static md:translate-x-0
          ${isMobileOpen ? "translate-x-0 shadow-xl" : "-translate-x-full md:translate-x-0"}
          w-64
        `}
      >
        {/* Sahayog logo at the top — identical to UserDashboard Sidebar */}
        <div className="flex items-center gap-3 px-5 py-6 border-b border-gray-100 shrink-0">
          <Link to={HOME_ROUTE} className="flex items-center gap-3">
            <span className="h-9 w-10 overflow-hidden shrink-0 flex items-start justify-center">
              <img
                src={logo}
                alt="Sahayog"
                className="h-16 w-16 max-w-none object-contain -mt-1"
              />
            </span>
            <span className="text-2xl font-bold text-[#1f73b7] leading-none">
              Sahayog
            </span>
          </Link>
        </div>

        {/* Responder availability toggle */}
        <div className="p-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-3 py-2">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${isAvailable ? "bg-green-500" : "bg-gray-300"}`} />
              <span className="text-sm font-medium text-gray-700">
                {isAvailable ? "Available" : "Offline"}
              </span>
            </div>
            <button
              onClick={handleToggleAvailability}
              className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none shrink-0 ${isAvailable ? 'bg-green-500' : 'bg-gray-200'}`}
              aria-label="Toggle availability"
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow-sm ${isAvailable ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        {/* Navigation links with small icons */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <nav className="space-y-1">
            <button
              onClick={() => {
                setActiveTab("alerts")
                setIsMobileOpen(false)
              }}
              className={`flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-xl transition-all cursor-pointer w-full text-left ${
                activeTab === "alerts"
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <AlertCircle size={18} className="shrink-0" />
              <span>Active Alerts</span>
              {hasNotification && (
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse ml-auto shrink-0" />
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab("history")
                setIsMobileOpen(false)
              }}
              className={`flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-xl transition-all cursor-pointer w-full text-left ${
                activeTab === "history"
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <History size={18} className="shrink-0" />
              <span>My History</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("profile")
                setIsMobileOpen(false)
              }}
              className={`flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-xl transition-all cursor-pointer w-full text-left ${
                activeTab === "profile"
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <User size={18} className="shrink-0" />
              <span>Duty Profile</span>
            </button>
          </nav>
        </div>

        {/* Sticky Bottom Section */}
        <div className="p-3 border-t border-gray-100 flex flex-col gap-2 shrink-0">
          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-xl text-red-600 hover:bg-red-50 transition-all duration-200 cursor-pointer w-full text-left"
            title="Logout"
          >
            <LogOut size={18} className="shrink-0" />
            <span>Logout</span>
          </button>

          {/* User Profile */}
          <button
            onClick={() => {
              setActiveTab("profile")
              setIsMobileOpen(false)
            }}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-all duration-200 cursor-pointer w-full text-left"
            title="Duty Profile"
          >
            <div className="w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-600 font-bold flex items-center justify-center text-sm shrink-0 select-none shadow-sm uppercase">
              {user?.name ? user.name.substring(0, 2) : "RP"}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-gray-900 truncate leading-none mb-1">
                {user?.name || "Responder Team"}
              </p>
              <p className="text-xs text-gray-500 truncate leading-none capitalize">
                {user?.department || user?.role || "Active Responder"}
              </p>
            </div>
          </button>
        </div>
      </aside>

      {/* Main content container */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden min-w-0 md:pt-0 pt-14">
        {activeTab === "alerts" && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Page heading */}
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 bg-white shrink-0">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">Active Alerts</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {isAvailable ? "On-duty · Awaiting dispatches" : "Off-duty · Not receiving dispatches"}
              </p>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
              <div className="max-w-2xl mx-auto space-y-4">

                {/* ── Monitoring status card (always visible) ── */}
                <div className="border border-gray-200 rounded-2xl bg-white p-8 flex flex-col items-center text-center shadow-sm">
                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-full border flex items-center justify-center mb-4 ${
                    isAvailable ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'
                  }`}>
                    {isAvailable ? (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[#BDF3CF]">
                        <div className="w-4 h-4 rounded-full bg-[#35C96B]" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-200">
                        <div className="w-4 h-4 rounded-full bg-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Status label */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${isAvailable ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                    <span className={`text-sm font-semibold tracking-wide ${isAvailable ? 'text-green-700' : 'text-gray-500'}`}>
                      {isAvailable ? "Monitoring Network: Standing By" : "System Offline: Not Receiving Dispatches"}
                    </span>
                  </div>

                  <p className="text-sm text-gray-500 leading-relaxed max-w-sm">
                    {isAvailable 
                      ? "All systems online. You'll be notified the instant a dispatch is assigned to your unit — no action needed while you wait."
                      : "You are currently off-duty. Toggle your availability in the sidebar to start receiving emergency dispatches."}
                  </p>
                </div>



              </div>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="flex-1 p-6 overflow-y-auto max-w-3xl mx-auto w-full">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">My Assignment History</h1>
                <p className="text-sm text-gray-500 mt-1">Review all emergencies you have successfully resolved.</p>
              </div>
              <div className="px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                {historyAssignments.length} Resolved
              </div>
            </div>

            {historyLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading history...</span>
              </div>
            ) : historyAssignments.length === 0 ? (
              <div className="border border-dashed border-gray-200 rounded-2xl bg-white p-12 text-center shadow-sm">
                <History size={40} className="mx-auto text-gray-300 mb-3" />
                <h3 className="text-sm font-semibold text-gray-700">No History Available</h3>
                <p className="text-xs text-gray-500 mt-1.5">Assignments you accept and resolve will appear here.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {historyAssignments.map((item) => (
                  <div key={item._id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-gray-300 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                          item.type === 'fire' ? 'bg-red-50 text-red-600' :
                          item.type === 'medical' ? 'bg-blue-50 text-blue-600' :
                          item.type === 'security' ? 'bg-purple-50 text-purple-600' :
                          'bg-gray-100 text-gray-605'
                        }`}>
                          {item.type}
                        </span>
                        <span className="text-xs text-gray-300">•</span>
                        <span className="text-xs text-gray-500 font-medium">
                          {new Date(item.resolvedAt || item.updatedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold flex items-center gap-1">
                        <CheckCircle size={12} />
                        RESOLVED
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-805 mt-3 leading-relaxed">{item.description}</p>
                    {item.address && (
                      <div className="mt-2.5 text-xs text-gray-400 flex items-center gap-1.5">
                        <MapPin size={12} className="text-gray-300" />
                        <span>{item.address}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Duty Profile Tab */}
        {activeTab === "profile" && (
          <div className="flex-1 flex flex-col overflow-y-auto bg-gray-50/50">
            <div className="max-w-3xl mx-auto w-full p-4 md:p-6 space-y-4 md:space-y-6">

              {/* Top Header Card */}
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm relative">
                {/* Gradient cover */}
                <div className="h-32 bg-gradient-to-r from-blue-400 to-indigo-500"></div>

                {/* Profile info section */}
                <div className="px-6 pb-6 relative flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  {/* Avatar */}
                  <div className="w-24 h-24 rounded-2xl bg-blue-600 text-white border-4 border-white flex items-center justify-center text-4xl font-bold shadow-sm -mt-12 shrink-0 uppercase">
                    {user?.name ? user.name.charAt(0) : 'N'}
                  </div>

                  {/* Text Info */}
                  <div className="pt-2 text-center sm:text-left w-full">
                    <h2 className="text-2xl font-bold text-gray-900 capitalize">{user?.name || "nayan"}</h2>
                    <div className="flex items-center justify-center sm:justify-start gap-2 mt-1.5 text-xs text-gray-500 font-medium">
                      <span className="inline-flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase font-bold tracking-wide">
                        <ShieldCheck size={12} strokeWidth={2.5} />
                        {user?.role || "USER"}
                      </span>
                      <span>•</span>
                      <span>Joined N/A</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Card 1: Reports Filed */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 text-center shadow-sm">
                  <h3 className="text-3xl font-extrabold text-gray-900">{historyAssignments.length || 23}</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1.5">Reports Filed</p>
                </div>

                {/* Card 2: Days Active */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 text-center shadow-sm">
                  <h3 className="text-3xl font-extrabold text-gray-900">0</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1.5">Days Active</p>
                </div>

                {/* Card 3: Status */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 text-center shadow-sm flex flex-col items-center justify-center h-full">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">
                    Status: {isAvailable ? 'Active' : 'Offline'}
                  </p>
                  <button
                    onClick={handleToggleAvailability}
                    className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none ${isAvailable ? 'bg-green-500' : 'bg-gray-200'}`}
                    aria-label="Toggle availability state"
                  >
                    <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow-sm ${isAvailable ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-5 border-b border-gray-100">
                  <h3 className="text-base font-bold text-gray-900">Contact Information</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Your account details</p>
                </div>

                <div className="divide-y divide-gray-100">
                  {/* Email Row */}
                  <div className="p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                      <Mail size={22} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Email Address</p>
                      <p className="text-sm font-semibold text-gray-900 mt-1">{user?.email || "nayan1@gmail.com"}</p>
                    </div>
                  </div>

                  {/* Phone Row */}
                  <div className="p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-50 text-green-500 flex items-center justify-center shrink-0">
                      <Phone size={22} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Phone Number</p>
                      <p className="text-sm font-semibold text-gray-900 mt-1">{user?.phone || "1111111111"}</p>
                    </div>
                  </div>

                  {/* Member Since Row */}
                  <div className="p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center shrink-0">
                      <Calendar size={22} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Member Since</p>
                      <p className="text-sm font-semibold text-gray-900 mt-1">N/A</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </main>

      {/* Emergency Details Modal */}
      {selectedEmergency && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-xl w-full max-w-sm p-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                selectedEmergency.type === 'fire' ? 'bg-red-50 text-red-600' :
                selectedEmergency.type === 'medical' ? 'bg-blue-50 text-blue-600' :
                selectedEmergency.type === 'security' ? 'bg-purple-50 text-purple-600' :
                'bg-gray-100 text-gray-605'
              }`}>
                {selectedEmergency.type}
              </span>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{selectedEmergency.status}</span>
            </div>

            <p className="text-sm font-semibold text-gray-800 leading-normal">{selectedEmergency.description}</p>
            
            {selectedEmergency.address && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-500 bg-slate-50 border border-gray-200 p-2.5 rounded-lg">
                <MapPin size={14} className="text-gray-400 shrink-0" />
                <span className="truncate">{selectedEmergency.address}</span>
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => handleAcceptEmergency(selectedEmergency._id)}
                disabled={acceptingId === selectedEmergency._id}
                className="flex-1 py-2 px-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer active:scale-[0.98]"
              >
                {acceptingId === selectedEmergency._id ? "Accepting..." : "Accept"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedEmergency(null)}
                className="flex-1 py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition-colors cursor-pointer active:scale-[0.98]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Form Modal */}
      {showEmergencyForm && (
        <EmergencyForm 
          onClose={() => setShowEmergencyForm(false)}
          onSuccess={() => {
            setShowEmergencyForm(false)
            fetchNearbyData(responderLocation[0], responderLocation[1])
          }}
        />
      )}

      {/* Status Update Form Modal */}
      {showStatusForm && selectedAssignment && (
        <StatusUpdateForm
          emergency={selectedAssignment}
          onClose={() => {
            setShowStatusForm(false)
            setSelectedAssignment(null)
          }}
          onStatusUpdated={() => {
            getMyAssignments(false).then(res => {
              setAssignments(res.data.emergencies || [])
              toast.success('Status updated!')
            })
          }}
        />
      )}
    </div>
  )
}
