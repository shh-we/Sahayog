import { useEffect, useState } from "react"
import { useSocketInstance } from "../sockets/socketContext.js"

export function useEmergencyRoom(emergencyId) {
  const socket = useSocketInstance()
  // Keep the result tied to the room that produced it. This lets the values
  // reset naturally when the selected emergency changes, without setting
  // state synchronously from the effect body.
  const [roomState, setRoomState] = useState({
    emergencyId: null,
    joined: false,
    error: null
  })

  useEffect(() => {
    if (!socket || !emergencyId) {
      return
    }

    let isMounted = true

    const joinRoom = () => {
      socket.emit("emergency:join", emergencyId, (response) => {
        if (!isMounted) return

        if (response && response.ok) {
          setRoomState({ emergencyId, joined: true, error: null })
          console.log(`[useEmergencyRoom] Joined room emergency:${emergencyId}`)
        } else {
          setRoomState({
            emergencyId,
            joined: false,
            error: response?.code || "FORBIDDEN"
          })
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

  return {
    joined: roomState.emergencyId === emergencyId && roomState.joined,
    error: roomState.emergencyId === emergencyId ? roomState.error : null
  }
}
