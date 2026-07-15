import { createContext, useContext } from "react"

export const SocketContext = createContext(null)

export function useSocketInstance() {
  return useContext(SocketContext)
}

// Exact server-to-client event names from backend/socket/events.js
export const SOCKET_EVENTS = {
  DISPATCH_OFFER: "dispatch:offer",
  RESPONDER_ASSIGNED: "responder:assigned",
  RESPONDER_LOCATION: "responder:location",
  EMERGENCY_STATUS_UPDATE: "emergency:statusUpdate"
}
