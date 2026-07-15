import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import useAuthStore from "../../stores/authStore.js"
import MapComponent from "../../components/map/MapComponent.jsx"
import EmergencyMarker from "../../components/map/EmergencyMarker.jsx"
import ResponderMarker from "../../components/map/ResponderMarker.jsx"
import EmergencyFormPanel from "../../components/emergency/EmergencyFormPanel.jsx"
import { useSocketInstance, SOCKET_EVENTS } from "../../sockets/SocketProvider.jsx"
import { useEmergencyRoom } from "../../hooks/useEmergencyRoom.js"
import { getNearbyEmergencies, createEmergency, deleteEmergency } from "../../api/emergency.js"
import { getNearbyResponders } from "../../api/responder.js"
import { Marker, Circle, useMapEvents, useMap, Polyline } from "react-leaflet"
import L from "leaflet"
import { HeartPulse, Shield, Flame, AlertTriangle, CheckCircle, Waves, XCircle, LayoutGrid, Bookmark, ChevronRight, Mail, Phone, Calendar, Clock, MapPin, ShieldCheck, MessageSquare, PhoneCall } from "lucide-react"
import toast from "react-hot-toast"
import cprGuide from "../../assets/cpr-guide.png"
import chokingGuide from "../../assets/choking-guide.png"
import bleedingControlGuide from "../../assets/bleeding-control-guide.jpg"
import fracturesBurnsGuide from "../../assets/fractures-burns-guide.png"

// Internal component to capture map clicks and update coordinates
function MapClickHandler({ onClick }) {
  useMapEvents({
    click(event) {
      onClick(event.latlng.lat, event.latlng.lng)
    },
  })
  return null
}

// Internal component to change map view dynamically
function ChangeMapView({ center }) {
  const map = useMap()
  const lastCenterRef = useRef(null)

  useEffect(() => {
    if (center && center[0] && center[1]) {
      const centerKey = `${center[0]},${center[1]}`
      if (lastCenterRef.current !== centerKey) {
        lastCenterRef.current = centerKey
        map.setView(center, 15, { animate: true })
      }
    }
  }, [center, map])
  return null
}

