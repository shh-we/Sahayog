import { useState, useEffect } from "react"
import { useAuth } from "../../context/AuthContext.jsx"
import MapComponent from "../../components/map/MapComponent.jsx"
import EmergencyMarker from "../../components/map/EmergencyMarker.jsx"
import ResponderMarker from "../../components/map/ResponderMarker.jsx"
import { useSocket, SOCKET_EVENTS } from "../../hooks/useSocket.js"
import { getEmergencies } from "../../api/emergency.js"
import { getAllResponders, getStats } from "../../api/admin.js"
import toast from "react-hot-toast"

export default function AdminDashboard() {
  const { user } = useAuth()
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
  const socket = useSocket()

  useEffect(() => {
    if (!socket) return

    // Join admin room
    socket.emit('join', user?.id)

    // Listen for new emergencies
    socket.on(SOCKET_EVENTS.NEW_EMERGENCY, (emergency) => {
      setEmergencies(prev => {
        if (!prev.find(e => e._id === emergency._id)) {
          toast.success(' New emergency reported!')
          return [emergency, ...prev]
        }
        return prev
      })
      
      // Update stats
      setStats(prev => ({
        ...prev,
        emergencies: {
          ...prev.emergencies,
          total: prev.emergencies.total + 1,
          active: prev.emergencies.active + 1
        }
      }))
    })

    // Listen for emergency status updates
    socket.on(SOCKET_EVENTS.STATUS_UPDATE, (data) => {
      setEmergencies(prev =>
        prev.map(e => e._id === data.emergencyId ? { ...e, status: data.status } : e)
      )
    })

    // Listen for responder availability changes
    socket.on(SOCKET_EVENTS.RESPONDER_ONLINE, (responder) => {
      setResponders(prev =>
        prev.map(r => r._id === responder._id ? { ...r, isAvailable: true } : r)
      )
      setStats(prev => ({
        ...prev,
        responders: { ...prev.responders, available: prev.responders.available + 1 }
      }))
    })

    socket.on(SOCKET_EVENTS.RESPONDER_OFFLINE, (responder) => {
      setResponders(prev =>
        prev.map(r => r._id === responder._id ? { ...r, isAvailable: false } : r)
      )
      setStats(prev => ({
        ...prev,
        responders: { ...prev.responders, available: Math.max(0, prev.responders.available - 1) }
      }))
    })

    // Listen for location updates
    socket.on(SOCKET_EVENTS.LOCATION_UPDATE, (responder) => {
      setResponders(prev =>
        prev.map(r => r._id === responder._id ? { ...r, latitude: responder.latitude, longitude: responder.longitude } : r)
      )
    })

    return () => {
      socket.off(SOCKET_EVENTS.NEW_EMERGENCY)
      socket.off(SOCKET_EVENTS.STATUS_UPDATE)
      socket.off(SOCKET_EVENTS.RESPONDER_ONLINE)
      socket.off(SOCKET_EVENTS.RESPONDER_OFFLINE)
      socket.off(SOCKET_EVENTS.LOCATION_UPDATE)
    }
  }, [socket, user?.id])

  if (loading) {
    return <div>Loading admin dashboard...</div>
  }

  // Calculate map center (average of all emergency locations) - Kathmandu
  let mapCenter = [27.7172, 85.3240]
  if (emergencies.length > 0) {
    const coords = emergencies
      .filter(e => e.location?.coordinates)
      .map(e => e.location.coordinates)
    if (coords.length > 0) {
      const avgLng = coords.reduce((sum, c) => sum + c[0], 0) / coords.length
      const avgLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length
      mapCenter = [avgLat, avgLng]
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Map Container */}
      <div style={{ flex: 1, position: "relative" }}>
        <MapComponent center={mapCenter} zoom={11}>
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

      {/* Sidebar - Admin Stats */}
      <div style={{
        width: "350px",
        borderLeft: "1px solid #ccc",
        padding: "1rem",
        overflowY: "auto",
        background: "#fafafa"
      }}>
        <h2>Admin Dashboard</h2>

        <section style={{ marginBottom: "1.5rem" }}>
          <h3>Statistics</h3>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem"
          }}>
            <div style={{
              padding: "1rem",
              background: "#e3f2fd",
              borderRadius: "4px",
              textAlign: "center"
            }}>
              <p style={{ fontSize: "0.9rem", color: "#666" }}>Total Emergencies</p>
              <p style={{ fontSize: "2rem", fontWeight: "bold" }}>{stats.emergencies.total}</p>
            </div>
            <div style={{
              padding: "1rem",
              background: "#e8f5e9",
              borderRadius: "4px",
              textAlign: "center"
            }}>
              <p style={{ fontSize: "0.9rem", color: "#666" }}>Active Emergencies</p>
              <p style={{ fontSize: "2rem", fontWeight: "bold" }}>{stats.emergencies.active}</p>
            </div>
            <div style={{
              padding: "1rem",
              background: "#fff3e0",
              borderRadius: "4px",
              textAlign: "center"
            }}>
              <p style={{ fontSize: "0.9rem", color: "#666" }}>Available Responders</p>
              <p style={{ fontSize: "2rem", fontWeight: "bold" }}>{stats.responders.available}</p>
            </div>
            <div style={{
              padding: "1rem",
              background: "#f3e5f5",
              borderRadius: "4px",
              textAlign: "center"
            }}>
              <p style={{ fontSize: "0.9rem", color: "#666" }}>Total Users</p>
              <p style={{ fontSize: "2rem", fontWeight: "bold" }}>{stats.users.total}</p>
            </div>
          </div>
          <div style={{
            padding: "1rem",
            background: "#fce4ec",
            borderRadius: "4px",
            textAlign: "center",
            marginTop: "1rem"
          }}>
            <p style={{ fontSize: "0.9rem", color: "#666" }}>Avg Response Time</p>
            <p style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{stats.avgResponseTime}</p>
          </div>
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <h3>All Emergencies ({emergencies.length})</h3>
          <div style={{ maxHeight: "400px", overflowY: "auto" }}>
            {emergencies.length === 0 ? (
              <p>No emergencies</p>
            ) : (
              <div>
                {emergencies.map(e => (
                  <button
                    key={e._id}
                    type="button"
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #ddd",
                      marginBottom: "0.5rem",
                      borderRadius: "4px",
                      cursor: "pointer",
                      textAlign: "left",
                      background: selectedEmergency?._id === e._id ? "#e3f2fd" : "white"
                    }}
                    onClick={() => setSelectedEmergency(e)}
                  >
                    <p><strong>{e.type.toUpperCase()}</strong></p>
                    <p style={{ fontSize: "0.8rem", color: "#666" }}>{e.address}</p>
                    <p style={{ fontSize: "0.8rem" }}>
                      Status: <span style={{
                        color: { active: '#ff9800', completed: '#4caf50' }[e.status] || '#999'
                      }}>
                        {e.status}
                      </span>
                    </p>
                    <p style={{ fontSize: "0.8rem" }}>Responders: {e.responders?.length || 0}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <div style={{
          marginTop: "1rem",
          padding: "1rem",
          background: "#f5f5f5",
          borderRadius: "4px",
          textAlign: "center"
        }}>
          <p style={{ color: "#666", fontSize: "0.9rem" }}>Admin: {user?.name}</p>
        </div>
      </div>

      {/* Emergency Details Modal */}
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
            <p><strong>Address:</strong> {selectedEmergency.address}</p>
            <p><strong>Status:</strong> {selectedEmergency.status}</p>
            <p><strong>Created:</strong> {new Date(selectedEmergency.createdAt).toLocaleString()}</p>
            <p><strong>Responders Assigned:</strong> {selectedEmergency.responders?.length || 0}</p>
            {selectedEmergency.responders && selectedEmergency.responders.length > 0 && (
              <div>
                <p><strong>Responder Details:</strong></p>
                {selectedEmergency.responders.map((r) => (
                    <p key={r._id} style={{ fontSize: "0.9rem", marginLeft: "1rem" }}>
                    - {r.userId?.name || r.userId} (Status: {r.status})
                  </p>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setSelectedEmergency(null)}
              style={{
                marginTop: "1rem",
                padding: "0.75rem 1rem",
                background: "#666",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                width: "100%"
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
