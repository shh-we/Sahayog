import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import logo from "../../assets/logo.svg"
import useAuthStore from "../../stores/authStore.js"

import MapComponent from "../../components/map/MapComponent.jsx"
import EmergencyMarker from "../../components/map/EmergencyMarker.jsx"
import ResponderMarker from "../../components/map/ResponderMarker.jsx"
import ActiveRouteLayer from "../../components/map/ActiveRouteLayer.jsx"
import { useSocketInstance, SOCKET_EVENTS } from "../../sockets/socketContext.js"
import { useEmergencyRoom } from "../../hooks/useEmergencyRoom.js"
import { getEmergencyById } from "../../api/emergency.js"
import {
  toggleAvailability,
  updateLocation,
  getMyAssignments,
  acceptDispatchAttempt,
  declineDispatchAttempt,
  updateResponseStatus
} from "../../api/responder.js"
import { HOME_ROUTE } from "../../constants/routes.js"
import { getDrivingRoute } from "../../api/routing.js"
import toast from "react-hot-toast"
import {
  AlertCircle,
  History,
  User,
  LogOut,
  Menu,
  X,
  MapPin,
  Activity,
  CheckCircle,
  CheckCircle2,
  ShieldCheck,
  Mail,
  Phone,
  Calendar,
  Flame,
  HeartPulse,
  Shield,
  AlertTriangle,
  Navigation,
  Clock,
  Loader2,
  RefreshCw,
  Compass
} from "lucide-react"

