import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import useAuthStore from "../../stores/authStore.js"
import MapComponent from "../../components/map/MapComponent.jsx"
import EmergencyMarker from "../../components/map/EmergencyMarker.jsx"
import ResponderMarker from "../../components/map/ResponderMarker.jsx"
import EmergencyFormPanel from "../../components/emergency/EmergencyFormPanel.jsx"
import { useSocket, SOCKET_EVENTS } from "../../hooks/useSocket.js"
import { getNearbyEmergencies, createEmergency, deleteEmergency } from "../../api/emergency.js"
import { getNearbyResponders } from "../../api/responder.js"
import { Marker, Circle, useMapEvents, useMap } from "react-leaflet"
import L from "leaflet"
import { HeartPulse, Shield, Flame, AlertTriangle, CheckCircle, Waves, XCircle, LayoutGrid, Bookmark, ChevronRight } from "lucide-react"
import toast from "react-hot-toast"
import cprChokingGuide from "../../assets/cpr-choking-guide.png"
import bleedingControlGuide from "../../assets/bleeding-control-guide.jpg"

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

  // Socket.IO real-time updates
  const socket = useSocket()

  useEffect(() => {
    if (!socket || !user?.id) return

    // Join user room for targeted notifications
    socket.emit('join', user.id)

    // Listen for new emergencies nearby
    socket.on(SOCKET_EVENTS.NEW_EMERGENCY, (emergency) => {
      setEmergencies(prev => {
        // Add only if not already in list
        if (!prev.find(e => e._id === emergency._id)) {
          toast.success('🚨 New emergency nearby!')
          return [emergency, ...prev]
        }
        return prev
      })
    })

    // Listen for responder status updates
    socket.on(SOCKET_EVENTS.RESPONDER_ONLINE, (responder) => {
      setResponders(prev =>
        prev.map(r => r._id === responder._id ? { ...r, isAvailable: true } : r)
      )
    })

    socket.on(SOCKET_EVENTS.RESPONDER_OFFLINE, (responder) => {
      setResponders(prev =>
        prev.map(r => r._id === responder._id ? { ...r, isAvailable: false } : r)
      )
    })

    // Listen for location updates
    socket.on(SOCKET_EVENTS.LOCATION_UPDATE, (responder) => {
      setResponders(prev =>
        prev.map(r => r._id === responder._id ? { ...r, latitude: responder.latitude, longitude: responder.longitude } : r)
      )
    })

    return () => {
      socket.off(SOCKET_EVENTS.NEW_EMERGENCY)
      socket.off(SOCKET_EVENTS.RESPONDER_ONLINE)
      socket.off(SOCKET_EVENTS.RESPONDER_OFFLINE)
      socket.off(SOCKET_EVENTS.LOCATION_UPDATE)
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
    const topic = searchParams.get("topic") || "cpr"

    const guideTopics = [
      {
        id: "cpr",
        title: "CPR & Choking",
        icon: HeartPulse,
        image: cprChokingGuide,
        imageAlt: "Emergency first aid guide for CPR and choking",
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
        image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1200&q=80",
        imageAlt: "Emergency medical care in progress",
      },
    ]
    const selectedGuide = guideTopics.find((g) => g.id === topic) || guideTopics[0]

    const getGuideContent = () => {
      switch (topic) {
        case "cpr":
          return null
        case "bleeding":
          return null
        case "fractures":
          return (
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-red-700">Fractures & Burns Care:</h4>
              <p className="font-semibold text-[11px] text-gray-800">Fractures:</p>
              <ul className="list-disc pl-4 text-xs text-gray-600 space-y-1">
                <li>Do not try to realign the bone.</li>
                <li>Support and splint the limb in the position found.</li>
                <li>Apply ice to reduce swelling.</li>
              </ul>
              <p className="font-semibold text-[11px] text-gray-800 mt-2">Burns:</p>
              <ul className="list-disc pl-4 text-xs text-gray-600 space-y-1">
                <li>Cool the burn under cool running water for 10-20 mins.</li>
                <li>Do not apply butter, oil, or ice to the burn.</li>
                <li>Cover loosely with sterile, non-stick dressing.</li>
              </ul>
            </div>
          )
        default:
          return null
      }
    }

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

        {!fullPage && (
          <div className="grid grid-cols-3 gap-2">
            {guideTopics.map((g) => (
              <button
                key={g.id}
                onClick={() => setSearchParams({ tab: "guides", topic: g.id })}
                className={`py-3 px-3 text-xs font-bold border rounded-lg text-center transition ${
                  topic === g.id
                    ? "border-red-500 bg-red-50/50 text-red-700 font-semibold"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {g.title}
              </button>
            ))}
          </div>
        )}

        {["cpr", "bleeding"].includes(selectedGuide.id) ? (
          <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <img
              src={selectedGuide.image}
              alt={selectedGuide.imageAlt}
              className="w-full h-auto"
            />
          </div>
        ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="relative h-56 md:h-72 bg-gray-100">
            <img
              src={selectedGuide.image}
              alt={selectedGuide.imageAlt}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-white/80">First aid guide</p>
              <h3 className="text-2xl font-bold text-white leading-tight">{selectedGuide.title}</h3>
            </div>
          </div>
          <div className={fullPage ? "p-6" : "p-4"}>
          {getGuideContent()}
          </div>
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
    return (
      <div className="p-4 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 leading-tight">My Profile</h2>
          <p className="text-xs text-gray-500">Manage account information</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900 leading-none mb-1">{user?.name}</h3>
              <p className="text-[10px] text-gray-500 capitalize leading-none">{user?.role}</p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-2">
            <div>
              <span className="text-[9px] font-bold text-gray-400 block uppercase tracking-wider">Email</span>
              <span className="text-xs text-gray-800 font-semibold">{user?.email}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-gray-400 block uppercase tracking-wider">Phone Number</span>
              <span className="text-xs text-gray-800 font-semibold">{user?.phone || "N/A"}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-gray-400 block uppercase tracking-wider">Member Since</span>
              <span className="text-xs text-gray-800 font-semibold">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
              </span>
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
          return (
            <div className="flex flex-col h-full bg-[#fafafa]">
              {/* Header section with progress indicator */}
              <div className="p-5 bg-white border-b border-gray-100 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 tracking-tight">Starting search</h2>
                    <p className="text-xs text-gray-500 font-medium mt-1">Assessing how long it'll take to find a responder</p>
                  </div>
                  {/* Timer badge */}
                  <div className="bg-gray-950 text-white font-mono text-xs px-2.5 py-1.5 rounded-lg flex items-center justify-center tracking-widest font-bold select-none">
                    --:--
                  </div>
                </div>

                {/* Progress bar line */}
                <div className="w-full bg-gray-100 h-[3px] rounded-full overflow-hidden mt-4">
                  <div className="bg-red-500 h-full w-1/3 animate-pulse"></div>
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
                  {/* Step 1: Received */}
                  <div className="relative">
                    <div className="absolute -left-[30px] top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-green-500 text-white shadow-xs">
                      <CheckCircle className="h-3 w-3" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 leading-tight">Emergency report received</h4>
                      <p className="text-[10px] text-gray-500 font-semibold mt-0.5">Report registered successfully on Sahayog network</p>
                    </div>
                  </div>

                  {/* Step 2: Broadcasted */}
                  <div className="relative">
                    <div className="absolute -left-[30px] top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-green-500 text-white shadow-xs">
                      <CheckCircle className="h-3 w-3" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 leading-tight">Coordinates broadcasted</h4>
                      <p className="text-[10px] text-gray-500 font-semibold mt-0.5">Broadcasting signal to responders within 3km</p>
                    </div>
                  </div>

                  {/* Step 3: Contacting Responders */}
                  <div className="relative">
                    <div className="absolute -left-[30px] top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-yellow-50 border border-yellow-200 text-yellow-600 shadow-xs">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 leading-tight">Contacting nearest responder</h4>
                      <p className="text-[10px] text-gray-500 font-semibold mt-0.5">Waiting for available responder confirmation</p>
                    </div>
                  </div>

                  {/* Step 4: Dispatched */}
                  <div className="relative">
                    <div className="absolute -left-[30px] top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-gray-100 text-gray-400 border border-gray-200 shadow-xs">
                      <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-400 leading-tight">Responder dispatched</h4>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5">Awaiting dispatch confirmation details</p>
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
    return `flex-1 py-3 text-center text-xs font-bold border-b-2 transition-all cursor-pointer ${
      isActive
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

  if (loading) {
    return <div>Loading map...</div>
  }

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Map Container */}
      <div style={{ flex: 1, position: "relative" }}>
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
        width: "380px",
        borderLeft: "1px solid #ccc",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflowY: "hidden",
        background: "#fafafa"
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
