import { useState } from "react"
import { Marker, useMapEvents } from "react-leaflet"
import { AlertTriangle, Cross, Flame, LocateFixed, Shield, Waves, X } from "lucide-react"
import toast from "react-hot-toast"
import { createEmergency } from "../../api/emergency.js"
import MapComponent from "../map/MapComponent.jsx"

const emergencyTypes = [
  { value: "fire", label: "Fire", color: "#ef4444", icon: Flame },
  { value: "medical", label: "Medical", color: "#22c55e", icon: Cross },
  { value: "security", label: "Security", color: "#0ea5e9", icon: Shield },
  { value: "natural_disaster", label: "Natural Disaster", color: "#f97316", icon: Waves },
  { value: "other", label: "Other", color: "#a855f7", icon: AlertTriangle },
]

function DraggableLocationMarker({ position, onChange }) {
  useMapEvents({
    click(event) {
      onChange(event.latlng.lat, event.latlng.lng)
    },
  })

  return (
    <Marker
      position={position}
      draggable
      eventHandlers={{
        dragend(event) {
          const marker = event.target
          const nextPosition = marker.getLatLng()
          onChange(nextPosition.lat, nextPosition.lng)
        },
      }}
    />
  )
}

export default function EmergencyForm({ onSuccess, onClose }) {
  const [form, setForm] = useState({
    type: "fire",
    description: "",
    address: "",
    longitude: 85.324,
    latitude: 27.7172,
    radius: 5000,
  })
  const [loading, setLoading] = useState(false)

  const markerPosition = [Number(form.latitude), Number(form.longitude)]

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((previous) => ({
      ...previous,
      [name]: name === "radius" ? Number(value) : value,
    }))
  }

  const updateLocation = (latitude, longitude) => {
    setForm((previous) => ({
      ...previous,
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
    }))
  }

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by this browser")
      return
    }

    const toastId = toast.loading("Getting your current location...")
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        updateLocation(latitude, longitude)
        toast.success("Location detected", { id: toastId })
      },
      (error) => {
        console.error("Geolocation error:", error)
        toast.error("Could not get your location", { id: toastId })
      }
    )
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    setLoading(true)
    try {
      const response = await createEmergency({
        type: form.type,
        description: form.description.trim(),
        address: form.address.trim(),
        longitude: Number(form.longitude),
        latitude: Number(form.latitude),
        radius: Number(form.radius),
      })

      toast.success("Emergency reported successfully")
      onSuccess?.(response.data.emergency)
      onClose?.()
    } catch (error) {
      console.error("Error creating emergency:", error)
      toast.error(error.response?.data?.message || "Failed to report emergency")
    } finally {
      setLoading(false)
    }
  }

  return (
<<<<<<< HEAD
    <div className="fixed inset-0 z-[2000] overflow-y-auto bg-black/60 px-4 py-6">
      <div className="mx-auto flex min-h-full w-full max-w-7xl items-center justify-center">
        <section className="relative w-full rounded-lg bg-white p-4 shadow-2xl md:p-6">
          {onClose && (
=======
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.7)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2000
    }}>
      <div style={{
        background: "white",
        padding: "2rem",
        borderRadius: "8px",
        maxWidth: "500px",
        width: "90%",
        maxHeight: "90vh",
        overflowY: "auto"
      }}>
        <h2>Create Emergency</h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="type">Emergency Type *</label>
            <select
              id="type"
              name="type"
              value={form.type}
              onChange={handleChange}
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "4px",
                border: "1px solid #ccc",
                marginTop: "0.25rem"
              }}
            >
              <option value="fire">Fire 🔥</option>
              <option value="medical">Medical 🏥</option>
              <option value="security">Security 🛡️</option>
              <option value="natural_disaster">Natural Disaster 🌪️</option>
              <option value="other">Other 🆘</option>
            </select>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="description">Description *</label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              required
              placeholder="Describe the emergency situation..."
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "4px",
                border: "1px solid #ccc",
                marginTop: "0.25rem",
                minHeight: "100px",
                fontFamily: "inherit"
              }}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="address">Address/Location</label>
            <input
              id="address"
              name="address"
              type="text"
              value={form.address}
              onChange={handleChange}
              placeholder="e.g., Main Street, Downtown"
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "4px",
                border: "1px solid #ccc",
                marginTop: "0.25rem",
                boxSizing: "border-box"
              }}
            />
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
            marginBottom: "1rem"
          }}>
            <div>
              <label htmlFor="latitude">Latitude</label>
              <input
                id="latitude"
                name="latitude"
                type="number"
                step="0.0001"
                value={form.latitude}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  marginTop: "0.25rem",
                  boxSizing: "border-box"
                }}
              />
            </div>
            <div>
              <label htmlFor="longitude">Longitude</label>
              <input
                id="longitude"
                name="longitude"
                type="number"
                step="0.0001"
                value={form.longitude}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  marginTop: "0.25rem",
                  boxSizing: "border-box"
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="radius">Search Radius (meters): {form.radius}m</label>
            <input
              id="radius"
              name="radius"
              type="range"
              min="1000"
              max="50000"
              step="1000"
              value={form.radius}
              onChange={handleChange}
              style={{
                width: "100%",
                marginTop: "0.25rem"
              }}
            />
            <small style={{ color: "#666" }}>Responders within this radius will be notified</small>
          </div>

          <button
            type="button"
            onClick={handleGetLocation}
            style={{
              width: "100%",
              padding: "0.75rem",
              background: "#2196f3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              marginBottom: "1rem",
              fontWeight: "bold"
            }}
          >
            📍 Use My Location
          </button>

          <div style={{ display: "flex", gap: "1rem" }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: "0.75rem",
                background: "#ff4444",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? "Creating..." : "🚨 Create Emergency"}
            </button>
