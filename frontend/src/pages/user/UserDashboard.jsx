import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import useAuthStore from "../../stores/authStore.js"
import MapComponent from "../../components/map/MapComponent.jsx"
import EmergencyMarker from "../../components/map/EmergencyMarker.jsx"
import ResponderMarker from "../../components/map/ResponderMarker.jsx"
import EmergencyFormPanel from "../../components/emergency/EmergencyFormPanel.jsx"
import ActiveRouteLayer from "../../components/map/ActiveRouteLayer.jsx"
import { useSocketInstance, SOCKET_EVENTS } from "../../sockets/socketContext.js"
import { useEmergencyRoom } from "../../hooks/useEmergencyRoom.js"
import { getNearbyEmergencies, createEmergency, deleteEmergency, getEmergencies } from "../../api/emergency.js"
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
  const [elapsedTime, setElapsedTime] = useState(0)
  const [showDetails, setShowDetails] = useState(false)

  const [liveResponderLocation, setLiveResponderLocation] = useState(null)
  const [syncRouteCoordinates, setSyncRouteCoordinates] = useState(null)
  const [syncJourneyStartedAt, setSyncJourneyStartedAt] = useState(null)
  const currentEmergencyRef = useRef(null)
  currentEmergencyRef.current = submittedEmergency || selectedEmergency

  useEffect(() => {
    if (submittedEmergency?._id) {
      setSyncRouteCoordinates(null)
      setSyncJourneyStartedAt(null)
    }
  }, [submittedEmergency])

  const subLat = submittedEmergency?.reporterLocation?.coordinates?.[1] || null
  const subLon = submittedEmergency?.reporterLocation?.coordinates?.[0] || null

  const myLat = subLat || userLocation[0]
  const myLon = subLon || userLocation[1]
  const responderLat = liveResponderLocation ? liveResponderLocation[0] : null
  const responderLon = liveResponderLocation ? liveResponderLocation[1] : null
  const mapCenter = (responderLat !== null && responderLon !== null)
    ? [(responderLat + myLat) / 2, (responderLon + myLon) / 2]
    : [myLat, myLon]

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
      setShowDetails(false)
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

  // Check for user's active emergency on mount or user change
  useEffect(() => {
    const checkActiveEmergency = async () => {
      try {
        const res = await getEmergencies()
        const userEmergencies = res.data.emergencies || []
        // Find the latest emergency that is not resolved or cancelled
        const active = userEmergencies.find(
          (e) => ["active", "assigned", "in_progress"].includes(e.status)
        )
        if (active) {
          setSubmittedEmergency(active)
          setIsSubmitted(true)
          if (active.responderStatus === "en_route") {
            setSyncRouteCoordinates(active.routeCoordinates)
            setSyncJourneyStartedAt(active.journeyStartedAt)
          }
        }
      } catch (error) {
        console.error("Error checking active emergency:", error)
      }
    }
    if (user?.id) {
      checkActiveEmergency()
    }
  }, [user?.id])

  // Elapsed time timer for dispatched emergency view
  const dispatchedStatus = submittedEmergency?.status || "pending"
  const isDispatched = ["assigned", "en_route", "on_scene", "resolved"].includes(dispatchedStatus)
  const isOnScene = ["on_scene", "resolved"].includes(dispatchedStatus)

  useEffect(() => {
    if (!isSubmitted || !isDispatched || !submittedEmergency?.createdAt) return
    const reportTime = new Date(submittedEmergency.createdAt).getTime()
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - reportTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [isSubmitted, isDispatched, submittedEmergency?.createdAt])

  // Socket.IO real-time updates
  const socket = useSocketInstance()
  useEmergencyRoom(submittedEmergency?._id || selectedEmergency?._id || null)

  useEffect(() => {
    if (!socket || !user?.id) return

    // Reporter receives these via the emergency room joined by useEmergencyRoom above.
    // responder:assigned — a responder was assigned to an emergency the user is watching.
    socket.on(SOCKET_EVENTS.RESPONDER_ASSIGNED, (data) => {
      const assignedObj = {
        _id: data.responderId,
        name: data.responderName || "Rescue Team",
        phone: data.responderPhone || "N/A",
        email: data.responderEmail || "",
        skills: data.responderSkills || [],
        etaSeconds: data.etaSeconds || 300,
        etaEstimated: data.etaEstimated === true
      };

      setEmergencies(prev =>
        prev.map(e => e._id === data.emergencyId ? { ...e, status: "assigned", assignedResponder: assignedObj } : e)
      )
      // Also update submittedEmergency if it matches
      setSubmittedEmergency(prev =>
        prev && prev._id === data.emergencyId ? { ...prev, status: "assigned", assignedResponder: assignedObj } : prev
      )
    })

    // emergency:statusUpdate — status changed (en_route / on_scene / resolved).
    socket.on(SOCKET_EVENTS.EMERGENCY_STATUS_UPDATE, (data) => {
      const nextStatus = data.status === "resolved" ? "resolved" : (data.responderStatus || data.status);
      setEmergencies(prev =>
        prev.map(e => e._id === data.emergencyId ? { ...e, status: nextStatus } : e)
      )
      // Also update submittedEmergency if it matches
      setSubmittedEmergency(prev =>
        prev && prev._id === data.emergencyId ? { ...prev, status: nextStatus } : prev
      )
    })

    // responder:location — live coordinate update of assigned responder
    socket.on(SOCKET_EVENTS.RESPONDER_LOCATION, (data) => {
      console.log("[UserDashboard] Received responder location update:", data)
      const currentEmergency = currentEmergencyRef.current
      if (!currentEmergency) return

      const assignedResponderId = currentEmergency.assignedResponder?._id || currentEmergency.assignedResponder
      if (!assignedResponderId) return

      const matchesEmergency =
        String(data.emergencyId) === String(currentEmergency._id);
      const matchesResponder =
        String(data.responderId) === String(assignedResponderId);

      if (matchesEmergency && matchesResponder && Array.isArray(data.coordinates) && data.coordinates.length === 2) {
        setLiveResponderLocation([data.coordinates[1], data.coordinates[0]])
      }
    })

    // journey:started — receive pre-calculated route and start timestamp for synchronized animation
    socket.on(SOCKET_EVENTS.JOURNEY_STARTED, (data) => {
      console.log("[UserDashboard] Received journey start:", data)
      if (data.emergencyId === currentEmergencyRef.current?._id) {
        setSyncRouteCoordinates(data.routeCoordinates)
        setSyncJourneyStartedAt(data.journeyStartedAt)
      }
    })

    return () => {
      socket.off(SOCKET_EVENTS.RESPONDER_ASSIGNED)
      socket.off(SOCKET_EVENTS.EMERGENCY_STATUS_UPDATE)
      socket.off(SOCKET_EVENTS.RESPONDER_LOCATION)
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
          const incidentId = `INC-${submittedEmergency?._id?.slice(-4).toUpperCase() || "0000"}`
          const emergencyType = submittedEmergency?.type || "general"
          const reportedTime = submittedEmergency?.createdAt
            ? new Date(submittedEmergency.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
              " - " +
              new Date(submittedEmergency.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
            : "N/A"

          const responder = submittedEmergency?.assignedResponder
          const responderName = typeof responder === "object" ? (responder?.name || "Rescue Team") : "Rescue Team"
          const responderPhone = typeof responder === "object" ? (responder?.phone || "") : ""
          const responderSkills = typeof responder === "object" ? (responder?.skills || []) : []
          const responderSkillsFormatted = responderSkills.length > 0 
            ? responderSkills.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(", ") 
            : "Emergency Response"
          const responderType = emergencyType.charAt(0).toUpperCase() + emergencyType.slice(1)

          if (showDetails) {
            return (
              <div className="flex flex-col h-full bg-[#fafafa]">
                {/* Header with Back button */}
                <div className="p-4 bg-white border-b border-gray-100 flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowDetails(false)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition cursor-pointer"
                  >
                    <ChevronRight className="h-5 w-5 rotate-180" />
                  </button>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 leading-tight">Details</h2>
                    <p className="text-[10px] text-gray-500 font-medium mt-0.5">Incident: {incidentId}</p>
                  </div>
                </div>

                {/* Scrollable details cards */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                  {/* 1. Assigned Responder card */}
                  <div className="border border-gray-200 rounded-2xl p-5 bg-white shadow-xs">
                    <p className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider mb-4">ASSIGNED RESPONDER</p>
                    {isDispatched ? (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                              <ShieldCheck className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-950 leading-tight">{responderName}</p>
                              <p className="text-[10px] text-gray-500 font-semibold mt-1">{responderSkillsFormatted}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (responderPhone) {
                                  window.location.href = `tel:${responderPhone}`
                                } else {
                                  toast.error("Phone number not available")
                                }
                              }}
                              className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 transition cursor-pointer"
                            >
                              <PhoneCall className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toast.success(`Opening chat with ${responderName}...`)}
                              className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 transition cursor-pointer"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="border-t border-gray-100 pt-3.5 grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Status</span>
                            <p className="text-xs font-bold text-green-600 mt-1">{isOnScene ? "On scene" : "On the way"}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Type</span>
                            <p className="text-xs font-bold text-gray-950 mt-1 capitalize">{responderType}</p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-4 text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-100 rounded-xl">
                        Searching for responder...
                      </div>
                    )}
                  </div>

                  {/* 2. Incident Details card */}
                  <div className="border border-gray-200 rounded-2xl p-5 bg-white shadow-xs space-y-3.5">
                    <p className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider">INCIDENT DETAILS</p>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-semibold">Incident ID</span>
                      <span className="text-gray-950 font-bold">{incidentId}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-semibold">Type</span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold capitalize bg-red-50 text-red-700 border border-red-100">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                        {emergencyType}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-semibold">Reported</span>
                      <span className="text-gray-950 font-bold">{reportedTime}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Action buttons */}
                <div className="p-4 border-t border-gray-200 bg-white shrink-0 space-y-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (responderPhone) {
                        window.location.href = `tel:${responderPhone}`
                      } else {
                        toast.error("Phone number not available")
                      }
                    }}
                    className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <PhoneCall className="h-4 w-4" />
                    Call responder
                  </button>
                  <button
                    type="button"
                    onClick={() => toast.success("Location shared successfully!")}
                    className="w-full py-3 px-4 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-bold transition duration-200 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <MapPin className="h-4 w-4 text-gray-500" />
                    Share exact location
                  </button>
                </div>
              </div>
            )
          }

          if (dispatchedStatus === "resolved") {
            return (
              <div className="flex flex-col items-center justify-center h-full bg-slate-50 p-6 text-center font-sans">
                <div className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-xl max-w-sm w-full space-y-6">
                  <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Emergency Resolved</h2>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      The rescue team has successfully addressed the emergency and marked the status as resolved.
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3.5 text-left text-xs text-slate-600">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-400">Incident ID</span>
                      <span className="font-bold text-slate-800">{incidentId}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-400">Category</span>
                      <span className="font-bold text-slate-800 capitalize">{emergencyType}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-400">Status</span>
                      <span className="font-bold text-green-600 flex items-center gap-1.5 bg-green-50 border border-green-200 px-3 py-1 rounded-full text-[10px] uppercase tracking-wide">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
                        Resolved
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsSubmitted(false);
                      setSubmittedEmergency(null);
                      setSearchParams({ tab: "report" });
                      setShowDetails(false);
                    }}
                    className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold transition-all shadow-md hover:shadow-lg cursor-pointer"
                  >
                    Return to Dashboard
                  </button>
                </div>
              </div>
            );
          }

          if (isDispatched) {
            const elapsedMin = String(Math.floor(elapsedTime / 60)).padStart(2, "0")
            const elapsedSec = String(elapsedTime % 60).padStart(2, "0")
            const etaMin = typeof responder === "object" && responder?.etaSeconds ? Math.max(1, Math.round(responder.etaSeconds / 60)) : 5

            return (
              <div className="flex flex-col h-full bg-[#fafafa]">
                {/* Scrollable Panel Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  
                  {/* Red Hero Card */}
                  <div className="bg-[#cb2525] rounded-2xl p-5 text-white shadow-md">
                    <div className="flex justify-between items-center mb-3">
                      <span className="inline-flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-wider text-white/90">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        Active Emergency
                      </span>
                      <span className="text-[9px] font-extrabold text-white/70 bg-white/15 px-2 py-0.5 rounded-md">{incidentId}</span>
                    </div>
                    <h3 className="text-lg font-black tracking-tight mb-1.5">Help is on the way</h3>
                    <p className="text-[11px] text-white/80 leading-relaxed mb-5">
                      Stay where you are and keep your phone nearby. Response team can see your live location.
                    </p>

                    {/* Progress Bar / Steps */}
                    <div className="flex items-center justify-between relative px-1">
                      <div className="absolute top-2 left-4 right-4 h-0.5 bg-white/25 z-0" />
                      <div 
                        className="absolute top-2 left-4 h-0.5 bg-white z-0 transition-all duration-500" 
                        style={{ width: isOnScene ? "calc(100% - 32px)" : "calc(50% - 16px)" }} 
                      />

                      {/* Step 1: Reported */}
                      <div className="flex flex-col items-center z-10 relative">
                        <div className="w-4.5 h-4.5 rounded-full bg-white border border-[#cb2525] flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#cb2525]" />
                        </div>
                        <span className="text-[8px] font-bold text-white mt-1.5">Reported</span>
                      </div>

                      {/* Step 2: Dispatched */}
                      <div className="flex flex-col items-center z-10 relative">
                        <div className="w-4.5 h-4.5 rounded-full bg-white border border-[#cb2525] flex items-center justify-center shadow-[0_0_0_3px_rgba(255,255,255,0.25)]">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#cb2525]" />
                        </div>
                        <span className="text-[8px] font-bold text-white mt-1.5">Dispatched</span>
                      </div>

                      {/* Step 3: On Scene */}
                      <div className="flex flex-col items-center z-10 relative">
                        <div className={`w-4.5 h-4.5 rounded-full ${isOnScene ? 'bg-white border border-[#cb2525]' : 'bg-white/45'} flex items-center justify-center`}>
                          {isOnScene && <div className="w-1.5 h-1.5 rounded-full bg-[#cb2525]" />}
                        </div>
                        <span className={`text-[8px] font-bold mt-1.5 ${isOnScene ? 'text-white' : 'text-white/60'}`}>On Scene</span>
                      </div>
                    </div>
                  </div>

                  {/* ETA + Elapsed Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
                      <p className="text-[8px] font-extrabold text-gray-400 uppercase tracking-wider mb-1.5">Estimated Arrival</p>
                      <p className="text-2xl font-black text-gray-900 leading-none">
                        {etaMin} <span className="text-xs font-bold text-gray-500">min</span>
                      </p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
                      <p className="text-[8px] font-extrabold text-gray-400 uppercase tracking-wider mb-1.5">Time Elapsed</p>
                      <p className="text-2xl font-black text-gray-900 leading-none font-mono">
                        {elapsedMin}:{elapsedSec}
                      </p>
                    </div>
                  </div>

                  {/* Assigned Responder Card */}
                  <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-2xs">
                    <p className="text-[8px] font-extrabold text-gray-400 uppercase tracking-wider mb-3.5">Assigned Responder</p>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-3xs">
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-950 truncate leading-none mb-1.5">{responderName}</p>
                          <p className="text-[10px] text-gray-500 font-semibold truncate leading-none">{responderSkillsFormatted}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button 
                          onClick={() => {
                            if (responderPhone) {
                              window.location.href = `tel:${responderPhone}`
                            } else {
                              toast.error("Phone number not available")
                            }
                          }}
                          className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 transition cursor-pointer"
                        >
                          <PhoneCall className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          onClick={() => toast.success(`Opening chat with ${responderName}...`)}
                          className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 transition cursor-pointer"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Status</span>
                        <p className="font-bold text-green-600 mt-1">{isOnScene ? "On scene" : "On the way"}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Type</span>
                        <p className="font-bold text-gray-950 mt-1 capitalize">{responderType}</p>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Bottom Actions Area */}
                <div className="p-4 border-t border-gray-200 bg-white shrink-0 space-y-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (responderPhone) {
                        window.location.href = `tel:${responderPhone}`
                      } else {
                        toast.error("Phone number not available")
                      }
                    }}
                    className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <PhoneCall className="h-4 w-4" />
                    Call responder
                  </button>
                  <button
                    type="button"
                    onClick={() => toast.success("Location shared successfully!")}
                    className="w-full py-3 px-4 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-bold transition duration-200 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <MapPin className="h-4 w-4 text-gray-500" />
                    Share exact location
                  </button>
                </div>
              </div>
            )
          }

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
                    onClick={() => setShowDetails(true)}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#f3f4f6] hover:bg-[#e5e7eb] text-gray-800 font-bold text-xs transition duration-200 cursor-pointer"
                  >
                    <LayoutGrid className="h-4 w-4 shrink-0 text-gray-500" />
                    Details
                  </button>
                </div>
              </div>

              {/* Active Emergency Hero Card */}
              <div className="flex-1 bg-[#fafafa] p-5 overflow-y-auto">
                <div className="bg-red-600 text-white rounded-3xl p-6 shadow-lg shadow-red-600/20 relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                  {/* Top Row: Title & Badge */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-red-100 opacity-90">
                        ACTIVE EMERGENCY
                      </p>
                    </div>
                    {submittedEmergency?._id && (
                      <div className="bg-red-700/50 backdrop-blur-xs text-[10px] font-mono font-bold px-2 py-1 rounded-md text-red-100 border border-red-500/30">
                        #{submittedEmergency._id.slice(-6).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Main Content */}
                  <div className="mb-6">
                    <h3 className="text-2xl font-black tracking-tight mb-2">
                      Help is on the way
                    </h3>
                    <p className="text-xs text-red-100/90 leading-relaxed font-medium">
                      Stay where you are and keep your phone nearby. Response team can see your live location.
                    </p>
                  </div>

                  {/* 3-step progress indicator */}
                  <div className="mt-auto">
                    <div className="relative flex items-center justify-between px-2">
                      {/* Progress Line Background */}
                      <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-[3px] bg-red-700/40 rounded-full" />
                      
                      {/* Active Progress Line */}
                      <div 
                        className="absolute left-6 top-1/2 -translate-y-1/2 h-[3px] bg-white rounded-full transition-all duration-500"
                        style={{
                          width: isOnScene ? "calc(100% - 3rem)" : isDispatched ? "calc(50% - 1.5rem)" : "0%"
                        }}
                      />

                      {/* Step 1: Reported */}
                      <div className="relative z-10 flex flex-col items-center">
                        <div className="h-6 w-6 rounded-full bg-white flex items-center justify-center text-red-600 shadow-sm transition-all duration-300">
                          <CheckCircle className="h-4 w-4 text-red-600" />
                        </div>
                        <span className="text-[10px] font-bold mt-2 text-white">Reported</span>
                      </div>

                      {/* Step 2: Dispatched */}
                      <div className="relative z-10 flex flex-col items-center">
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center shadow-sm transition-all duration-300 ${
                          isDispatched 
                            ? "bg-white text-red-600" 
                            : "bg-red-700/80 border border-red-500/30 text-red-200"
                        }`}>
                          {isDispatched ? (
                            <CheckCircle className="h-4 w-4 text-red-600" />
                          ) : (
                            <div className="h-1.5 w-1.5 rounded-full bg-red-300" />
                          )}
                        </div>
                        <span className={`text-[10px] font-bold mt-2 ${isDispatched ? "text-white" : "text-red-200/70"}`}>
                          Dispatched
                        </span>
                      </div>

                      {/* Step 3: On Scene */}
                      <div className="relative z-10 flex flex-col items-center">
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center shadow-sm transition-all duration-300 ${
                          isOnScene 
                            ? "bg-white text-red-600" 
                            : "bg-red-700/80 border border-red-500/30 text-red-200"
                        }`}>
                          {isOnScene ? (
                            <CheckCircle className="h-4 w-4 text-red-600" />
                          ) : (
                            <div className="h-1.5 w-1.5 rounded-full bg-red-300" />
                          )}
                        </div>
                        <span className={`text-[10px] font-bold mt-2 ${isOnScene ? "text-white" : "text-red-200/70"}`}>
                          On Scene
                        </span>
                      </div>
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
                    setShowDetails(false)
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

  if (loading) {
    return <div>Loading map...</div>
  }

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-full overflow-hidden relative">
      {/* Map Container */}
      <div className="flex-none h-[45vh] md:h-auto md:flex-1 relative min-w-0">
        {isSubmitted && !isDispatched && (
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

        {/* En-route overlay banner — mirrors old full page layout */}
        {isSubmitted && isDispatched && dispatchedStatus === "en_route" && (
          <div className="absolute top-4 left-4 right-4 bg-blue-600/95 backdrop-blur-md text-white border border-blue-500/30 p-4 rounded-xl z-[1000] flex items-center justify-between shadow-xl animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <MapPin className="text-white w-5 h-5" />
              </div>
              <span className="font-extrabold text-sm tracking-wide">Responder is on the way</span>
            </div>
            <div className="text-sm font-bold bg-white/20 px-3 py-1.5 rounded-lg shadow-sm">
              Tracking live
            </div>
          </div>
        )}

        {isSubmitted && isDispatched && dispatchedStatus === "on_scene" && (
          <div className="absolute top-4 left-4 right-4 bg-green-600/95 backdrop-blur-md text-white border border-green-500/30 p-4 rounded-xl z-[1000] flex items-center gap-3 shadow-xl">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <CheckCircle className="text-white w-5 h-5" />
            </div>
            <span className="font-extrabold text-sm tracking-wide">Responder has arrived on scene</span>
          </div>
        )}

        {/* Map Legend */}
        {isSubmitted && isDispatched && (
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
        )}
        <MapComponent center={isSubmitted && isDispatched ? mapCenter : (isSubmitted && subLat && subLon ? [subLat, subLon] : [form.latitude, form.longitude])} zoom={isSubmitted && isDispatched ? 14 : 13}>
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

          {isSubmitted && isDispatched && (
            <>
              {/* Responder marker — hidden when animated route marker is active */}
              {liveResponderLocation && dispatchedStatus !== "en_route" && (
                <ResponderMarker
                  responder={{
                    location: { coordinates: [responderLon, responderLat] },
                    name: "Responder",
                    isAvailable: false
                  }}
                />
              )}

              {/* User Location Target Marker */}
              <Marker
                position={[myLat, myLon]}
                icon={L.divIcon({
                  className: "",
                  html: `<div style="display:flex;flex-direction:column;align-items:center;">
                    <div style="background:#ef4444;color:#fff;font-size:10px;font-weight:800;padding:4px 8px;border-radius:99px;white-space:nowrap;margin-bottom:6px;box-shadow:0 2px 8px rgba(239,68,68,0.3);border:1px solid rgba(255,255,255,0.2);text-transform:uppercase;letter-spacing:0.5px;">You</div>
                    <div style="position:relative;width:28px;height:28px;background:rgba(239,68,68,0.25);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 4px rgba(239,68,68,0.1);">
                      <div style="width:18px;height:18px;background:#ef4444;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width:10px;height:10px;color:white;"><path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clip-rule="evenodd" /></svg>
                      </div>
                    </div>
                  </div>`,
                  iconSize: [60, 60],
                  iconAnchor: [30, 48],
                })}
              />

              {/* Animated route layer — uses synchronized Mode B if route sync state exists */}
              {liveResponderLocation && (
                <ActiveRouteLayer
                  responderCoords={[responderLat, responderLon]}
                  emergencyCoords={[myLat, myLon]}
                  syncRouteCoordinates={syncRouteCoordinates}
                  syncJourneyStartedAt={syncJourneyStartedAt}
                  isEnRoute={dispatchedStatus === "en_route"}
                  renderMarker={dispatchedStatus === "en_route"}
                  showRoute={dispatchedStatus === "en_route"}
                  responderName="Responder"
                  isAvailable={false}
                />
              )}
            </>
          )}

          {isSubmitted && submittedEmergency && subLat && subLon && !isDispatched && (
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
      <div className="w-full md:w-[clamp(300px,30vw,420px)] border-t md:border-t-0 md:border-l border-gray-200 flex flex-col flex-1 md:h-[100dvh] overflow-y-hidden bg-[#fafafa] shrink-0">
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


    </div>
  )
}
