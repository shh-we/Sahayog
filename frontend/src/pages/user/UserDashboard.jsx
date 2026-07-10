import { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import useAuthStore from "../../stores/authStore.js"
import MapComponent from "../../components/map/MapComponent.jsx"
import EmergencyMarker from "../../components/map/EmergencyMarker.jsx"
import ResponderMarker from "../../components/map/ResponderMarker.jsx"
import EmergencyFormPanel from "../../components/emergency/EmergencyFormPanel.jsx"
import { useSocket, SOCKET_EVENTS } from "../../hooks/useSocket.js"
import { getNearbyEmergencies, createEmergency } from "../../api/emergency.js"
import { getNearbyResponders } from "../../api/responder.js"
import { Marker, Circle, useMapEvents } from "react-leaflet"
import { HeartPulse, Shield, Flame, AlertTriangle, CheckCircle } from "lucide-react"
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

  // Form State for Emergency Panel
  const [form, setForm] = useState({
    type: "fire",
    description: "",
    address: "",
    longitude: 85.324,
    latitude: 27.7172,
    radius: 5000,
  })
  const [formLoading, setFormLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

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
        radius: Number(form.radius),
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
        radius: 5000,
      })

      // Set submission success state instead of redirecting
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
      .filter((e) => e.createdBy === user?.id || e.createdBy?._id === user?.id)
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
            <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-white animate-fade-in">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-50 text-green-500 mb-6 shadow-md animate-bounce">
                <CheckCircle className="h-12 w-12" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Emergency Submitted</h2>
              <p className="text-sm text-gray-500 max-w-xs mb-8">
                Your report has been successfully recorded. Nearby responders have been notified.
              </p>
              <div className="flex flex-col gap-3 w-full max-w-[280px]">
                <button
                  type="button"
                  onClick={() => setIsSubmitted(false)}
                  className="w-full inline-flex items-center justify-center rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 text-sm transition-all duration-200 shadow-md shadow-red-500/10 cursor-pointer"
                >
                  Report Another Emergency
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSubmitted(false)
                    setSearchParams({ tab: "history" })
                  }}
                  className="w-full rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-2.5 px-4 text-sm transition-all duration-200 cursor-pointer"
                >
                  View My Reports
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
        <MapComponent center={userLocation} zoom={13}>
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
              <Circle
                center={[form.latitude, form.longitude]}
                radius={form.radius}
                pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 0.12 }}
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
