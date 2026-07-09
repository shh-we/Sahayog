import { useState } from "react"
import { createEmergency } from "../../api/emergency.js"
import toast from "react-hot-toast"

export default function EmergencyForm({ onSuccess, onClose }) {
  const [form, setForm] = useState({
    type: "medical",
    description: "",
    address: "",
    longitude: 77.209,
    latitude: 28.6139,
    radius: 5000
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm({
      ...form,
      [name]: name === "radius" ? Number(value) : value
    })
  }

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      toast.loading("Getting your location...")
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setForm({
            ...form,
            latitude,
            longitude
          })
          toast.success("Location detected!")
        },
        (error) => {
          console.error("Geolocation error:", error)
          toast.error("Could not get your location")
        }
      )
    } else {
      toast.error("Geolocation not supported")
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await createEmergency({
        type: form.type,
        description: form.description,
        address: form.address,
        longitude: Number(form.longitude),
        latitude: Number(form.latitude),
        radius: form.radius
      })

      toast.success("Emergency created successfully!")
      onSuccess?.(res.data.emergency)
      onClose?.()
    } catch (err) {
      console.error("Error creating emergency:", err)
      toast.error(err.response?.data?.message || "Failed to create emergency")
    } finally {
      setLoading(false)
    }
  }

  return (
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
            <button
              type="button"
              onClick={onClose}
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
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
