import { createContext, useContext, useEffect, useRef, useState } from "react"
import io from "socket.io-client"
import useAuthStore from "../stores/authStore.js"

const SOCKET_URL = "http://localhost:5000"

const SocketContext = createContext(null)

// Exact server-to-client event names from backend/socket/events.js
export const SOCKET_EVENTS = {
  DISPATCH_OFFER: "dispatch:offer",
  RESPONDER_ASSIGNED: "responder:assigned",
  RESPONDER_LOCATION: "responder:location",
  EMERGENCY_STATUS_UPDATE: "emergency:statusUpdate"
}

export function SocketProvider({ children }) {
  const user = useAuthStore((state) => state.user)
  const loading = useAuthStore((state) => state.loading)
  const [socket, setSocket] = useState(null)
  const socketRef = useRef(null)

  useEffect(() => {
    // 1. Gate connection creation until loading is false and user is logged in
    if (loading || !user) {
      if (socketRef.current) {
        console.log("[SocketProvider] Logging out or unauthenticated, disconnecting socket...")
        socketRef.current.disconnect()
        socketRef.current = null
        setSocket(null)
      }
      return
    }

    const token = useAuthStore.getState().token
    if (!token) {
      console.warn("[SocketProvider] Authenticated user exists but no token is found in store.")
      return
    }

    // 2. Initialize exactly one Socket.IO connection
    console.log("[SocketProvider] Connecting to socket server...")
    const newSocket = io(SOCKET_URL, {
      auth: {
        token
      },
      reconnection: true,
      reconnectionAttempts: 5
    })

    socketRef.current = newSocket
    setSocket(newSocket)

    newSocket.on("connect", () => {
      console.log("[SocketProvider] Socket connected and authenticated:", newSocket.id)
    })

    newSocket.on("disconnect", (reason) => {
      console.log("[SocketProvider] Socket disconnected:", reason)
    })

    newSocket.on("connect_error", (error) => {
      console.error("[SocketProvider] Socket connection or authentication error:", error.message)
    })

    // 3. Clean up on unmount or user change
    return () => {
      if (newSocket) {
        console.log("[SocketProvider] Cleaning up socket connection...")
        newSocket.disconnect()
      }
      socketRef.current = null
      setSocket(null)
    }
  }, [user, loading])

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocketInstance() {
  return useContext(SocketContext)
}