export default function ResponderDashboard() {
  const user = useAuthStore((state) => state.user)
  const logoutUser = useAuthStore((state) => state.logoutUser)
  const navigate = useNavigate()

  // Navigation tab state
  const [activeTab, setActiveTab] = useState("alerts") // alerts | history | profile

  const [isAvailable, setIsAvailable] = useState(user?.isAvailable || false)
  const [responderLocation, setResponderLocation] = useState([27.7172, 85.3240]) // Kathmandu
  const [assignments, setAssignments] = useState([])
  const [historyAssignments, setHistoryAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  
  // Throttled animated location for smooth visual updates on dashboard text overlays
  const [throttledLocation, setThrottledLocation] = useState(null)

  // Dispatch Offer States
  const [currentOffer, setCurrentOffer] = useState(null)
  const [offerCountdown, setOfferCountdown] = useState(25)
  const [offerDetails, setOfferDetails] = useState(null)
  const [offerDetailsLoading, setOfferDetailsLoading] = useState(false)

  // API Action progress states
  const [isSubmittingAction, setIsSubmittingAction] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)

  // Helper to store/retrieve ETA metadata in localStorage to survive refreshes
  const getStoredEta = (emergencyId) => {
    try {
      const data = localStorage.getItem(`eta_${emergencyId}`)
      if (data) return JSON.parse(data)
    } catch (e) {
      console.error(e)
    }
    return null
  }

  const setStoredEta = (emergencyId, etaData) => {
    try {
      localStorage.setItem(`eta_${emergencyId}`, JSON.stringify(etaData))
    } catch (e) {
      console.error(e)
    }
  }

  // Load assignments and initial responder coordinates on mount
  const fetchData = async () => {
    try {
      setLoading(true)
      setErrorMessage(null)

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords
            setResponderLocation([latitude, longitude])

            try {
              await updateLocation({ latitude, longitude })
            } catch (err) {
              console.error("Error updating location in backend:", err)
            }

            await fetchActiveAssignments()
          },
          (error) => {
            console.warn("Geolocation error on mount:", error)
            fetchActiveAssignments()
          }
        )
      } else {
        await fetchActiveAssignments()
      }
    } catch (err) {
      console.error("Error in fetchData:", err)
      setErrorMessage("Failed to initialize system. Please try again.")
      setLoading(false)
    }
  }

  const fetchActiveAssignments = async () => {
    try {
      const res = await getMyAssignments(false)
      setAssignments(res.data.emergencies || [])
    } catch (err) {
      console.error("Error fetching active assignments:", err)
      setErrorMessage("Failed to load assignments. Please check your connection.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch History whenever the History tab is opened
  const fetchHistory = async () => {
    try {
      setHistoryLoading(true)
      const res = await getMyAssignments(true)
      setHistoryAssignments(res.data.emergencies || [])
    } catch (err) {
      console.error("Error fetching history:", err)
      toast.error("Failed to load assignment history")
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory()
    }
  }, [activeTab])

  // Socket.IO real-time updates
  const socket = useSocketInstance()
  const activeAssignment = assignments[0] || null

  useEmergencyRoom(activeAssignment?._id || null)

  useEffect(() => {
    if (!socket || !user?.id) return

    // Received on the responder's private user room (user:<responderId>).
    socket.on(SOCKET_EVENTS.DISPATCH_OFFER, async (offer) => {
      console.log("[ResponderDashboard] Received dispatch offer:", offer)
      if (!useAuthStore.getState().user?.isAvailable) {
        console.log("[ResponderDashboard] Ignored offer because responder is offline")
        return
      }
      setCurrentOffer(offer)
      setOfferCountdown(25)
      setOfferDetails(null)
      setOfferDetailsLoading(true)

      try {
        const res = await getEmergencyById(offer.emergencyId)
        if (res.data && res.data.success) {
          setOfferDetails(res.data.emergency)
        } else if (res.data) {
          setOfferDetails(res.data)
        }
      } catch (err) {
        console.error("[ResponderDashboard] Failed to fetch offer details:", err)
      } finally {
        setOfferDetailsLoading(false)
      }
    })

    // Received via the emergency room joined by useEmergencyRoom above.
    socket.on(SOCKET_EVENTS.RESPONDER_ASSIGNED, (data) => {
      console.log("[ResponderDashboard] Socket responder:assigned:", data)
      fetchActiveAssignments()
    })

    socket.on(SOCKET_EVENTS.EMERGENCY_STATUS_UPDATE, (data) => {
      console.log("[ResponderDashboard] Socket emergency:statusUpdate:", data)
      fetchActiveAssignments()
    })

    return () => {
      socket.off(SOCKET_EVENTS.DISPATCH_OFFER)
      socket.off(SOCKET_EVENTS.RESPONDER_ASSIGNED)
      socket.off(SOCKET_EVENTS.EMERGENCY_STATUS_UPDATE)
    }
  }, [socket, user?.id])

  // Countdown timer for dispatch offer
  useEffect(() => {
    if (!currentOffer) return

    const interval = setInterval(() => {
      setOfferCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          toast.error("Dispatch offer has expired")
          setCurrentOffer(null)
          setOfferDetails(null)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [currentOffer])

  // Live Location Share: updates coordinates in database while en_route
  useEffect(() => {
    if (!activeAssignment || activeAssignment.responderStatus !== 'en_route') return

    console.log("[ResponderDashboard] Starting live location share...")
    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        setResponderLocation([latitude, longitude])
        try {
          await updateLocation({ latitude, longitude })
          console.log("[ResponderDashboard] Live location updated:", { latitude, longitude })
        } catch (err) {
          console.error("[ResponderDashboard] Failed to send location update:", err)
        }
      },
      (err) => console.error("[ResponderDashboard] Geolocation watch error:", err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    return () => {
      console.log("[ResponderDashboard] Stopping live location share...")
      navigator.geolocation.clearWatch(watchId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAssignment?.responderStatus, activeAssignment?._id])

  // Animation and movement are now handled directly inside ActiveRouteLayer to keep UI smooth

  const handleToggleAvailability = async () => {
    try {
      const res = await toggleAvailability()
      const updatedAvailable = res.data.isAvailable
      setIsAvailable(updatedAvailable)
      
      // Sync availability into Zustand authStore
      useAuthStore.setState({
        user: {
          ...user,
          isAvailable: updatedAvailable
        }
      })

      toast.success(updatedAvailable ? "You are now available for dispatch" : "Availability toggled off")
    } catch (error) {
      console.error("Error updating availability:", error)
      toast.error("Failed to update availability")
    }
  }

  const handleAcceptOffer = async (attemptId, offerData) => {
    try {
      setIsSubmittingAction(true)
      await acceptDispatchAttempt(attemptId)
      
      if (offerData) {
        setStoredEta(offerData.emergencyId, {
          etaSeconds: offerData.etaSeconds,
          etaEstimated: offerData.etaEstimated
        })
      }

      toast.success("Offer accepted! You are now assigned to this incident.")
      setCurrentOffer(null)
      setOfferDetails(null)
      await fetchActiveAssignments()
    } catch (err) {
      console.error("[ResponderDashboard] Error accepting offer:", err)
      const errorMsg = err.response?.data?.message || err.response?.data?.error || "Failed to accept dispatch offer"
      toast.error(errorMsg)
      setCurrentOffer(null)
      setOfferDetails(null)
      await fetchActiveAssignments()
    } finally {
      setIsSubmittingAction(false)
    }
  }

  const handleDeclineOffer = async (attemptId) => {
    try {
      setIsSubmittingAction(true)
      await declineDispatchAttempt(attemptId)
      toast.success("Offer declined")
    } catch (err) {
      console.error("[ResponderDashboard] Error declining offer:", err)
      toast.error("Error declining offer")
    } finally {
      setCurrentOffer(null)
      setOfferDetails(null)
      setIsSubmittingAction(false)
    }
  }

  const handleUpdateStatus = async (emergencyId, nextStatus) => {
    try {
      setIsSubmittingAction(true)
      let journeyData = {}
      if (nextStatus === 'en_route') {
        let routeCoords = []
        try {
          const [rLat, rLon] = responderLocation
          const targetAssignment = assignments.find(a => a._id === emergencyId) || activeAssignment
          const eCoords = targetAssignment?.reporterLocation?.coordinates
          if (!eCoords || eCoords.length < 2) {
            throw new Error("Target assignment coordinates not found")
          }
          const [eLon, eLat] = eCoords
          const res = await getDrivingRoute({
            fromLat: rLat,
            fromLng: rLon,
            toLat: eLat,
            toLng: eLon
          })
          if (res.data && res.data.success && res.data.geometry) {
            routeCoords = res.data.geometry.map(coord => [coord[1], coord[0]])
          }
        } catch (err) {
          console.error("Failed to fetch route for sync:", err)
          toast.error("Road route is temporarily unavailable; location sharing continues.")
        }
        journeyData = {
          routeCoordinates: routeCoords,
          journeyStartedAt: new Date().toISOString()
        }
      }

      await updateResponseStatus(emergencyId, nextStatus, journeyData)
      toast.success(`Status updated to ${nextStatus.replace('_', ' ')}!`)
      await fetchActiveAssignments()
    } catch (err) {
      console.error("[ResponderDashboard] Error updating status:", err)
      toast.error(err.response?.data?.message || err.response?.data?.error || "Failed to update status")
    } finally {
      setIsSubmittingAction(false)
    }
  }

  const handleLogout = () => {
    logoutUser()
    navigate(HOME_ROUTE)
  }

  // Helper for emergency styles by category
  const getEmergencyStyles = (type) => {
    switch (type) {
      case 'fire':
        return {
          bg: 'bg-red-50',
          text: 'text-red-600',
          border: 'border-red-100',
          icon: Flame,
          label: 'Fire Emergency'
        };
      case 'medical':
        return {
          bg: 'bg-blue-50',
          text: 'text-blue-600',
          border: 'border-blue-100',
          icon: HeartPulse,
          label: 'Medical Emergency'
        };
      case 'security':
        return {
          bg: 'bg-purple-50',
          text: 'text-purple-600',
          border: 'border-purple-100',
          icon: Shield,
          label: 'Security Threat'
        };
      case 'natural_disaster':
        return {
          bg: 'bg-orange-50',
          text: 'text-orange-600',
          border: 'border-orange-100',
          icon: AlertTriangle,
          label: 'Natural Disaster'
        };
      default:
        return {
          bg: 'bg-gray-50',
          text: 'text-gray-600',
          border: 'border-gray-100',
          icon: Activity,
          label: 'Emergency Request'
        };
    }
  }

  const hasNotification = assignments.length > 0

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 text-gray-500 font-sans">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <span className="text-sm font-medium">Initializing Responder System...</span>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 text-gray-600 font-sans p-6">
        <AlertTriangle className="text-red-500 w-12 h-12 mb-3 animate-bounce" />
        <h2 className="text-lg font-bold text-gray-900 mb-1">System Error</h2>
        <p className="text-sm text-gray-500 text-center max-w-sm mb-4">{errorMessage}</p>
        <button 
          onClick={fetchData}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer shadow hover:shadow-md"
        >
          <RefreshCw size={15} />
          <span>Try Again</span>
        </button>
      </div>
    )
  }

  // Active Assignment View Render Logic
  const renderActiveAssignment = () => {
    if (!activeAssignment) return null

    const typeInfo = getEmergencyStyles(activeAssignment.type)
    const TypeIcon = typeInfo.icon
    const statusVal = activeAssignment.responderStatus // en_route | on_scene | completed or null
    
    const storedEta = getStoredEta(activeAssignment._id)
    const etaText = storedEta 
      ? `${Math.round(storedEta.etaSeconds / 60)} mins`
      : "5 mins"
    const isEtaEstimated = storedEta ? storedEta.etaEstimated : true

    const currentStep = statusVal === "completed" ? 3 : statusVal === "on_scene" ? 2 : statusVal === "en_route" ? 1 : 0
    
    // Percent values for visual timeline
    const getProgressPercentage = (sv) => {
      switch (sv) {
        case "en_route": return 33;
        case "on_scene": return 66;
        case "completed": return 100;
        default: return 0;
      }
    }
    const progressPercent = getProgressPercentage(statusVal)

    const displayResponderLoc = (statusVal === "en_route" && throttledLocation) ? throttledLocation : responderLocation

    // Center coordinates
    const emergencyCoords = activeAssignment.reporterLocation?.coordinates
      ? [activeAssignment.reporterLocation.coordinates[1], activeAssignment.reporterLocation.coordinates[0]]
      : null
    const mapCenter = emergencyCoords || displayResponderLoc

    const getDistanceKm = (loc1, loc2) => {
      if (!loc1 || !loc2) return null
      const [lat1, lon1] = loc1
      const [lat2, lon2] = loc2
      const R = 6371
      const dLat = ((lat2 - lat1) * Math.PI) / 180
      const dLon = ((lon2 - lon1) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2
      return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1)
    }
    const distKm = getDistanceKm(displayResponderLoc, emergencyCoords)

    return (
      <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">
        {/* Left Side: Control Panel */}
        <div className="w-full lg:w-1/2 flex flex-col h-full overflow-y-auto bg-white border-r border-gray-100 p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                Active Rescue Operation
              </span>
              <h2 className="text-xl font-bold text-gray-900 mt-1">Incident Details</h2>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Reported At</p>
              <p className="text-sm font-semibold text-gray-600">
                {new Date(activeAssignment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          {/* Stepper Progress */}
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 space-y-5">
            <h3 className="text-sm font-bold text-gray-700">Response Progress</h3>
            
            <div className="relative flex items-center justify-between mt-2 px-2">
              <div className="absolute top-4 left-4 right-4 h-1 bg-gray-200 -translate-y-1/2 z-0" />
              <div 
                className="absolute top-4 left-4 h-1 bg-blue-600 -translate-y-1/2 z-0 transition-all duration-500"
                style={{ width: `calc(${progressPercent}% - ${progressPercent === 100 ? '32px' : '0px'})` }}
              />

              {[
                { label: "Assigned", val: 0 },
                { label: "En Route", val: 1 },
                { label: "On Scene", val: 2 },
                { label: "Completed", val: 3 }
              ].map((step, idx) => {
                const isCompleted = currentStep >= step.val
                const isActive = currentStep === step.val

                return (
                  <div key={idx} className="flex flex-col items-center z-10">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
                      isCompleted 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                        : isActive 
                        ? 'bg-white border-blue-600 text-blue-600' 
                        : 'bg-gray-100 border-gray-200 text-gray-400'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle size={16} strokeWidth={3} />
                      ) : (
                        <span className="text-xs font-bold">{step.val + 1}</span>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold mt-2 tracking-wide uppercase ${
                      isCompleted ? 'text-blue-700' : 'text-gray-400'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="border-t border-gray-100 pt-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Navigation className={`w-5 h-5 ${statusVal === 'en_route' ? 'animate-bounce' : ''}`} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400">Current Phase</p>
                <p className="text-sm font-bold text-gray-800">
                  {statusVal === "completed" || activeAssignment.status === "resolved" ? "Rescue Completed" : 
                   statusVal === "on_scene" ? "Assisting On-Scene" : 
                   statusVal === "en_route" ? "En Route to Incident" : 
                   "Awaiting Departure"}
                </p>
              </div>
            </div>
          </div>

          {/* Emergency Information */}
          <div className="space-y-4">
            <div className="border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${typeInfo.bg} ${typeInfo.text}`}>
                    <TypeIcon size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 leading-tight">{typeInfo.label}</h3>
                    <p className="text-xs text-gray-400 capitalize">Radius Tier: {activeAssignment.currentDispatchRadiusKm || 5} km</p>
                  </div>
                </div>
                <div className="bg-slate-100 text-slate-800 rounded-lg px-2.5 py-1 text-xs font-bold tracking-wide flex items-center gap-1.5 shrink-0">
                  <Clock size={13} />
                  <span>{etaText} {isEtaEstimated ? '(Estimated)' : ''}</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Description</p>
                <p className="text-sm font-medium text-gray-800 leading-relaxed italic bg-slate-50 border-l-4 border-blue-500 p-3 rounded-r-xl">
                  "{activeAssignment.description || 'No description provided.'}"
                </p>
              </div>

              {activeAssignment.address && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Reported Address</p>
                  <div className="flex items-start gap-2 text-sm text-gray-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <MapPin size={16} className="text-slate-400 shrink-0 mt-0.5" />
                    <span>{activeAssignment.address}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Reporter details */}
            {activeAssignment.reporterId && (
              <div className="border border-gray-200 rounded-2xl p-5 space-y-3 shadow-sm bg-white">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Reporter Details</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 font-bold text-sm flex items-center justify-center uppercase">
                      {activeAssignment.reporterId.name ? activeAssignment.reporterId.name.substring(0, 2) : "UR"}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{activeAssignment.reporterId.name || "N/A"}</p>
                      <p className="text-xs text-gray-400">Emergency Reporter</p>
                    </div>
                  </div>
                  {activeAssignment.reporterId.phone && (
                    <a 
                      href={`tel:${activeAssignment.reporterId.phone}`}
                      className="inline-flex items-center justify-center gap-1.5 py-2 px-4 border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors rounded-xl text-xs font-bold cursor-pointer"
                    >
                      <Phone size={14} />
                      <span>Call Reporter</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action button */}
          <div className="pt-2">
            {statusVal === null ? (
              <button
                onClick={() => handleUpdateStatus(activeAssignment._id, 'en_route')}
                disabled={isSubmittingAction}
                className="w-full py-4 px-6 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-base font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:bg-gray-305 disabled:shadow-none"
              >
                {isSubmittingAction ? (
                  <Loader2 className="animate-spin w-5 h-5" />
                ) : (
                  <>
                    <Navigation className="w-5 h-5 transform rotate-45" />
                    <span>Start Journey (En Route)</span>
                  </>
                )}
              </button>
            ) : statusVal === "en_route" ? (
              <button
                onClick={() => handleUpdateStatus(activeAssignment._id, 'on_scene')}
                disabled={isSubmittingAction}
                className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-base font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:bg-gray-305 disabled:shadow-none"
              >
                {isSubmittingAction ? (
                  <Loader2 className="animate-spin w-5 h-5" />
                ) : (
                  <>
                    <MapPin className="w-5 h-5" />
                    <span>Arrived on Scene</span>
                  </>
                )}
              </button>
            ) : statusVal === "on_scene" ? (
              <button
                onClick={() => handleUpdateStatus(activeAssignment._id, 'completed')}
                disabled={isSubmittingAction}
                className="w-full py-4 px-6 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-base font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:bg-gray-305 disabled:shadow-none"
              >
                {isSubmittingAction ? (
                  <Loader2 className="animate-spin w-5 h-5" />
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>Mark Emergency Completed</span>
                  </>
                )}
              </button>
            ) : (
              <div className="w-full text-center py-4 bg-gray-100 text-gray-500 border border-gray-200 rounded-2xl font-bold">
                Rescue Completed & Resolved
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Map */}
        <div className="w-full lg:w-1/2 h-[350px] lg:h-full relative bg-gray-100 z-0">
          <MapComponent center={mapCenter} zoom={14}>
            {statusVal !== "en_route" && (
              <ResponderMarker
                responder={{
                  location: { coordinates: [displayResponderLoc[1], displayResponderLoc[0]] },
                  name: user?.name || "Me",
                  isAvailable: isAvailable
                }}
              />
            )}
            {emergencyCoords && (
              <EmergencyMarker
                emergency={activeAssignment}
                isTarget={statusVal === "en_route"}
              />
            )}
            <ActiveRouteLayer 
              responderCoords={responderLocation} 
              emergencyCoords={emergencyCoords} 
              isEnRoute={statusVal === "en_route"} 
              renderMarker={true}
              responderName={user?.name || "Me"}
              isAvailable={isAvailable}
              onArrival={(finalPos) => {
                setResponderLocation(finalPos);
                setThrottledLocation(null);
                handleUpdateStatus(activeAssignment._id, 'on_scene');
              }}
              onProgress={(coords) => {
                setThrottledLocation(coords);
                // Sync simulated location to database so UserDashboard sees it too!
                updateLocation({ latitude: coords[0], longitude: coords[1] }).catch(err =>
                  console.error("Failed to sync simulated location:", err)
                );
              }}
            />
          </MapComponent>

          {/* Map Overlays */}
          {statusVal === "en_route" ? (
            <div className="absolute top-4 left-4 right-4 bg-blue-600/95 backdrop-blur-md text-white border border-blue-500/30 p-4 rounded-xl z-[400] flex items-center justify-between shadow-xl animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Navigation className="text-white w-5 h-5" />
                </div>
                <span className="font-extrabold text-sm tracking-wide">Responder is en route</span>
              </div>
              <div className="text-sm font-bold bg-white/20 px-3 py-1.5 rounded-lg shadow-sm">
                {distKm} km • {etaText}
              </div>
            </div>
          ) : (
            <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-md text-white border border-white/10 p-3 rounded-xl z-[400] flex items-center justify-between text-xs shadow-lg">
              <div className="flex items-center gap-2">
                <Compass className="text-blue-400 w-4 h-4 animate-spin-slow" />
                <span className="font-semibold">Road route temporarily unavailable</span>
              </div>
              <span className="text-[10px] text-white/50 bg-white/10 px-2 py-0.5 rounded font-mono">
                DIRECT GPS LINE
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Standby View Render Logic
  const standbyView = (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="border border-gray-200 rounded-2xl bg-white p-8 flex flex-col items-center text-center shadow-sm">
        <div className={`w-16 h-16 rounded-full border flex items-center justify-center mb-4 ${
          isAvailable ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'
        }`}>
          {isAvailable ? (
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-100 animate-pulse">
              <Activity className="text-green-600 w-5 h-5" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100">
              <Activity className="text-gray-400 w-5 h-5" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mb-2">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isAvailable ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
          <span className={`text-base font-bold tracking-wide ${isAvailable ? 'text-green-700' : 'text-gray-605'}`}>
            {isAvailable ? "Monitoring Network: Standing By" : "System Offline: Not Receiving Dispatches"}
          </span>
        </div>

        <p className="text-sm text-gray-500 leading-relaxed max-w-sm">
          {isAvailable 
            ? "All systems online. You'll be notified the instant a dispatch is assigned to your unit — no action needed while you wait."
            : "You are currently offline. Toggle your availability in the sidebar to start receiving emergency dispatches."}
        </p>
      </div>
    </div>
  )

  // Inline offer card (rendered inside the alerts tab, above the standby card)
  const renderInlineOfferCard = () => {
    if (!currentOffer) return null


    // Compute distance from responder location to emergency coordinates
    const getDistanceKm = () => {
      const loc = currentOffer.emergencyLocation?.coordinates
      if (!loc) return null
      const [eLon, eLat] = loc
      const [rLat, rLon] = responderLocation
      const R = 6371
      const dLat = ((eLat - rLat) * Math.PI) / 180
      const dLon = ((eLon - rLon) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((rLat * Math.PI) / 180) *
          Math.cos((eLat * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2
      return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1)
    }

    const distKm = getDistanceKm()
    const locationLabel = offerDetails?.address
      ? offerDetails.address.split(',').slice(-2).join(',').trim()
      : currentOffer.emergencyLocation
      ? `${currentOffer.emergencyLocation.coordinates?.[1]?.toFixed(3) ?? '—'}, ${currentOffer.emergencyLocation.coordinates?.[0]?.toFixed(3) ?? '—'}`
      : 'Unknown'

    return (
      <div className="max-w-2xl mx-auto space-y-3 mb-4">
        {/* Amber warning banner */}
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-amber-800 text-sm font-medium">
          <AlertTriangle size={16} className="text-amber-500 shrink-0" />
          <span>Accept in <span className="font-black">{offerCountdown}s</span> or it will go to another responder</span>
        </div>

        {/* Main offer card */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Card header */}
          <div className="bg-red-50 border-b border-red-100 px-5 py-4 flex items-center gap-3">
            <AlertCircle className="text-red-500 shrink-0" size={22} />
            <h3 className="text-base font-extrabold text-red-700 tracking-tight">Immediate Dispatch Assigned</h3>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
            <div className="p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Incident Type</p>
              <p className="text-sm font-bold text-gray-900 capitalize">
                {currentOffer.emergencyType?.replace('_', ' ') ?? '—'}
              </p>
            </div>
            <div className="p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Distance</p>
              <p className="text-sm font-bold text-gray-900">
                {distKm ? `${distKm} km` : '—'}
              </p>
            </div>
            <div className="p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Location</p>
              <p className="text-sm font-bold text-gray-900 truncate" title={locationLabel}>
                {offerDetailsLoading ? (
                  <span className="inline-flex items-center gap-1 text-gray-400">
                    <Loader2 className="animate-spin w-3 h-3" /> Loading...
                  </span>
                ) : locationLabel}
              </p>
            </div>
          </div>

          {/* ETA row */}
          {currentOffer.etaSeconds && (
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 text-xs text-gray-500">
              <Clock size={13} className="text-gray-400" />
              <span>
                ETA: <span className="font-bold text-gray-800">{Math.round(currentOffer.etaSeconds / 60)} min</span>
                {currentOffer.etaEstimated && (
                  <span className="ml-1 text-gray-400">(Estimated)</span>
                )}
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 px-5 py-4">
            <button
              onClick={() => handleDeclineOffer(currentOffer.attemptId)}
              disabled={isSubmittingAction}
              className="flex-1 py-2.5 px-4 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-semibold transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmittingAction ? <Loader2 className="animate-spin w-4 h-4 mx-auto" /> : 'Decline'}
            </button>
            <button
              onClick={() => handleAcceptOffer(currentOffer.attemptId, currentOffer)}
              disabled={isSubmittingAction}
              className="flex-[2] py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow cursor-pointer active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isSubmittingAction ? (
                <Loader2 className="animate-spin w-4 h-4" />
              ) : (
                <><CheckCircle size={15} /> Accept Dispatch</>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans antialiased text-gray-800 overflow-hidden">
      {/* Floating Toggle Button (Mobile Only) */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed top-4 left-4 z-40 p-2 bg-white rounded-xl border border-gray-200 shadow-sm md:hidden cursor-pointer hover:bg-gray-50 text-gray-700 focus:outline-none"
        aria-label="Toggle Menu"
      >
        {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Backdrop (Mobile Only) */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
        />
      )}

      {/* Fixed Left Sidebar */}
      <aside
        className={`
          flex flex-col h-screen bg-white border-r border-gray-200 shrink-0 select-none
          transition-all duration-300
          fixed z-35 top-0 left-0
          md:static md:translate-x-0
          ${isMobileOpen ? "translate-x-0 shadow-xl" : "-translate-x-full md:translate-x-0"}
          w-64
        `}
      >
        {/* Sahayog logo */}
        <div className="flex items-center gap-3 px-5 py-6 border-b border-gray-100 shrink-0">
          <Link to={HOME_ROUTE} className="flex items-center gap-3">
            <span className="h-9 w-10 overflow-hidden shrink-0 flex items-start justify-center">
              <img
                src={logo}
                alt="Sahayog"
                className="h-16 w-16 max-w-none object-contain -mt-1"
              />
            </span>
            <span className="text-2xl font-bold text-[#1f73b7] leading-none">
              Sahayog
            </span>
          </Link>
        </div>

        {/* Responder availability toggle */}
        <div className="p-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-3 py-2">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${isAvailable ? "bg-green-500 animate-pulse" : "bg-gray-300"}`} />
              <span className="text-sm font-medium text-gray-700">
                {isAvailable ? "Available" : "Offline"}
              </span>
            </div>
            <button
              onClick={handleToggleAvailability}
              className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none shrink-0 ${isAvailable ? 'bg-green-500' : 'bg-gray-200'}`}
              aria-label="Toggle availability"
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow-sm ${isAvailable ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        {/* Navigation links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <nav className="space-y-1">
            <button
              onClick={() => {
                setActiveTab("alerts")
                setIsMobileOpen(false)
              }}
              className={`flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-xl transition-all cursor-pointer w-full text-left ${
                activeTab === "alerts"
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <AlertCircle size={18} className="shrink-0" />
              <span>Active Alerts</span>
              {hasNotification && (
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse ml-auto shrink-0" />
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab("history")
                setIsMobileOpen(false)
              }}
              className={`flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-xl transition-all cursor-pointer w-full text-left ${
                activeTab === "history"
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <History size={18} className="shrink-0" />
              <span>My History</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("profile")
                setIsMobileOpen(false)
              }}
              className={`flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-xl transition-all cursor-pointer w-full text-left ${
                activeTab === "profile"
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <User size={18} className="shrink-0" />
              <span>Duty Profile</span>
            </button>
          </nav>
        </div>

        {/* Sticky Bottom Section */}
        <div className="p-3 border-t border-gray-100 flex flex-col gap-2 shrink-0">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-xl text-red-600 hover:bg-red-50 transition-all duration-200 cursor-pointer w-full text-left"
            title="Logout"
          >
            <LogOut size={18} className="shrink-0" />
            <span>Logout</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("profile")
              setIsMobileOpen(false)
            }}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-all duration-200 cursor-pointer w-full text-left"
            title="Duty Profile"
          >
            <div className="w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-600 font-bold flex items-center justify-center text-sm shrink-0 select-none shadow-sm uppercase">
              {user?.name ? user.name.substring(0, 2) : "RP"}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-gray-900 truncate leading-none mb-1">
                {user?.name || "Responder Team"}
              </p>
              <p className="text-xs text-gray-500 truncate leading-none capitalize">
                {user?.department || user?.role || "Active Responder"}
              </p>
            </div>
          </button>
        </div>
      </aside>

      {/* Main content container */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden min-w-0 md:pt-0 pt-14">
        {activeTab === "alerts" && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {activeAssignment ? (
              renderActiveAssignment()
            ) : (
              <>
                {/* Page heading */}
                <div className="px-6 pt-5 pb-4 border-b border-gray-100 bg-white shrink-0 flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight">Active Alerts</h1>
                    <p className="text-sm text-gray-400 mt-0.5">
                      {isAvailable ? "On-duty · Awaiting dispatches" : "Off-duty · Not receiving dispatches"}
                    </p>
                  </div>
                  {currentOffer && (
                    <div className={`flex items-center gap-1.5 font-bold text-sm ${
                      offerCountdown <= 5 ? 'text-red-600 animate-bounce' : 'text-red-500'
                    }`}>
                      <Clock size={16} />
                      <span className="font-mono">{offerCountdown}s</span>
                    </div>
                  )}
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
                  {renderInlineOfferCard()}
                  {standbyView}
                </div>
              </>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="flex-1 p-6 overflow-y-auto max-w-3xl mx-auto w-full">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">My Assignment History</h1>
                <p className="text-sm text-gray-500 mt-1">Review all emergencies you have successfully resolved.</p>
              </div>
              <div className="px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                {historyAssignments.length} Resolved
              </div>
            </div>

            {historyLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                <span className="text-sm">Loading history...</span>
              </div>
            ) : historyAssignments.length === 0 ? (
              <div className="border border-dashed border-gray-200 rounded-2xl bg-white p-12 text-center shadow-sm">
                <History size={40} className="mx-auto text-gray-300 mb-3" />
                <h3 className="text-sm font-semibold text-gray-700">No History Available</h3>
                <p className="text-xs text-gray-500 mt-1.5">Assignments you accept and resolve will appear here.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {historyAssignments.map((item) => (
                  <div key={item._id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-gray-300 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                          item.type === 'fire' ? 'bg-red-50 text-red-600' :
                          item.type === 'medical' ? 'bg-blue-50 text-blue-600' :
                          item.type === 'security' ? 'bg-purple-50 text-purple-600' :
                          'bg-gray-100 text-gray-605'
                        }`}>
                          {item.type}
                        </span>
                        <span className="text-xs text-gray-300">•</span>
                        <span className="text-xs text-gray-500 font-medium">
                          {new Date(item.resolvedAt || item.updatedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold flex items-center gap-1">
                        <CheckCircle size={12} />
                        RESOLVED
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-805 mt-3 leading-relaxed">{item.description}</p>
                    {item.address && (
                      <div className="mt-2.5 text-xs text-gray-400 flex items-center gap-1.5">
                        <MapPin size={12} className="text-gray-300" />
                        <span>{item.address}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Duty Profile Tab */}
        {activeTab === "profile" && (
          <div className="flex-1 flex flex-col overflow-y-auto bg-gray-50/50">
            <div className="max-w-3xl mx-auto w-full p-4 md:p-6 space-y-4 md:space-y-6">
              {/* Profile Card */}
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm relative">
                <div className="h-32 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
                <div className="px-6 pb-6 relative flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  <div className="w-24 h-24 rounded-2xl bg-blue-600 text-white border-4 border-white flex items-center justify-center text-4xl font-bold shadow-sm -mt-12 shrink-0 uppercase">
                    {user?.name ? user.name.charAt(0) : 'N'}
                  </div>
                  <div className="pt-2 text-center sm:text-left w-full">
                    <h2 className="text-2xl font-bold text-gray-900 capitalize">{user?.name || "nayan"}</h2>
                    <div className="flex items-center justify-center sm:justify-start gap-2 mt-1.5 text-xs text-gray-500 font-medium">
                      <span className="inline-flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase font-bold tracking-wide">
                        <ShieldCheck size={12} strokeWidth={2.5} />
                        {user?.role || "responder"}
                      </span>
                      <span>•</span>
                      <span>Active Responder</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-gray-200 rounded-2xl p-5 text-center shadow-sm">
                  <h3 className="text-3xl font-extrabold text-gray-900">{historyAssignments.length}</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1.5">Rescues Completed</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-5 text-center shadow-sm">
                  <h3 className="text-3xl font-extrabold text-gray-900">Active</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1.5">Duty Status</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-5 text-center shadow-sm flex flex-col items-center justify-center h-full">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">
                    Status: {isAvailable ? 'Active' : 'Offline'}
                  </p>
                  <button
                    onClick={handleToggleAvailability}
                    className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none ${isAvailable ? 'bg-green-500' : 'bg-gray-200'}`}
                    aria-label="Toggle availability state"
                  >
                    <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow-sm ${isAvailable ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              {/* Account Details */}
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-5 border-b border-gray-100">
                  <h3 className="text-base font-bold text-gray-900">Contact Information</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Your account details</p>
                </div>

                <div className="divide-y divide-gray-100">
                  <div className="p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                      <Mail size={22} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Email Address</p>
                      <p className="text-sm font-semibold text-gray-900 mt-1">{user?.email || "nayan1@gmail.com"}</p>
                    </div>
                  </div>

                  <div className="p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-50 text-green-500 flex items-center justify-center shrink-0">
                      <Phone size={22} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Phone Number</p>
                      <p className="text-sm font-semibold text-gray-900 mt-1">{user?.phone || "1111111111"}</p>
                    </div>
                  </div>

                  <div className="p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center shrink-0">
                      <Calendar size={22} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-405 uppercase tracking-wider">Registration Date</p>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

    </div>
  )
}
