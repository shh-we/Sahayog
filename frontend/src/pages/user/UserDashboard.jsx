import { useState, useEffect } from "react"
import { useAuth } from "../../context/AuthContext.jsx"
import MapComponent from "../../components/map/MapComponent.jsx"
import EmergencyMarker from "../../components/map/EmergencyMarker.jsx"
import ResponderMarker from "../../components/map/ResponderMarker.jsx"
import EmergencyForm from "../../components/emergency/EmergencyForm.jsx"
import { useSocket, SOCKET_EVENTS } from "../../hooks/useSocket.js"
import { getNearbyEmergencies } from "../../api/emergency.js"
import { getNearbyResponders } from "../../api/responder.js"
import toast from "react-hot-toast"

export default function UserDashboard() {
  const { user } = useAuth()
  const [emergencies, setEmergencies] = useState([])
  const [responders, setResponders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEmergency, setSelectedEmergency] = useState(null)
  const [showEmergencyForm, setShowEmergencyForm] = useState(false)
  const [userLocation, setUserLocation] = useState([27.7172, 85.3240]) // Default Kathmandu coords

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
              fetchNearbyData(userLocation[0], userLocation[1])
            }
          )
        } else {
          fetchNearbyData(userLocation[0], userLocation[1])
        }
      } catch (error) {
        console.error("Error in fetchData:", error)
        setLoading(false)
      }
    }

    fetchData()
  }, [userLocation])

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



  if (loading) {
    return <div>Loading map...</div>
  }

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Map Container */}
      <div style={{ flex: 1, position: "relative" }}>
        <MapComponent center={userLocation} zoom={13}>
          {/* Emergency Markers */}
          {emergencies.map(emergency => (
            <EmergencyMarker
              key={emergency._id}
              emergency={emergency}
              onClick={setSelectedEmergency}
            />
          ))}

          {/* Responder Markers */}
          {responders.map(responder => (
            <ResponderMarker
              key={responder._id}
              responder={responder}
            />
          ))}
        </MapComponent>
      </div>

      {/* Sidebar - Nearby Emergencies List */}
      <div style={{
        width: "300px",
        borderLeft: "1px solid #ccc",
        padding: "1rem",
        overflowY: "auto",
        background: "#fafafa"
      }}>
        <h2>Welcome, {user?.name}</h2>
        
        <section>
          <h3>Nearby Emergencies ({emergencies.length})</h3>
          {emergencies.length === 0 ? (
            <p>No emergencies nearby</p>
          ) : (
            <div>
              {emergencies.map(e => (
                <button
                  key={e._id}
                  type="button"
                  style={{
                    padding: "1rem",
                    border: "1px solid #ddd",
                    marginBottom: "0.5rem",
                    cursor: "pointer",
                    borderRadius: "4px",
                    background: selectedEmergency?._id === e._id ? "#e3f2fd" : "white",
                    width: "100%",
                    textAlign: "left"
                  }}
                  onClick={() => setSelectedEmergency(e)}
                >
                  <p><strong>{e.type.toUpperCase()}</strong></p>
                  <p style={{ fontSize: "0.9rem", color: "#666" }}>{e.description}</p>
                  <p style={{ fontSize: "0.8rem", color: "#999" }}>Status: {e.status}</p>
                </button>
              ))}
            </div>
          )}
        </section>

        <section style={{ marginTop: "1.5rem" }}>
          <h3>Available Responders ({responders.length})</h3>
          {responders.length === 0 ? (
            <p>No responders available</p>
          ) : (
            <div>
              {responders.map(r => (
                <div
                  key={r._id}
                  style={{
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    marginBottom: "0.5rem",
                    borderRadius: "4px",
                    background: r.isAvailable ? "#e8f5e9" : "#f5f5f5"
                  }}
                >
                  <p><strong>{r.name}</strong> {r.isAvailable ? "🟢" : "🔴"}</p>
                  <p style={{ fontSize: "0.8rem" }}>{r.skills?.join(", ")}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <button
          type="button"
          onClick={() => setShowEmergencyForm(true)}
          style={{
            width: "100%",
            padding: "0.75rem",
            marginTop: "1rem",
            background: "#ff4444",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "1rem"
          }}
        >
           Report Emergency
        </button>
      </div>

      {/* Emergency Form Modal */}
      {showEmergencyForm && (
        <EmergencyForm
          onSuccess={() => {
            // Refresh the emergencies list
            const radius = 10000
            const params = { latitude: userLocation[0], longitude: userLocation[1], radius }
            getNearbyEmergencies(params).then(res => {
              setEmergencies(res.data.emergencies || [])
            })
          }}
          onClose={() => setShowEmergencyForm(false)}
        />
      )}

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
            <h2>{selectedEmergency.type.toUpperCase()}</h2>
            <p>{selectedEmergency.description}</p>
            <p><strong>Status:</strong> {selectedEmergency.status}</p>
            <p><strong>Responders Assigned:</strong> {selectedEmergency.responders?.length || 0}</p>
            <button
              type="button"
              onClick={() => setSelectedEmergency(null)}
              style={{
                marginTop: "1rem",
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