>>>>>>> origin/main
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
              aria-label="Close emergency form"
            >
              <X className="h-5 w-5" />
            </button>
          )}

          <h1 className="mb-6 pr-12 text-2xl font-bold text-gray-950 md:text-3xl">
            Report Emergency
          </h1>

          <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
            <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-4 py-4">
                <h2 className="text-sm font-semibold text-gray-950">Select Location</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Drag the marker or click the map to set the exact emergency location.
                </p>
              </div>

              <div className="h-[320px] overflow-hidden md:h-[430px]">
                <MapComponent center={markerPosition} zoom={15}>
                  <DraggableLocationMarker position={markerPosition} onChange={updateLocation} />
                </MapComponent>
              </div>

              <div className="flex flex-col gap-3 border-t border-gray-200 p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <label htmlFor="address" className="text-sm font-semibold text-gray-950">
                    Address
                  </label>
                  <input
                    id="address"
                    name="address"
                    type="text"
                    value={form.address}
                    onChange={handleChange}
                    placeholder="Enter nearby street, landmark, or area"
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleGetLocation}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  <LocateFixed className="h-4 w-4" />
                  Locate Me
                </button>
              </div>

              <div className="grid gap-3 border-t border-gray-100 p-4 text-sm text-gray-600 md:grid-cols-3">
                <p>
                  <span className="font-semibold text-gray-950">Latitude:</span> {form.latitude}
                </p>
                <p>
                  <span className="font-semibold text-gray-950">Longitude:</span> {form.longitude}
                </p>
                <p>
                  <span className="font-semibold text-gray-950">Radius:</span> {form.radius}m
                </p>
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:p-5">
              <h2 className="mb-3 text-sm font-semibold text-gray-950">Emergency Type</h2>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {emergencyTypes.map((item) => {
                  const Icon = item.icon
                  const selected = form.type === item.value

                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setForm((previous) => ({ ...previous, type: item.value }))}
                      className={`flex items-center gap-3 rounded-md border px-4 py-3 text-left transition ${
                        selected
                          ? "border-gray-900 bg-gray-50 shadow-sm"
                          : "border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50"
                      }`}
                    >
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${item.color}18`, color: item.color }}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-medium text-gray-900">{item.label}</span>
                    </button>
                  )
                })}
              </div>

              <label htmlFor="description" className="mt-5 block text-sm font-semibold text-gray-950">
                Description <span className="text-gray-500 font-normal text-xs">(Optional)</span>
              </label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Describe the emergency situation (optional)..."
                className="mt-2 min-h-32 w-full resize-y rounded-md border border-gray-300 px-3 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />

              <label htmlFor="radius" className="mt-5 block text-sm font-semibold text-gray-950">
                Responder Search Radius
              </label>
              <input
                id="radius"
                name="radius"
                type="range"
                min="1000"
                max="50000"
                step="1000"
                value={form.radius}
                onChange={handleChange}
                className="mt-3 w-full accent-red-600"
              />
              <p className="mt-1 text-xs text-gray-500">
                Responders within {(form.radius / 1000).toFixed(0)} km will be notified.
              </p>

              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <AlertTriangle className="h-4 w-4" />
                  {loading ? "Reporting..." : "Report Emergency"}
                </button>
              </div>
            </section>
          </form>
        </section>
      </div>
    </div>
  )
}
