import { useEffect, useRef, useState } from "react"
import io from "socket.io-client"
import useAuthStore from "../stores/authStore.js"
import { SocketContext } from "./socketContext.js"

const SOCKET_URL = "http://localhost:5000"

export function SocketProvider({ children }) {
  const user = useAuthStore((state) => state.user)
  const loading = useAuthStore((state) => state.loading)
  const [socket, setSocket] = useState(null)
  const socketRef = useRef(null)

  useEffect(() => {
    // 1. Gate connection creation until loading is false and user is logged in
    if (loading || !user) {
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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


