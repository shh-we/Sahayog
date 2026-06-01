import { useEffect, useRef } from 'react'
import io from 'socket.io-client'

const SOCKET_URL = 'http://localhost:5000'

export function useSocket() {
  const socketRef = useRef(null)

  useEffect(() => {
    // Create socket connection
    socketRef.current = io(SOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    })

    socketRef.current.on('connect', () => {
      console.log('Socket connected:', socketRef.current.id)
    })

    socketRef.current.on('disconnect', () => {
      console.log('Socket disconnected')
    })

    socketRef.current.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
    })

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [])

  return socketRef.current
}

// Event listeners for dashboards
export const SOCKET_EVENTS = {
  NEW_EMERGENCY: 'new_emergency',
  EMERGENCY_ACCEPTED: 'emergency_accepted',
  STATUS_UPDATE: 'status_update',
  LOCATION_UPDATE: 'location_update',
  RESPONDER_ONLINE: 'responder_online',
  RESPONDER_OFFLINE: 'responder_offline'
}
