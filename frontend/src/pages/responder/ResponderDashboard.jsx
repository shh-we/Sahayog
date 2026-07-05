import { useState, useEffect } from "react"
import useAuthStore from "../../stores/authStore.js"
import MapComponent from "../../components/map/MapComponent.jsx"
import EmergencyMarker from "../../components/map/EmergencyMarker.jsx"
import EmergencyForm from "../../components/emergency/EmergencyForm.jsx"
import StatusUpdateForm from "../../components/responder/StatusUpdateForm.jsx"
import { useSocket, SOCKET_EVENTS } from "../../hooks/useSocket.js"
import { getNearbyEmergencies } from "../../api/emergency.js"
import { toggleAvailability, updateLocation, getMyAssignments, acceptEmergency } from "../../api/responder.js"
import toast from "react-hot-toast"

export default function ResponderDashboard() {
  const user = useAuthStore((state) => state.user)
  const [isAvailable, setIsAvailable] = useState(user?.isAvailable || false)
  const [responderLocation, setResponderLocation] = useState([27.7172, 85.3240]) // Kathmandu
  const [nearbyEmergencies, setNearbyEmergencies] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEmergency, setSelectedEmergency] = useState(null)
  const [acceptingId, setAcceptingId] = useState(null)
  const [showEmergencyForm, setShowEmergencyForm] = useState(false)
  const [showStatusForm, setShowStatusForm] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState(null)

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
  }, [responderLocation])

  // Socket.IO real-time updates
  const socket = useSocket()

  useEffect(() => {
    if (!socket || !user?.id) return

    // Join responder room for targeted notifications
    socket.emit('join', user.id)

    // Listen for new emergencies nearby
    socket.on(SOCKET_EVENTS.NEW_EMERGENCY, (emergency) => {
      setNearbyEmergencies(prev => {
        // Add only if not already in list
        if (!prev.find(e => e._id === emergency._id)) {
          toast.success('🚨 New emergency in your area!')
          return [emergency, ...prev]
        }
        return prev
      })
    })

    // Listen for emergency accepted notifications (to refresh assignments)
    socket.on(SOCKET_EVENTS.EMERGENCY_ACCEPTED, (data) => {
      if (data.responderId === user.id) {
        // Refresh my assignments
        getMyAssignments().then(res => {
          setAssignments(res.data.emergencies || [])
          toast.success('Emergency accepted!')
        })
      }
    })

    // Listen for status updates
    socket.on(SOCKET_EVENTS.STATUS_UPDATE, (data) => {
      if (data.responderId === user.id) {
        // Update local assignment if status changed
        setAssignments(prev =>
          prev.map(a => a._id === data.emergencyId ? { ...a, status: data.status } : a)
        )
      }
    })

    return () => {
      socket.off(SOCKET_EVENTS.NEW_EMERGENCY)
      socket.off(SOCKET_EVENTS.EMERGENCY_ACCEPTED)
      socket.off(SOCKET_EVENTS.STATUS_UPDATE)
    }
  }, [socket, user?.id])

  const fetchNearbyData = async (lat, lng) => {
    try {
      const radius = 15000 // 15km radius
      const params = { latitude: lat, longitude: lng, radius }

      // Fetch nearby emergencies and my assignments
      const [emergenciesRes, assignmentsRes] = await Promise.all([
        getNearbyEmergencies(params),
        getMyAssignments()
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
      toast.success(isAvailable ? "You are now offline" : "You are now online")
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
      const assignmentsRes = await getMyAssignments()
      setAssignments(assignmentsRes.data.emergencies || [])
      
      setSelectedEmergency(null)
    } catch (err) {
      console.error("Error accepting emergency:", err)
      toast.error(err.response?.data?.message || "Failed to accept emergency")
    } finally {
      setAcceptingId(null)
    }
  }

  if (loading) {
    return <div>Loading map...</div>
  }

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Map Container */}
      <div style={{ flex: 1, position: "relative" }}>
        <MapComponent center={responderLocation} zoom={13}>
          {/* Nearby Emergency Markers */}
          {nearbyEmergencies.map(emergency => (
            <EmergencyMarker
              key={emergency._id}
              emergency={emergency}
              onClick={setSelectedEmergency}
            />
          ))}
        </MapComponent>
      </div>

      {/* Sidebar */}
      <div style={{
        width: "320px",
        borderLeft: "1px solid #ccc",
        padding: "1rem",
        overflowY: "auto",
        background: "#fafafa"
      }}>
        <h2>{user?.name}</h2>

        <section style={{ marginBottom: "1.5rem" }}>
          <h3>Status</h3>
          <p>
            <strong>Availability:</strong> {isAvailable ? "🟢 Online" : "🔴 Offline"}
          </p>
          <p><strong>Skills:</strong> {user?.skills?.join(", ") || "None"}</p>
          <button
            type="button"
            onClick={handleToggleAvailability}
            style={{
              width: "100%",
              padding: "0.75rem",
              marginTop: "0.5rem",
              background: isAvailable ? "#ff9800" : "#4caf50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            {isAvailable ? "Go Offline" : "Go Online"}
          </button>
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <h3>Active Assignments ({assignments.length})</h3>
          {assignments.length === 0 ? (
            <p>No active assignments</p>
          ) : (
            <div>
              {assignments.map(a => (
                <div
                  key={a._id}
                  style={{
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    marginBottom: "0.5rem",
                    borderRadius: "4px",
                    background: "#fff3e0"
                  }}
                >
                  <p><strong>{a.type.toUpperCase()}</strong></p>
                  <p style={{ fontSize: "0.8rem" }}>{a.description}</p>
                  <p style={{ fontSize: "0.8rem", color: "#666" }}>Status: {a.status}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAssignment(a)
                      setShowStatusForm(true)
                    }}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      marginTop: "0.5rem",
                      background: "#2196f3",
                      color: "white",
                      border: "none",
                      borderRadius: "3px",
                      cursor: "pointer",
                      fontSize: "0.85rem"
                    }}
                  >
                    Update Status
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <button
            type="button"
            onClick={() => setShowEmergencyForm(true)}
            style={{
              width: "100%",
              padding: "0.75rem",
              background: "#ff6b6b",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
              marginBottom: "1rem"
            }}
          >
            🚨 Report Emergency
          </button>
        </section>

        <section>
          <h3>Nearby Emergencies ({nearbyEmergencies.length})</h3>
          {nearbyEmergencies.length === 0 ? (
            <p>No emergencies nearby</p>
          ) : (
            <div>
              {nearbyEmergencies.map(e => (
                <div key={e._id}>
                  <button
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
                    <p style={{ fontSize: "0.8rem" }}>{e.description}</p>
                  </button>
                  <button
                    type="button"
                    style={{
                      width: "100%",
                      marginBottom: "0.5rem",
                      padding: "0.5rem",
                      background: "#2196f3",
                      color: "white",
                      border: "none",
                      borderRadius: "3px",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      opacity: acceptingId === e._id ? 0.7 : 1
                    }}
                    onClick={() => handleAcceptEmergency(e._id)}
                    disabled={acceptingId === e._id}
                  >
                    {acceptingId === e._id ? "Accepting..." : "Accept"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
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
            <p><strong>Status:</strong> {selectedEmergency.status}</p>
            <p><strong>Location:</strong> {selectedEmergency.address}</p>
            <div style={{ marginTop: "1rem", display: "flex", gap: "1rem" }}>
              <button
                type="button"
                onClick={() => handleAcceptEmergency(selectedEmergency._id)}
                disabled={acceptingId === selectedEmergency._id}
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  background: "#4caf50",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  opacity: acceptingId === selectedEmergency._id ? 0.7 : 1
                }}
              >
                {acceptingId === selectedEmergency._id ? "Accepting..." : "Accept"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedEmergency(null)}
                style={{
                  flex: 1,
                  padding: "0.75rem",
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
            // Refresh assignments after status update
            getMyAssignments().then(res => {
              setAssignments(res.data.emergencies || [])
              toast.success('Status updated!')
            })
          }}
        />
      )}
    </div>
  )
}
