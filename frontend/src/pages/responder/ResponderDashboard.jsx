import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import logo from "../../assets/logo.svg"
import useAuthStore from "../../stores/authStore.js"
import MapComponent from "../../components/map/MapComponent.jsx"
import EmergencyMarker from "../../components/map/EmergencyMarker.jsx"
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
  Compass
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

        {/* Responder profile card */}
        <div className="p-4 border-b border-gray-100 flex flex-col items-center text-center shrink-0">
          <div className="w-14 h-14 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-lg mb-2 shadow-sm select-none">
            TB
          </div>
          <p className="text-sm font-semibold text-gray-900 leading-tight">
            Paramedic Team Bravo
          </p>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">
            Kathmandu Zone 4
          </p>
          
          {/* Availability Status & Toggle */}
          <div className="flex items-center gap-2 mt-3 justify-center w-full">
            <span className={`w-2 h-2 rounded-full ${isAvailable ? "bg-green-500" : "bg-gray-300"}`} />
            <span className="text-xs font-medium text-gray-600">
              {isAvailable ? "Available" : "Offline"}
            </span>
            <button
              onClick={handleToggleAvailability}
              className={`w-8 h-4.5 rounded-full transition-colors relative focus:outline-none shrink-0 ${isAvailable ? 'bg-green-500' : 'bg-gray-200'}`}
              aria-label="Toggle availability"
            >
              <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform shadow-sm ${isAvailable ? 'translate-x-4' : 'translate-x-0.5'}`} />
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

        {/* Sticky Logout Button */}
        <div className="p-3 border-t border-gray-100 shrink-0">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-xl text-red-600 hover:bg-red-50 transition-all cursor-pointer w-full text-left"
          >
            <LogOut size={18} className="shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content container */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden min-w-0 md:pt-0 pt-14">
        {activeTab === "alerts" && (
          <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
            {/* Map Container */}
            <div className="flex-1 h-[50vh] md:h-full relative border-b md:border-b-0 md:border-r border-gray-200">
              <MapComponent center={responderLocation} zoom={13}>
                {nearbyEmergencies.map(emergency => (
                  <EmergencyMarker
                    key={emergency._id}
                    emergency={emergency}
                    onClick={setSelectedEmergency}
                  />
                ))}
              </MapComponent>
            </div>

            {/* Sidebar Panels (Right Side) - 320px wide */}
            <div className="w-full md:w-[320px] bg-white flex flex-col h-[50vh] md:h-full shrink-0 overflow-y-auto p-4 space-y-4">
              {/* Report Emergency Button */}
              <button
                type="button"
                onClick={() => setShowEmergencyForm(true)}
                className="w-full py-2.5 px-4 bg-red-650 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] cursor-pointer"
              >
                <AlertCircle size={16} />
                Report Emergency
              </button>

              {/* Active Assignments Card */}
              <div className="border border-gray-200 rounded-xl bg-white p-4 shadow-sm">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3.5 flex items-center gap-2">
                  <Activity size={14} className="text-amber-500 shrink-0" />
                  Active Assignments ({assignments.length})
                </h3>
                {assignments.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-sm">
                    No active assignments
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assignments.map(a => (
                      <div
                        key={a._id}
                        className="p-3 border border-gray-100 rounded-xl bg-slate-50/70 hover:bg-slate-100 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                            a.type === 'fire' ? 'bg-red-50 text-red-600' :
                            a.type === 'medical' ? 'bg-blue-50 text-blue-600' :
                            a.type === 'security' ? 'bg-purple-50 text-purple-600' :
                            'bg-gray-100 text-gray-605'
                          }`}>
                            {a.type}
                          </span>
                          <span className="text-xs text-amber-650 font-bold uppercase shrink-0">{a.status}</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-800 mt-2.5 line-clamp-2">{a.description}</p>
                        {a.address && (
                          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5">
                            <MapPin size={12} className="shrink-0" />
                            <span className="truncate">{a.address}</span>
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAssignment(a)
                            setShowStatusForm(true)
                          }}
                          className="w-full py-2 px-3 mt-3.5 bg-blue-650 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          Update Status
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Nearby Emergencies Card */}
              <div className="border border-gray-200 rounded-xl bg-white p-4 shadow-sm">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3.5 flex items-center gap-2">
                  <Compass size={14} className="text-blue-500 shrink-0" />
                  Nearby Emergencies ({nearbyEmergencies.length})
                </h3>
                {nearbyEmergencies.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-sm">
                    No emergencies nearby
                  </div>
                ) : (
                  <div className="space-y-3">
                    {nearbyEmergencies.map(e => (
                      <div
                        key={e._id}
                        className={`p-3 border rounded-xl transition-all ${
                          selectedEmergency?._id === e._id ? 'border-blue-500 bg-blue-50/20' : 'border-gray-100 bg-white hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                            e.type === 'fire' ? 'bg-red-50 text-red-600' :
                            e.type === 'medical' ? 'bg-blue-50 text-blue-600' :
                            e.type === 'security' ? 'bg-purple-50 text-purple-600' :
                            'bg-gray-100 text-gray-605'
                          }`}>
                            {e.type}
                          </span>
                          <button
                            onClick={() => setSelectedEmergency(e)}
                            className="text-xs text-blue-600 hover:underline font-semibold shrink-0"
                          >
                            Details
                          </button>
                        </div>
                        <p className="text-sm font-semibold text-gray-800 mt-2.5 line-clamp-2">{e.description}</p>
                        <button
                          type="button"
                          onClick={() => handleAcceptEmergency(e._id)}
                          disabled={acceptingId === e._id}
                          className="w-full py-2 px-3 mt-3.5 bg-green-605 hover:bg-green-700 disabled:bg-gray-200 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center"
                        >
                          {acceptingId === e._id ? "Accepting..." : "Accept"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
          <div className="flex-1 p-6 overflow-y-auto max-w-2xl mx-auto w-full">
            <div className="border-b border-gray-200 pb-4 mb-6">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Duty Profile</h1>
              <p className="text-sm text-gray-500 mt-1">Manage your active responder duty status and credentials.</p>
            </div>

            <div className="space-y-4">
              {/* Identity Card */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xl shadow-inner select-none shrink-0">
                  TB
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Paramedic Team Bravo</h2>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                    <MapPin size={14} className="text-gray-300 shrink-0" />
                    Kathmandu Zone 4
                  </p>
                  <span className="mt-2.5 inline-flex items-center px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider">
                    {user?.role || "Responder"}
                  </span>
                </div>
              </div>

              {/* Availability Status Card */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Availability Status</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${isAvailable ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                    <span className="text-sm font-semibold text-gray-800">{isAvailable ? 'Available for Dispatch' : 'Duty Offline'}</span>
                  </div>
                  <button
                    onClick={handleToggleAvailability}
                    className={`w-9 h-5 rounded-full transition-colors relative focus:outline-none ${isAvailable ? 'bg-green-500' : 'bg-gray-200'}`}
                    aria-label="Toggle availability state"
                  >
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform shadow-sm ${isAvailable ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {isAvailable 
                    ? "You are visible to the matching algorithm and can receive real-time emergency dispatch offers." 
                    : "Turn on availability to receive nearby emergency offers."}
                </p>
              </div>

              {/* Skills Card */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Emergency Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {(user?.skills && user.skills.length > 0 ? user.skills : ["Medical Response", "CPR Certification", "Trauma Care"]).map((skill, idx) => (
                    <span 
                      key={idx} 
                      className="px-2.5 py-1 bg-slate-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 capitalize"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Geolocation Watcher Info */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Active Location Sharing</h3>
                <div className="flex items-center gap-3 text-sm text-gray-705 bg-slate-50 border border-gray-200 rounded-xl p-3.5">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                    <Compass size={16} />
                  </div>
                  <div>
                    <p className="font-bold text-xs">Current Coordinates</p>
                    <p className="text-xs text-gray-405 mt-0.5">
                      Lat: <span className="font-mono">{responderLocation[0].toFixed(5)}</span>, Lng: <span className="font-mono">{responderLocation[1].toFixed(5)}</span>
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Your coordinates are shared with reporters when you are actively en route to an assignment.
                </p>
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
