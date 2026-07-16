import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import useAuthStore from "../../stores/authStore.js"
import MapComponent from "../../components/map/MapComponent.jsx"
import EmergencyMarker from "../../components/map/EmergencyMarker.jsx"
import ResponderMarker from "../../components/map/ResponderMarker.jsx"
import { useSocketInstance, SOCKET_EVENTS } from "../../sockets/socketContext.js"
import { useEmergencyRoom } from "../../hooks/useEmergencyRoom.js"
import { getEmergencies } from "../../api/emergency.js"
import { getAllResponders, getStats } from "../../api/admin.js"
import toast from "react-hot-toast"
import { 
  AlertTriangle, 
  Users, 
  Shield, 
  Activity, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  MapPin,
  Calendar,
  X,
  ChevronRight,
  UserCheck
} from "lucide-react"

export default function AdminDashboard() {
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()
  const [emergencies, setEmergencies] = useState([])
  const [responders, setResponders] = useState([])
  const [stats, setStats] = useState({
    emergencies: { total: 0, active: 0, completed: 0 },
    responders: { total: 0, available: 0 },
    users: { total: 0 },
    admins: 0,
    avgResponseTime: "0 mins"
  })
  const [loading, setLoading] = useState(true)
  const [selectedEmergency, setSelectedEmergency] = useState(null)
  const [time, setTime] = useState("")
  const [mapFilter, setMapFilter] = useState("all")
  const mapRef = useRef(null)

  const getRelativeTime = (date) => {
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  const getLiveEvents = () => {
    const events = []
    
    emergencies.forEach((e) => {
      events.push({
        id: `report-${e._id}`,
        type: "emergency",
        title: `${e.type.toUpperCase()} Reported`,
        detail: e.address,
        time: new Date(e.createdAt),
        status: e.status,
        icon: AlertTriangle,
        original: e
      })
      
      if (["assigned", "en_route", "on_scene"].includes(e.status)) {
        events.push({
          id: `responder-${e._id}`,
          type: "responder",
          title: `Responder ${e.status.replace("_", " ")}`,
          detail: `${e.type.toUpperCase()} at ${e.address}`,
          time: new Date(e.updatedAt || e.createdAt),
          status: e.status,
          icon: Shield,
          original: e
        })
      }
    })
    
    return events.sort((a, b) => b.time - a.time).slice(0, 15)
  }

  // Dynamic Kathmandu Clock
  useEffect(() => {
    const updateTime = () => {
      const options = {
        timeZone: "Asia/Kathmandu",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }
      setTime(new Intl.DateTimeFormat("en-US", options).format(new Date()))
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Fetch all data in parallel
        const [statsRes, emergenciesRes, respondersRes] = await Promise.all([
          getStats(),
          getEmergencies({ limit: 100 }),
          getAllResponders({ limit: 100 })
        ])

        setStats(statsRes.data.stats)
        setEmergencies(emergenciesRes.data.emergencies || [])
        setResponders(respondersRes.data.responders || [])
        setLoading(false)
      } catch (err) {
        console.error("Error fetching admin data:", err)
        toast.error("Failed to fetch admin data")
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Socket.IO real-time updates for admin
  const socket = useSocketInstance()
  useEmergencyRoom(selectedEmergency?._id || null)

  useEffect(() => {
    if (!socket) return

    // Admin receives these only via the emergency room joined by useEmergencyRoom above
    // (when selectedEmergency is set). Feature 5 does not publish any global feed.

    // emergency:statusUpdate — status change in the currently selected emergency.
    socket.on(SOCKET_EVENTS.EMERGENCY_STATUS_UPDATE, (data) => {
      setEmergencies(prev =>
        prev.map(e => e._id === data.emergencyId ? { ...e, status: data.status } : e)
      )
    })

    // responder:assigned — a responder was confirmed on the selected emergency.
    socket.on(SOCKET_EVENTS.RESPONDER_ASSIGNED, (data) => {
      setEmergencies(prev =>
        prev.map(e => e._id === data.emergencyId ? { ...e, status: "assigned", assignedResponder: data.responderId } : e)
      )
    })

    return () => {
      socket.off(SOCKET_EVENTS.EMERGENCY_STATUS_UPDATE)
      socket.off(SOCKET_EVENTS.RESPONDER_ASSIGNED)
    }
  }, [socket])

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Activity className="h-10 w-10 animate-pulse text-[#1f73b7]" />
          <p className="text-sm font-semibold text-gray-500">Loading live admin overview...</p>
        </div>
      </div>
    )
  }

  // Calculate map center (average of all emergency locations) - Kathmandu
  let mapCenter = [27.7172, 85.3240]
  if (emergencies.length > 0) {
    const coords = emergencies
      .filter(e => e.reporterLocation?.coordinates)
      .map(e => e.reporterLocation.coordinates)
    if (coords.length > 0) {
      const avgLng = coords.reduce((sum, c) => sum + c[0], 0) / coords.length
      const avgLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length
      mapCenter = [avgLat, avgLng]
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 p-6 space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-100 pb-5 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">Live Overview</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            Real-time monitoring of active incidents and responders across the network
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Kathmandu time pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-full text-xs font-semibold shadow-xs">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span>Kathmandu: {time}</span>
          </div>
          {/* LIVE status pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 bg-red-50 text-red-600 rounded-full text-xs font-semibold shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
            </span>
            <span>LIVE</span>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        {/* Active Emergencies */}
        <div className="bg-white border border-gray-200 border-l-4 border-l-red-500 p-4 rounded-xl flex items-center justify-between transition-all hover:shadow-xs">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Emergencies</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {String(stats.emergencies.active || 0).padStart(2, "0")}
            </p>
            <p className="text-[10px] text-red-500 font-medium mt-0.5">Requires attention</p>
          </div>
          <div className="p-3 bg-red-50 rounded-lg text-red-500">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Available Responders */}
        <div className="bg-white border border-gray-200 border-l-4 border-l-emerald-500 p-4 rounded-xl flex items-center justify-between transition-all hover:shadow-xs">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Available Responders</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {String(stats.responders.available || 0).padStart(2, "0")}
            </p>
            <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Ready to dispatch</p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-500">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white border border-gray-200 border-l-4 border-l-amber-500 p-4 rounded-xl flex items-center justify-between transition-all hover:shadow-xs">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending Approvals</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {String(0).padStart(2, "0")}
            </p>
            <p className="text-[10px] text-amber-600 font-medium mt-0.5">Awaiting verification</p>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg text-amber-500">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Workspace split */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        {/* Incident Map Panel */}
        <div className="flex-1 bg-white border border-gray-200 rounded-2xl flex flex-col shadow-xs overflow-hidden min-h-[480px]">
          {/* Map Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-gray-900">Incident Map</h2>
              <p className="text-xs text-gray-500">
                Real-time geographic distribution of active incidents and available responder teams.
              </p>
            </div>
            
            {/* Map Legend */}
            <div className="flex items-center gap-3 text-[10px] font-semibold text-gray-600">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span>Incident</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span>Responder</span>
              </div>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="px-5 py-2.5 bg-gray-50/50 border-b border-gray-100 flex flex-wrap gap-2 shrink-0">
            {[
              { id: "all", label: "All", count: emergencies.length + responders.length },
              { id: "incidents", label: "Incidents", count: emergencies.length },
              { id: "available", label: "Available", count: responders.filter(r => r.isAvailable).length },
              { id: "responders", label: "Responders", count: responders.length }
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setMapFilter(pill.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all flex items-center gap-1.5 cursor-pointer ${
                  mapFilter === pill.id
                    ? "bg-gray-900 border-gray-900 text-white"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900"
                }`}
              >
                <span>{pill.label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  mapFilter === pill.id
                    ? "bg-white/20 text-white"
                    : "bg-gray-100 text-gray-500"
                }`}>
                  {pill.count}
                </span>
              </button>
            ))}
          </div>

          {/* Scrollable Map Viewport */}
          <div className="flex-1 relative">
            {/* Pinned external zoom controls — always visible at top-right of the panel */}
            <div className="absolute top-3 right-3 z-[500] flex flex-col gap-1 bg-white p-1 rounded-lg shadow-md border border-gray-200 pointer-events-auto">
              <button
                type="button"
                onClick={() => mapRef.current?.zoomIn()}
                className="w-7 h-7 flex items-center justify-center text-gray-700 hover:bg-gray-100 rounded-md font-bold text-base transition-colors cursor-pointer select-none"
                aria-label="Zoom In"
              >+</button>
              <div className="h-px bg-gray-100" />
              <button
                type="button"
                onClick={() => mapRef.current?.zoomOut()}
                className="w-7 h-7 flex items-center justify-center text-gray-700 hover:bg-gray-100 rounded-md font-bold text-base transition-colors cursor-pointer select-none"
                aria-label="Zoom Out"
              >−</button>
            </div>

            {/* Scroll container — horizontal and vertical */}
            <div
              className="overflow-x-auto overflow-y-auto h-full min-h-[340px] touch-pan-x scroll-smooth
                [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5
                [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-track]:rounded-full
                [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full
                [&::-webkit-scrollbar-thumb:hover]:bg-gray-400"
            >
              {/* Fixed-width map canvas — never shrinks below 1000px */}
              <div className="min-w-[1000px] max-w-none h-[420px]">
                <MapComponent
                  center={mapCenter}
                  zoom={12}
                  mapRef={mapRef}
                  showZoomControls={false}
                >
                  {/* Emergency Markers */}
                  {(mapFilter === "all" || mapFilter === "incidents") &&
                    emergencies.map(emergency => (
                      <EmergencyMarker
                        key={emergency._id}
                        emergency={emergency}
                        onClick={setSelectedEmergency}
                      />
                    ))
                  }

                  {/* Responder Markers */}
                  {((mapFilter === "all" || mapFilter === "responders") &&
                    responders.map(responder => (
                      <ResponderMarker
                        key={responder._id}
                        responder={responder}
                      />
                    ))) ||
                    (mapFilter === "available" &&
                    responders.filter(r => r.isAvailable).map(responder => (
                      <ResponderMarker
                        key={responder._id}
                        responder={responder}
                      />
                    )))
                  }
                </MapComponent>
              </div>
            </div>
          </div>
        </div>

        {/* Live Activity Panel */}
        <div className="w-full lg:w-96 bg-white border border-gray-200 rounded-2xl flex flex-col shadow-xs min-h-[480px] max-h-[540px]">
          <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              Live Activity
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {getLiveEvents().length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Activity className="h-8 w-8 text-gray-300 mb-2 animate-pulse" />
                <p className="text-sm text-gray-500">No activity logged.</p>
              </div>
            ) : (
              getLiveEvents().map((event) => {
                const EventIcon = event.icon
                const isEmergency = event.type === "emergency"
                const tintClasses = isEmergency
                  ? "bg-red-50/70 border-red-100 hover:bg-red-50 text-red-900"
                  : "bg-blue-50/70 border-blue-100 hover:bg-blue-50 text-blue-900"
                const iconTintClasses = isEmergency
                  ? "bg-red-100 text-red-600"
                  : "bg-blue-100 text-blue-600"
                const detailTintClasses = isEmergency
                  ? "text-red-700/80"
                  : "text-blue-700/80"

                return (
                  <button
                    key={event.id}
                    type="button"
                    className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-3 ${tintClasses}`}
                    onClick={() => setSelectedEmergency(event.original)}
                  >
                    <div className={`p-1.5 rounded-lg shrink-0 ${iconTintClasses}`}>
                      <EventIcon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold truncate">
                          {event.title}
                        </span>
                        <span className="text-[10px] text-gray-400 shrink-0">
                          {getRelativeTime(event.time)}
                        </span>
                      </div>
                      <p className={`text-xs truncate ${detailTintClasses}`}>
                        {event.detail}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          <div className="p-3 border-t border-gray-100 shrink-0">
            <button
              onClick={() => navigate(`${ADMIN_DASHBOARD}?tab=emergencies`)}
              className="w-full text-center py-2 text-xs font-bold text-[#1f73b7] hover:text-[#1a629b] transition-colors flex items-center justify-center gap-1"
            >
              <span>View all emergencies →</span>
            </button>
          </div>
        </div>
      </div>

      {/* Emergency Details Modern Overlay Dialog */}
      {selectedEmergency && (
        <div className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-red-50 text-red-500 rounded-lg">
                  <AlertCircle className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-gray-900 uppercase">
                    {selectedEmergency.type}
                  </h2>
                  <p className="text-xs text-gray-400 capitalize">
                    Incident Status: {selectedEmergency.status}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmergency(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Close details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Description</p>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {selectedEmergency.description || "No description provided."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Location</p>
                  <p className="text-sm text-gray-700 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="truncate">{selectedEmergency.address}</span>
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Reported Time</p>
                  <p className="text-sm text-gray-700 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                    <span>{new Date(selectedEmergency.createdAt).toLocaleString()}</span>
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Assigned Responders ({selectedEmergency.responders?.length || 0})
                </p>

                {selectedEmergency.responders && selectedEmergency.responders.length > 0 ? (
                  <div className="space-y-2">
                    {selectedEmergency.responders.map((r) => (
                      <div key={r._id} className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-100 rounded-lg text-xs">
                        <div className="font-semibold text-gray-700">
                          {r.userId?.name || "Responder"}
                        </div>
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 font-medium rounded-full uppercase text-[10px]">
                          {r.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">No responders currently assigned to this incident.</p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEmergency(null)}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors w-full"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