export default function UserDashboard() {
  const user = useAuthStore((state) => state.user)
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get("tab")

  // Checks if the report panel should be shown (default state when tab is empty or explicitly "report")
  const isReporting = !activeTab || activeTab === "report"

  const [emergencies, setEmergencies] = useState([])
  const [responders, setResponders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEmergency, setSelectedEmergency] = useState(null)
  const [userLocation, setUserLocation] = useState([27.7172, 85.3240]) // Default Kathmandu coords

  const [form, setForm] = useState({
    type: "fire",
    description: "",
    address: "",
    longitude: 85.324,
    latitude: 27.7172,
  })
  const [formLoading, setFormLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submittedEmergency, setSubmittedEmergency] = useState(null)
  const [radarRadius, setRadarRadius] = useState(100)
  const [dispatchedAt, setDispatchedAt] = useState(null)
  const [elapsedTime, setElapsedTime] = useState(0)

  const subLat = submittedEmergency?.reporterLocation?.coordinates?.[1] || null
  const subLon = submittedEmergency?.reporterLocation?.coordinates?.[0] || null

  // Pulse effect for searching responders (up to 500m)
  useEffect(() => {
    if (!isSubmitted) return
    const interval = setInterval(() => {
      setRadarRadius((prev) => (prev >= 500 ? 50 : prev + 25))
    }, 50)
    return () => clearInterval(interval)
  }, [isSubmitted])

  const handleCancelEmergency = async () => {
    if (!submittedEmergency) return
    const toastId = toast.loading("Cancelling emergency report...")
    try {
      await deleteEmergency(submittedEmergency._id)
      toast.success("Emergency report cancelled successfully", { id: toastId })
      setIsSubmitted(false)
      setSubmittedEmergency(null)
    } catch (error) {
      console.error("Error cancelling emergency:", error)
      toast.error(error.response?.data?.message || "Failed to cancel emergency", { id: toastId })
    }
  }

  const handleSaveLocation = () => {
    if (!submittedEmergency) return
    toast.success("Emergency location saved to favorites!")
  }

  const fetchNearbyData = async (lat, lng) => {
    try {
      const radius = 10000 // 10km radius
      const params = { latitude: lat, longitude: lng, radius }

      // Fetch both emergencies and responders
      const [emergenciesRes, respondersRes] = await Promise.all([
        getNearbyEmergencies(params),
        getNearbyResponders(params)
      ])

      setEmergencies(emergenciesRes.data.emergencies || [])
      setResponders(respondersRes.data.responders || [])
      setLoading(false)
    } catch (error) {
      console.error("Error fetching nearby data:", error)
      toast.error("Failed to fetch nearby data")
      setLoading(false)
    }
  }

  // Get user location and fetch nearby emergencies/responders
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Get user's current location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude } = position.coords
              setUserLocation([latitude, longitude])

              // Fetch nearby emergencies
              fetchNearbyData(latitude, longitude)
            },
            (error) => {
              console.warn("Geolocation error:", error)
              // Use default location if geolocation fails
              fetchNearbyData(27.7172, 85.3240)
            }
          )
        } else {
          fetchNearbyData(27.7172, 85.3240)
        }
      } catch (error) {
        console.error("Error in fetchData:", error)
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Sync form coordinates when user location is detected
  useEffect(() => {
    if (userLocation) {
      setForm((prev) => ({
        ...prev,
        latitude: userLocation[0],
        longitude: userLocation[1],
      }))
    }
  }, [userLocation])

  // Reset submitted state when changing tabs
  useEffect(() => {
    if (activeTab !== "report" && activeTab !== null && activeTab !== "") {
      setIsSubmitted(false)
      setSubmittedEmergency(null)
    }
  }, [activeTab])

  // Elapsed time timer for dispatched emergency view
  const dispatchedStatus = submittedEmergency?.status || "pending"
  const showDispatchedView = isSubmitted && ["assigned", "en_route", "on_scene", "resolved"].includes(dispatchedStatus)

  useEffect(() => {
    if (!showDispatchedView || !dispatchedAt) return
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - dispatchedAt) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [showDispatchedView, dispatchedAt])

  // Socket.IO real-time updates
  const socket = useSocketInstance()
  useEmergencyRoom(selectedEmergency?._id || null)

  useEffect(() => {
    if (!socket || !user?.id) return

    // Reporter receives these via the emergency room joined by useEmergencyRoom above.
    // responder:assigned — a responder was assigned to an emergency the user is watching.
    socket.on(SOCKET_EVENTS.RESPONDER_ASSIGNED, (data) => {
      setEmergencies(prev =>
        prev.map(e => e._id === data.emergencyId ? { ...e, status: "assigned", assignedResponder: data.responderId } : e)
      )
      // Also update submittedEmergency if it matches
      setSubmittedEmergency(prev =>
        prev && prev._id === data.emergencyId ? { ...prev, status: "assigned", assignedResponder: data.responderId } : prev
      )
      // Record dispatch time
      setDispatchedAt(Date.now())
    })

    // emergency:statusUpdate — status changed (en_route / on_scene / resolved).
    socket.on(SOCKET_EVENTS.EMERGENCY_STATUS_UPDATE, (data) => {
      setEmergencies(prev =>
        prev.map(e => e._id === data.emergencyId ? { ...e, status: data.status } : e)
      )
      // Also update submittedEmergency if it matches
      setSubmittedEmergency(prev =>
        prev && prev._id === data.emergencyId ? { ...prev, status: data.status } : prev
      )
    })

    return () => {
      socket.off(SOCKET_EVENTS.RESPONDER_ASSIGNED)
      socket.off(SOCKET_EVENTS.EMERGENCY_STATUS_UPDATE)
    }
  }, [socket, user?.id])

  const updateFormLocation = (lat, lng) => {
    setForm((prev) => ({
      ...prev,
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
    }))
  }

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by this browser")
      return
    }

    const toastId = toast.loading("Getting your current location...")
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        updateFormLocation(latitude, longitude)
        setUserLocation([latitude, longitude]) // Center map
        toast.success("Location detected", { id: toastId })
      },
      (error) => {
        console.error("Geolocation error:", error)
        toast.error("Could not get your location", { id: toastId })
      }
    )
  }

  const handleFormSubmit = async (event) => {
    event.preventDefault()

    setFormLoading(true)
    try {
      const response = await createEmergency({
        type: form.type,
        description: form.description.trim(),
        address: form.address.trim(),
        longitude: Number(form.longitude),
        latitude: Number(form.latitude),
      })

      toast.success("Emergency reported successfully")

      // Update local state list
      setEmergencies((prev) => [response.data.emergency, ...prev])

      // Reset form
      setForm({
        type: "fire",
        description: "",
        address: "",
        longitude: userLocation[1],
        latitude: userLocation[0],
      })

      setSubmittedEmergency(response.data.emergency)
      setIsSubmitted(true)
    } catch (error) {
      console.error("Error creating emergency:", error)
      toast.error(error.response?.data?.message || "Failed to report emergency")
    } finally {
      setFormLoading(false)
    }
  }

  // --- Sub-panel Render Functions ---
  const renderHistory = ({ fullPage = false } = {}) => {
    const userEmergencies = emergencies
      .filter((e) => e.reporterId === user?.id || e.reporterId?._id === user?.id)
      .filter((e, index, list) => list.findIndex((item) => item._id === e._id) === index)

    return (
      <div className={`${fullPage ? "max-w-4xl mx-auto p-6 md:p-8" : "p-4"} space-y-4`}>
        <div>
          <h2 className={`${fullPage ? "text-2xl" : "text-lg"} font-bold text-gray-900 leading-tight`}>
            My Emergency History
          </h2>
          <p className={`${fullPage ? "text-sm" : "text-xs"} text-gray-500`}>
            History of cases you reported
          </p>
        </div>

        {userEmergencies.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm bg-white rounded-xl border border-gray-200 p-4">
            No emergencies reported by you yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-200 bg-white">
                  <th className="px-4 py-4 text-xs font-semibold text-gray-600">Emergency Type</th>
                  <th className="px-4 py-4 text-xs font-semibold text-gray-600">Date/Time</th>
                  <th className="px-4 py-4 text-xs font-semibold text-gray-600 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {userEmergencies.map((e) => (
                  <tr key={e._id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                    <td className="px-4 py-4 text-sm font-medium text-gray-700 capitalize">{e.type}</td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {e.createdAt
                        ? new Date(e.createdAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                        : "N/A"}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        <span className="capitalize">{e.status || "Pending"}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  const renderGuides = ({ fullPage = false } = {}) => {
    const topic = searchParams.get("topic") || null

    const guideTopics = [
      {
        id: "cpr",
        title: "CPR",
        icon: HeartPulse,
        image: cprGuide,
        imageAlt: "Step-by-step CPR first aid guide",
      },
      {
        id: "choking",
        title: "Choking",
        icon: AlertTriangle,
        image: chokingGuide,
        imageAlt: "Choking and Heimlich maneuver first aid guide",
      },
      {
        id: "bleeding",
        title: "Bleeding Control",
        icon: Shield,
        image: bleedingControlGuide,
        imageAlt: "Emergency first aid guide for bleeding control",
      },
      {
        id: "fractures",
        title: "Fractures & Burns",
        icon: Flame,
        image: fracturesBurnsGuide,
        imageAlt: "First aid guide for fractures and burns",
      },
    ]
    const selectedGuide = topic ? guideTopics.find((g) => g.id === topic) : null

    return (
      <div className={`${fullPage ? "max-w-5xl mx-auto p-6 md:p-8" : "p-4"} space-y-4`}>
        <div>
          <h2 className={`${fullPage ? "text-2xl" : "text-lg"} font-bold text-gray-900 leading-tight`}>
            First Aid Guides
          </h2>
          <p className={`${fullPage ? "text-sm" : "text-xs"} text-gray-500`}>
            Quick emergency instructions
          </p>
        </div>

        {/* Topic selection grid — always visible */}
        <div className={`grid ${fullPage ? "grid-cols-2 gap-4" : "grid-cols-4 gap-2"}`}>
          {guideTopics.map((g) => {
            const Icon = g.icon
            return (
              <button
                key={g.id}
                onClick={() => setSearchParams({ tab: "guides", topic: g.id })}
                className={`${fullPage ? "flex items-center gap-4 p-5" : "py-3 px-2"} text-xs font-bold border rounded-xl text-center transition cursor-pointer ${topic === g.id
                    ? "border-red-500 bg-red-50/50 text-red-700 font-semibold"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300"
                  }`}
              >
                {fullPage && <Icon className="h-6 w-6 shrink-0" />}
                <span className={fullPage ? "text-sm font-bold" : ""}>{g.title}</span>
              </button>
            )
          })}
        </div>

        {/* Guide image — only shown after user clicks a topic */}
        {selectedGuide && (
          <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <img
              src={selectedGuide.image}
              alt={selectedGuide.imageAlt}
              className="w-full h-auto"
            />
          </div>
        )}
      </div>
    )
  }

  const renderContacts = ({ fullPage = false } = {}) => {
    const contacts = [
      { name: "Police Dispatch", number: "100", details: "Nepal Police Emergency Line" },
      { name: "Fire Brigade", number: "101", details: "Kathmandu Valley Fire Control" },
      { name: "Ambulance Services", number: "102", details: "Red Cross & Lalitpur Dispatch" },
      { name: "Disaster Management", number: "1155", details: "National Disaster Office" },
    ]

    return (
      <div className={`${fullPage ? "max-w-4xl mx-auto p-6 md:p-8" : "p-4"} space-y-4`}>
        <div>
          <h2 className={`${fullPage ? "text-2xl" : "text-lg"} font-bold text-gray-900 leading-tight`}>
            Emergency Contacts
          </h2>
          <p className={`${fullPage ? "text-sm" : "text-xs"} text-gray-500`}>
            Hotline numbers in Nepal
          </p>
        </div>

        <div className={fullPage ? "space-y-3" : "space-y-2"}>
          {contacts.map((c) => (
            <div key={c.name} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl shadow-xs">
              <div>
                <h4 className={`${fullPage ? "text-sm" : "text-xs"} font-bold text-gray-900`}>{c.name}</h4>
                <p className={`${fullPage ? "text-xs" : "text-[10px]"} text-gray-500`}>{c.details}</p>
              </div>
              <a
                href={`tel:${c.number}`}
                className="inline-flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold transition"
              >
                Call {c.number}
              </a>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderProfile = () => {
    const userEmergencies = emergencies
      .filter((e) => e.reporterId === user?.id || e.reporterId?._id === user?.id)
      .filter((e, index, list) => list.findIndex((item) => item._id === e._id) === index)

    const memberSince = user?.createdAt
      ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "N/A"

    const daysSinceJoined = user?.createdAt
      ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0

    return (
      <div className="min-h-full bg-gray-50">
        <div className="max-w-3xl mx-auto p-6 md:p-8 space-y-6">

          {/* Hero Card */}
          <div className="relative bg-white border border-gray-200 rounded-2xl shadow-sm">
            {/* Gradient Banner */}
            <div className="h-32 bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 rounded-t-2xl relative">
              <div className="absolute inset-0 rounded-t-2xl bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImEiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHBhdGggZD0iTTAgMGgyMHYyMEgweiIgZmlsbD0ibm9uZSIvPjxjaXJjbGUgY3g9IjEwIiBjeT0iMTAiIHI9IjEuNSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNhKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')] opacity-60" />
            </div>

            {/* Profile info below banner */}
            <div className="px-6 pb-6 pt-4 flex flex-col sm:flex-row items-center sm:items-center gap-4 relative">
              {/* Avatar — pulled up to overlap banner */}
              <div className="h-20 w-20 rounded-2xl bg-white p-1 shadow-lg -mt-14 shrink-0">
                <div className="h-full w-full rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-3xl select-none">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="text-center sm:text-left flex-1">
                <h2 className="text-xl font-bold text-gray-900 leading-tight">{user?.name}</h2>
                <div className="flex items-center justify-center sm:justify-start gap-2 mt-1.5">
                  <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide">
                    <ShieldCheck className="h-3 w-3" />
                    {user?.role}
                  </span>
                  <span className="text-[11px] text-gray-400 font-semibold">•</span>
                  <span className="text-[11px] text-gray-500 font-semibold">Joined {memberSince}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
              <p className="text-2xl font-extrabold text-gray-900">{userEmergencies.length}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Reports Filed</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
              <p className="text-2xl font-extrabold text-gray-900">{daysSinceJoined}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Days Active</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
              <div className="flex items-center justify-center">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-2">Status: Active</p>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Contact Information</h3>
              <p className="text-[11px] text-gray-400 font-medium mt-0.5">Your account details</p>
            </div>

            <div className="divide-y divide-gray-100">
              {/* Email */}
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Email Address</p>
                  <p className="text-sm font-semibold text-gray-900 truncate">{user?.email}</p>
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-600">
                  <Phone className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Phone Number</p>
                  <p className="text-sm font-semibold text-gray-900">{user?.phone || "Not provided"}</p>
                </div>
              </div>

              {/* Member Since */}
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Member Since</p>
                  <p className="text-sm font-semibold text-gray-900">{memberSince}</p>
                </div>
              </div>

              {/* Last Updated */}
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Clock className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Last Updated</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {user?.updatedAt
                      ? new Date(user.updatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    )
  }

  const renderRightPanelContent = () => {
    switch (activeTab) {
      case "alerts":
        return (
          <div style={{ padding: "1rem", overflowY: "auto", flex: 1 }}>
            <h3 className="text-sm font-bold text-gray-800 mb-3">Nearby Emergencies ({emergencies.length})</h3>
            {emergencies.length === 0 ? (
              <p className="text-xs text-gray-500">No emergencies nearby</p>
            ) : (
              <div className="space-y-2">
                {emergencies.map(e => (
                  <button
                    key={e._id}
                    type="button"
                    style={{
                      padding: "1rem",
                      border: "1px solid #ddd",
                      cursor: "pointer",
                      borderRadius: "8px",
                      background: selectedEmergency?._id === e._id ? "#e3f2fd" : "white",
                      width: "100%",
                      textAlign: "left",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                    }}
                    onClick={() => setSelectedEmergency(e)}
                  >
                    <p><strong>{e.type.toUpperCase()}</strong></p>
                    <p style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.25rem" }}>{e.description}</p>
                    <p style={{ fontSize: "0.75rem", color: "#999", marginTop: "0.5rem" }}>Status: {e.status}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      case "responders":
        return (
          <div style={{ padding: "1rem", overflowY: "auto", flex: 1 }}>
            <h3 className="text-sm font-bold text-gray-800 mb-3">Available Responders ({responders.length})</h3>
            {responders.length === 0 ? (
              <p className="text-xs text-gray-500">No responders available</p>
            ) : (
              <div className="space-y-2">
                {responders.map(r => (
                  <div
                    key={r._id}
                    style={{
                      padding: "0.75rem",
                      border: "1px solid #ddd",
                      borderRadius: "8px",
                      background: r.isAvailable ? "#e8f5e9" : "#f5f5f5",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                    }}
                  >
                    <p><strong>{r.name}</strong> {r.isAvailable ? "🟢" : "🔴"}</p>
                    <p style={{ fontSize: "0.75rem", color: "#666", marginTop: "0.25rem" }}>{r.skills?.join(", ")}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      case "history":
        return renderHistory()
      case "guides":
        return renderGuides()
      case "contacts":
        return renderContacts()
      case "profile":
        return renderProfile()
      case "report":
      default:
        if (isSubmitted) {
          const emergencyStatus = submittedEmergency?.status || "pending"
          const isDispatched = ["assigned", "en_route", "on_scene", "resolved"].includes(emergencyStatus)
          const isOnScene = ["on_scene", "resolved"].includes(emergencyStatus)

          // Progress bar width based on status
          const progressWidth = isOnScene ? "w-full" : isDispatched ? "w-3/4" : "w-1/3"
          const headerText = isOnScene
            ? "Responder on scene"
            : isDispatched
              ? "Responder dispatched"
              : "Starting search"
          const headerSub = isOnScene
            ? "A responder has arrived at your location"
            : isDispatched
              ? "A responder is on the way to your location"
              : "Assessing how long it'll take to find a responder"

          return (
            <div className="flex flex-col h-full bg-[#fafafa]">
              {/* Header section with progress indicator */}
              <div className="p-5 bg-white border-b border-gray-100 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 tracking-tight">{headerText}</h2>
                    <p className="text-xs text-gray-500 font-medium mt-1">{headerSub}</p>
                  </div>
                  {/* Timer badge */}
                  <div className="bg-gray-950 text-white font-mono text-xs px-2.5 py-1.5 rounded-lg flex items-center justify-center tracking-widest font-bold select-none">
                    --:--
                  </div>
                </div>

                {/* Progress bar line */}
                <div className="w-full bg-gray-100 h-[3px] rounded-full overflow-hidden mt-4">
                  <div className={`${isDispatched ? "bg-green-500" : "bg-red-500"} h-full ${progressWidth} transition-all duration-700 ${isDispatched ? "" : "animate-pulse"}`}></div>
                </div>

                {/* Main Action Buttons */}
                <div className="grid grid-cols-2 gap-3 mt-5">
                  <button
                    type="button"
                    onClick={handleCancelEmergency}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#f3f4f6] hover:bg-[#e5e7eb] text-gray-800 font-bold text-xs transition duration-200 cursor-pointer"
                  >
                    <XCircle className="h-4 w-4 shrink-0 text-gray-500" />
                    Cancel report
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedEmergency(submittedEmergency)}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#f3f4f6] hover:bg-[#e5e7eb] text-gray-800 font-bold text-xs transition duration-200 cursor-pointer"
                  >
                    <LayoutGrid className="h-4 w-4 shrink-0 text-gray-500" />
                    Details
                  </button>
                </div>
              </div>

              {/* Dispatch Progress Tracker */}
              <div className="flex-1 bg-[#fafafa] p-5 overflow-y-auto space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Live Dispatch Status</h3>

                <div className="relative pl-6 space-y-6 border-l border-gray-200 ml-2">
                  {/* Step 1: Received — always complete */}
                  <div className="relative">
                    <div className="absolute -left-[30px] top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-green-500 text-white shadow-xs">
                      <CheckCircle className="h-3 w-3" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 leading-tight">Emergency report received</h4>
                      <p className="text-[10px] text-gray-500 font-semibold mt-0.5">Report registered successfully on Sahayog network</p>
                    </div>
                  </div>

                  {/* Step 2: Broadcasted — always complete */}
                  <div className="relative">
                    <div className="absolute -left-[30px] top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-green-500 text-white shadow-xs">
                      <CheckCircle className="h-3 w-3" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 leading-tight">Coordinates broadcasted</h4>
                      <p className="text-[10px] text-gray-500 font-semibold mt-0.5">Broadcasting signal to responders within 3km</p>
                    </div>
                  </div>

                  {/* Step 3: Contacting Responders — in-progress when pending, complete when dispatched */}
                  <div className="relative">
                    {isDispatched ? (
                      <div className="absolute -left-[30px] top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-green-500 text-white shadow-xs">
                        <CheckCircle className="h-3 w-3" />
                      </div>
                    ) : (
                      <div className="absolute -left-[30px] top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-yellow-50 border border-yellow-200 text-yellow-600 shadow-xs">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                        </span>
                      </div>
                    )}
                    <div>
                      <h4 className={`text-xs font-bold leading-tight ${isDispatched ? "text-gray-900" : "text-gray-900"}`}>Contacting nearest responder</h4>
                      <p className="text-[10px] text-gray-500 font-semibold mt-0.5">
                        {isDispatched ? "Responder confirmed and accepted the assignment" : "Waiting for available responder confirmation"}
                      </p>
                    </div>
                  </div>

                  {/* Step 4: Dispatched — pending when searching, complete when assigned */}
                  <div className="relative">
                    {isDispatched ? (
                      <div className="absolute -left-[30px] top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-green-500 text-white shadow-xs">
                        <CheckCircle className="h-3 w-3" />
                      </div>
                    ) : (
                      <div className="absolute -left-[30px] top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-gray-100 text-gray-400 border border-gray-200 shadow-xs">
                        <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                      </div>
                    )}
                    <div>
                      <h4 className={`text-xs leading-tight ${isDispatched ? "font-bold text-gray-900" : "font-semibold text-gray-400"}`}>Responder dispatched</h4>
                      <p className={`text-[10px] mt-0.5 ${isDispatched ? "text-gray-500 font-semibold" : "text-gray-400 font-medium"}`}>
                        {isDispatched ? "Responder is en route to your location" : "Awaiting dispatch confirmation details"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Bookmark Action */}
              <div className="p-4 border-t border-gray-200 bg-white shrink-0 space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsSubmitted(false)
                    setSubmittedEmergency(null)
                  }}
                  className="w-full inline-flex items-center justify-center rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 text-sm transition-all duration-200 shadow-md shadow-red-500/10 cursor-pointer"
                >
                  Report Another Emergency
                </button>
                <button
                  type="button"
                  onClick={handleSaveLocation}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#f8f9fa] border border-gray-100 hover:bg-gray-100 transition duration-200 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-white shrink-0 shadow-sm">
                      <Bookmark className="h-4 w-4" />
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">Save this emergency location</h4>
                      <p className="text-[10px] text-gray-500 font-semibold mt-0.5">For fast access in future emergencies</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                </button>
              </div>
            </div>
          )
        }
        return (
          <EmergencyFormPanel
            form={form}
            setForm={setForm}
            onSubmit={handleFormSubmit}
            onCancel={() => setSearchParams({ tab: "alerts" })}
            loading={formLoading}
            onLocateMe={handleGetLocation}
          />
        )
    }
  }

  // Determine active tab class for the top switch buttons
  const getTabButtonClass = (tabName) => {
    const isActive = (tabName === "report" && isReporting) || activeTab === tabName
    return `flex-1 py-3 text-center text-xs font-bold border-b-2 transition-all cursor-pointer ${isActive
        ? "border-red-600 text-red-600 font-bold"
        : "border-transparent text-gray-500 hover:text-gray-700"
      }`
  }

  if (activeTab === "guides") {
    return (
      <div className="min-h-full bg-gray-50">
        {renderGuides({ fullPage: true })}
      </div>
    )
  }

  if (activeTab === "history") {
    return (
      <div className="min-h-full bg-gray-50">
        {renderHistory({ fullPage: true })}
      </div>
    )
  }

  if (activeTab === "contacts") {
    return (
      <div className="min-h-full bg-gray-50">
        {renderContacts({ fullPage: true })}
      </div>
    )
  }

  if (activeTab === "profile") {
    return renderProfile()
  }

  // --- Dispatched full-page "Help is on the way" view ---

  if (showDispatchedView) {
    const incidentId = `INC-${submittedEmergency?._id?.slice(-4).toUpperCase() || "0000"}`
    const emergencyType = submittedEmergency?.type || "general"
    const reportedTime = submittedEmergency?.createdAt
      ? new Date(submittedEmergency.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
        " - " +
        new Date(submittedEmergency.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : "N/A"
    const isOnScene = ["on_scene", "resolved"].includes(dispatchedStatus)
    const elapsedMin = String(Math.floor(elapsedTime / 60)).padStart(2, "0")
    const elapsedSec = String(elapsedTime % 60).padStart(2, "0")

    // Simulate responder moving closer/nearby
    const responderLat = subLat ? subLat + 0.004 : userLocation[0] + 0.004
    const responderLon = subLon ? subLon + 0.003 : userLocation[1] + 0.003
    const myLat = subLat || userLocation[0]
    const myLon = subLon || userLocation[1]
    const mapCenter = [(responderLat + myLat) / 2, (responderLon + myLon) / 2]

    return (
      <div style={{ display: "flex", height: "100vh", background: "#f8f9fb", overflow: "hidden" }}>
        {/* Left Panel */}
        <div style={{ width: "420px", minWidth: "320px", maxWidth: "100vw", display: "flex", flexDirection: "column", borderRight: "1px solid #e5e7eb", background: "#fff", overflowY: "auto", flexShrink: 0 }}>

          {/* Active Emergency Solid Red Card */}
          <div style={{ margin: "20px 20px 0", background: "#cb2525", borderRadius: "16px", padding: "20px", color: "#fff", boxShadow: "0 4px 20px rgba(203, 37, 37, 0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", color: "rgba(255, 255, 255, 0.9)" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#fff", display: "inline-block", animation: "pulse 2s infinite" }} />
                Active Emergency
              </span>
              <span style={{ fontSize: "10px", fontWeight: 800, color: "rgba(255, 255, 255, 0.7)", background: "rgba(255, 255, 255, 0.15)", padding: "3px 8px", borderRadius: "6px", letterSpacing: "0.5px" }}>{incidentId}</span>
            </div>
            
            <h2 style={{ fontSize: "24px", fontWeight: 900, color: "#fff", margin: "0 0 8px", letterSpacing: "-0.5px" }}>Help is on the way</h2>
            <p style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.8)", margin: "0 0 24px", lineHeight: 1.5, fontWeight: 500 }}>
              Stay where you are and keep your phone nearby. Response team can see your live location.
            </p>

            {/* Premium 3-step progress bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", padding: "0 10px" }}>
              {/* Connector Line Background */}
              <div style={{ position: "absolute", top: "9px", left: "20px", right: "20px", height: "2px", backgroundColor: "rgba(255, 255, 255, 0.25)", zIndex: 1 }} />
              {/* Active Connector Line */}
              <div style={{ position: "absolute", top: "9px", left: "20px", width: isOnScene ? "calc(100% - 40px)" : "calc(50% - 20px)", height: "2px", backgroundColor: "#fff", zIndex: 2 }} />

              {/* Step 1: Reported */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 3, position: "relative" }}>
                <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#fff", border: "4px solid #cb2525", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#cb2525" }} />
                </div>
                <span style={{ fontSize: "9px", fontWeight: 700, color: "#fff", marginTop: "6px" }}>Reported</span>
              </div>

              {/* Step 2: Responder Dispatched */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 3, position: "relative" }}>
                <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#fff", border: "3px solid #cb2525", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 4px rgba(255, 255, 255, 0.25)" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#cb2525" }} />
                </div>
                <span style={{ fontSize: "9px", fontWeight: 700, color: "#fff", marginTop: "6px" }}>Responder Dispatched</span>
              </div>

              {/* Step 3: On Scene */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 3, position: "relative" }}>
                <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: isOnScene ? "#fff" : "rgba(255, 255, 255, 0.45)", border: isOnScene ? "4px solid #cb2525" : "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {isOnScene && <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#cb2525" }} />}
                </div>
                <span style={{ fontSize: "9px", fontWeight: 700, color: isOnScene ? "#fff" : "rgba(255, 255, 255, 0.6)", marginTop: "6px" }}>On Scene</span>
              </div>
            </div>
          </div>

          {/* Estimated Arrival + Time Elapsed Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", padding: "20px" }}>
            <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
              <p style={{ fontSize: "9px", fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 6px" }}>Estimated Arrival</p>
              <p style={{ fontSize: "32px", fontWeight: 900, color: "#111827", margin: 0, lineHeight: 1 }}>
                2 <span style={{ fontSize: "14px", fontWeight: 700, color: "#6b7280" }}>min</span>
              </p>
            </div>
            <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
              <p style={{ fontSize: "9px", fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 6px" }}>Time Elapsed</p>
              <p style={{ fontSize: "32px", fontWeight: 900, color: "#111827", margin: 0, lineHeight: 1, fontFamily: "monospace" }}>
                {elapsedMin}:{elapsedSec}
              </p>
            </div>
          </div>

          {/* Assigned Responder Card */}
          <div style={{ margin: "0 20px", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "20px", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
            <p style={{ fontSize: "9px", fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 16px" }}>Assigned Responder</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "46px", height: "46px", borderRadius: "12px", background: "#eff6ff", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ShieldCheck style={{ width: "24px", height: "24px", color: "#2563eb" }} />
                </div>
                <div>
                  <p style={{ fontSize: "15px", fontWeight: 800, color: "#111827", margin: 0 }}>Paramedic Team Bravo</p>
                  <p style={{ fontSize: "11px", color: "#6b7280", margin: "2px 0 0", fontWeight: 600 }}>Ambulance - Unit AMB-07</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button 
                  onClick={() => toast.success("Calling responder...")}
                  style={{ width: "36px", height: "36px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#4b5563" }}
                >
                  <PhoneCall style={{ width: "16px", height: "16px" }} />
                </button>
                <button 
                  onClick={() => toast.success("Opening chat...")}
                  style={{ width: "36px", height: "36px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#4b5563" }}
                >
                  <MessageSquare style={{ width: "16px", height: "16px" }} />
                </button>
              </div>
            </div>
            
            <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <span style={{ fontSize: "10px", color: "#9ca3af", fontWeight: 700, textTransform: "uppercase" }}>Status</span>
                <p style={{ fontSize: "12px", fontWeight: 700, color: isOnScene ? "#16a34a" : "#16a34a", margin: "2px 0 0" }}>
                  {isOnScene ? "On scene" : "On the way"}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "10px", color: "#9ca3af", fontWeight: 700, textTransform: "uppercase" }}>Type</span>
                <p style={{ fontSize: "12px", fontWeight: 700, color: "#111827", margin: "2px 0 0", textTransform: "capitalize" }}>Ambulance</p>
              </div>
            </div>
          </div>

          {/* Incident Details Card */}
          <div style={{ margin: "16px 20px", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "20px", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
            <p style={{ fontSize: "9px", fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 16px" }}>Incident Details</p>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
              <span style={{ fontSize: "12px", color: "#6b7280", fontWeight: 600 }}>Incident ID</span>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#111827" }}>{incidentId}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", alignItems: "center" }}>
              <span style={{ fontSize: "12px", color: "#6b7280", fontWeight: 600 }}>Type</span>
              <span style={{ fontSize: "11px", fontWeight: 800, padding: "3px 12px", borderRadius: "99px", textTransform: "capitalize", background: "#fef2f2", color: "#dc2626", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#dc2626" }} />
                {emergencyType}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", color: "#6b7280", fontWeight: 600 }}>Reported</span>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#111827" }}>{reportedTime}</span>
            </div>
          </div>

          {/* Actions panel */}
          <div style={{ padding: "0 20px 20px", marginTop: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
            <button
              type="button"
              onClick={() => toast.success("Calling responder...")}
              style={{ width: "100%", padding: "14px", borderRadius: "12px", background: "#2563eb", color: "#fff", fontSize: "14px", fontWeight: 800, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: "0 2px 10px rgba(37, 99, 235, 0.15)" }}
            >
              <PhoneCall style={{ width: "16px", height: "16px" }} />
              Call responder
            </button>
            <button
              type="button"
              onClick={() => toast.success("Location shared successfully!")}
              style={{ width: "100%", padding: "12px", borderRadius: "12px", background: "#fff", color: "#4b5563", fontSize: "12px", fontWeight: 700, border: "1px solid #e5e7eb", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
            >
              <MapPin style={{ width: "14px", height: "14px", color: "#6b7280" }} />
              Share exact location
            </button>
          </div>
        </div>

        {/* Right Panel — Live Tracking Map */}
        <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column" }}>
          {/* Map Header matching mock */}
          <div style={{ padding: "18px 24px", background: "#fff", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10 }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 900, color: "#111827", margin: 0, letterSpacing: "-0.3px" }}>Live Tracking</h3>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: "2px 0 0", fontWeight: 500 }}>Updates every 10 seconds</p>
            </div>
            
            {/* Header Right Connection Info & Avatar */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#16a34a" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" }} />
                Connected
              </span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#4b5563" }}>Location Enabled</span>
              
              {/* Small User Photo/Avatar */}
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#cbd5e1", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <span style={{ color: "#334155", fontWeight: 800, fontSize: "12px" }}>{user?.name?.charAt(0).toUpperCase()}</span>
              </div>
            </div>
          </div>

          {/* Map Layout */}
          <div style={{ flex: 1, position: "relative" }}>
            <MapComponent center={mapCenter} zoom={14}>
              <ChangeMapView center={mapCenter} />

              {/* Dashed Polyline Connector between Responder and User */}
              <Polyline
                positions={[[responderLat, responderLon], [myLat, myLon]]}
                color="#dc2626"
                dashArray="6, 12"
                weight={2.5}
              />

              {/* Responder Marker */}
              <Marker
                position={[responderLat, responderLon]}
                icon={L.divIcon({
                  className: "",
                  html: `<div style="display:flex;flex-direction:column;align-items:center;">
                    <div style="background:#111827;color:#fff;font-size:9px;font-weight:800;padding:4px 8px;border-radius:6px;white-space:nowrap;margin-bottom:6px;text-transform:uppercase;box-shadow:0 2px 5px rgba(0,0,0,0.15);letter-spacing:0.5px;">AMBULANCE - AMB-07</div>
                    <div style="width:20px;height:20px;background:#2563eb;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.25);display:flex;align-items:center;justify-center:center;transform:rotate(-45deg);">
                      <div style="width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-bottom: 7px solid white; margin: auto;"></div>
                    </div>
                  </div>`,
                  iconSize: [120, 50],
                  iconAnchor: [60, 42],
                })}
              />

              {/* User Location Target Marker */}
              <Marker
                position={[myLat, myLon]}
                icon={L.divIcon({
                  className: "",
                  html: `<div style="display:flex;flex-direction:column;align-items:center;">
                    <div style="background:#dc2626;color:#fff;font-size:9px;font-weight:800;padding:4px 8px;border-radius:6px;white-space:nowrap;margin-bottom:6px;box-shadow:0 2px 5px rgba(0,0,0,0.15);">YOU</div>
                    <div style="position:relative;width:24px;height:24px;background:rgba(220,38,38,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;">
                      <div style="width:12px;height:12px;background:#dc2626;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>
                    </div>
                  </div>`,
                  iconSize: [60, 50],
                  iconAnchor: [30, 44],
                })}
              />
            </MapComponent>

            {/* Live updates floating badge */}
            <div style={{ position: "absolute", top: "20px", right: "20px", zIndex: 1000, background: "#fff", border: "1px solid #e5e7eb", borderRadius: "99px", padding: "6px 14px", display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a", display: "inline-block", animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#374151" }}>Live updates</span>
            </div>

            {/* Path ETA Tooltip */}
            <div style={{ position: "absolute", top: "45%", left: "55%", transform: "translate(-50%, -50%)", zIndex: 1000, background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "8px 14px", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 15px rgba(0,0,0,0.08)" }}>
              <Clock style={{ width: "16px", height: "16px", color: "#2563eb" }} />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "12px", fontWeight: 800, color: "#111827", lineHeight: 1.1 }}>~2 min</span>
                <span style={{ fontSize: "10px", color: "#6b7280", fontWeight: 600, marginTop: "1px" }}>0.4 km</span>
              </div>
            </div>

            {/* Map Legend */}
            <div style={{ position: "absolute", bottom: "20px", left: "20px", zIndex: 1000, background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "12px 16px", boxShadow: "0 2px 10px rgba(0,0,0,0.06)", minWidth: "120px" }}>
              <p style={{ fontSize: "9px", fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 8px" }}>Live Tracking</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#dc2626" }} />
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#374151" }}>You</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#2563eb" }} />
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#374151" }}>Responder</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div>Loading map...</div>
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Map Container */}
      <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
        {isSubmitted && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-white/95 backdrop-blur-md border border-red-100 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-pulse">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-gray-900 leading-none">Searching for Responders</span>
              <span className="text-[10px] text-gray-500 font-semibold mt-0.5">Broadcasting emergency coordinates...</span>
            </div>
          </div>
        )}
        <MapComponent center={isSubmitted && subLat && subLon ? [subLat, subLon] : [form.latitude, form.longitude]} zoom={13}>
          {/* Capture clicks to set location when reporting tab is open */}
          {isReporting && (
            <MapClickHandler onClick={updateFormLocation} />
          )}

          {/* Draggable Reporting Marker & radius overlay */}
          {isReporting && (
            <>
              <Marker
                position={[form.latitude, form.longitude]}
                draggable={true}
                eventHandlers={{
                  dragend: (event) => {
                    const marker = event.target
                    const nextPosition = marker.getLatLng()
                    updateFormLocation(nextPosition.lat, nextPosition.lng)
                  },
                }}
              />
            </>
          )}

          {/* Nearby Emergency Markers */}
          {emergencies.map(emergency => (
            <EmergencyMarker
              key={emergency._id}
              emergency={emergency}
              onClick={setSelectedEmergency}
            />
          ))}

          {/* Nearby Responder Markers */}
          {responders.map(responder => (
            <ResponderMarker
              key={responder._id}
              responder={responder}
            />
          ))}

          {isSubmitted && submittedEmergency && subLat && subLon && (
            <>
              <ChangeMapView center={[subLat, subLon]} />
              {/* Outer pulsing red circle */}
              <Circle
                center={[subLat, subLon]}
                radius={radarRadius}
                pathOptions={{
                  color: '#ef4444',
                  fillColor: '#ef4444',
                  fillOpacity: 0.1,
                  weight: 2,
                }}
              />
              {/* Center custom dot marker with speech bubble */}
              <Marker
                position={[subLat, subLon]}
                icon={L.divIcon({
                  className: 'custom-speech-bubble',
                  html: `
                    <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
                      <!-- Speech Bubble -->
                      <div style="
                        display: flex;
                        align-items: center;
                        background: white;
                        border-radius: 16px;
                        padding: 6px 12px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        border: 1px solid #eee;
                        margin-bottom: 8px;
                        white-space: nowrap;
                        pointer-events: none;
                      ">
                        <div style="
                          width: 24px;
                          height: 24px;
                          border-radius: 6px;
                          background: #ef4444;
                          display: flex;
                          align-items: center;
                          justify-content: center;
                          color: white;
                          font-size: 12px;
                          margin-right: 8px;
                        ">🚨</div>
                        <div style="display: flex; flex-direction: column;">
                          <span style="font-size: 10px; font-weight: 700; color: #111; line-height: 1.1;">Emergency</span>
                          <span style="font-size: 9px; color: #666; font-weight: 500; line-height: 1.1; margin-top: 1px;">Location</span>
                        </div>
                      </div>
                      <!-- Pin Arrow -->
                      <div style="
                        width: 0;
                        height: 0;
                        border-left: 6px solid transparent;
                        border-right: 6px solid transparent;
                        border-top: 6px solid white;
                        margin-top: -9px;
                        filter: drop-shadow(0 2px 2px rgba(0,0,0,0.1));
                      "></div>
                      <!-- Center Pin Point -->
                      <div style="
                        width: 10px;
                        height: 10px;
                        background: white;
                        border: 2.5px solid #222;
                        border-radius: 50%;
                        margin-top: 4px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                      "></div>
                    </div>
                  `,
                  iconSize: [120, 70],
                  iconAnchor: [60, 68]
                })}
              />
            </>
          )}
        </MapComponent>
      </div>

      {/* Sidebar - Form Panel and Views */}
      <div style={{
        width: "clamp(300px, 30vw, 420px)",
        borderLeft: "1px solid #e5e7eb",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflowY: "hidden",
        background: "#fafafa",
        flexShrink: 0,
      }}>
        {/* Tab switch bar for main dashboard actions */}
        {(!activeTab || ["report", "alerts", "responders"].includes(activeTab)) && (
          <div className="flex border-b border-gray-200 bg-white shrink-0">
            <button
              onClick={() => {
                setIsSubmitted(false)
                setSearchParams({ tab: "report" })
              }}
              className={getTabButtonClass("report")}
            >
              Report Emergency
            </button>
            <button
              onClick={() => setSearchParams({ tab: "responders" })}
              className={getTabButtonClass("responders")}
            >
              Responders ({responders.length})
            </button>
          </div>
        )}

        {/* Dynamic Inner Panel View content */}
        <div className="flex-1 overflow-y-auto">
          {renderRightPanelContent()}
        </div>
      </div>

      {/* Selected Emergency Details Modal */}
      {selectedEmergency && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "white",
            padding: "2rem",
            borderRadius: "8px",
            minWidth: "400px",
            maxWidth: "500px"
          }}>
            <h2 className="font-bold text-lg mb-2">{selectedEmergency.type.toUpperCase()}</h2>
            <p className="text-sm text-gray-700 mb-3">{selectedEmergency.description}</p>
            <p className="text-xs text-gray-500 mb-1"><strong>Status:</strong> {selectedEmergency.status}</p>
            <p className="text-xs text-gray-500 mb-4"><strong>Responders Assigned:</strong> {selectedEmergency.responders?.length || 0}</p>
            <button
              type="button"
              onClick={() => setSelectedEmergency(null)}
              style={{
                padding: "0.5rem 1rem",
                background: "#666",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
