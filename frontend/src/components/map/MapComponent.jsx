import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icon issue
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Internal component to change map view dynamically when center prop changes
function ChangeMapView({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, map.getZoom(), { animate: true })
    }
  }, [center, map])
  return null
}

export default function MapComponent({ 
  center = [27.7172, 85.3240], // Kathmandu center
  zoom = 13, 
  minZoom = 12,
  maxZoom = 18,
  width = '100%',
  height = '100%',
  children 
}) {
  // Kathmandu Valley bounds (Kathmandu, Lalitpur, and Bhaktapur)
  const valleyBounds = [
    [27.55, 85.15],    // Southwest corner (covers Kirtipur & Southern Lalitpur)
    [27.82, 85.52]     // Northeast corner (covers Bhaktapur & Sankhu)
  ]

  return (
    <MapContainer 
      center={center} 
      zoom={zoom}
      minZoom={minZoom}
      maxZoom={maxZoom}
      maxBounds={valleyBounds}
      maxBoundsViscosity={1.0}
      style={{ width, height }}
    >
      <ChangeMapView center={center} />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {children}
    </MapContainer>
  )
}
