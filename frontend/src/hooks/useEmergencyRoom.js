import { useEffect, useState } from "react"
import { useSocketInstance } from "../sockets/SocketProvider.jsx"

export function useEmergencyRoom(emergencyId) {
  const socket = useSocketInstance()
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!socket || !emergencyId) {
      setJoined(false)
      setError(null)
      return
    }

    let isMounted = true

    const joinRoom = () => {
      socket.emit("emergency:join", emergencyId, (response) => {
        if (!isMounted) return

        if (response && response.ok) {
          setJoined(true)
          setError(null)
          console.log(`[useEmergencyRoom] Joined room emergency:${emergencyId}`)
        } else {
          setJoined(false)
          setError(response?.code || "FORBIDDEN")
          console.warn(`[useEmergencyRoom] Failed to join room emergency:${emergencyId}`)
        }
      })
    }

    // Re-join after reconnect (also used as the deferred initial join when the
    // socket was not yet connected when this effect ran).
    const handleConnect = () => {
      console.log(`[useEmergencyRoom] Socket connected/reconnected, joining room emergency:${emergencyId}`)
      joinRoom()
    }

    socket.on("connect", handleConnect)

    // If the socket is already connected, join immediately; otherwise wait for
    // the connect event registered above.
    if (socket.connected) {
      joinRoom()
    }

    return () => {
      isMounted = false
      socket.off("connect", handleConnect)
      // Note: Do not emit any leave events — the backend does not define one.
    }
  }, [socket, emergencyId])

  return { joined, error }
}
