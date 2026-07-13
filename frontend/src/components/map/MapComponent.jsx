import { MapContainer, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icon issue
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

export default function MapComponent({ 
  center = [27.7172, 85.3240], // Kathmandu center
  zoom = 13, 
  minZoom = 12,
  maxZoom = 18,
  width = '100%',
  height = '100%',
  children 
}) {
  // Kathmandu bounds to prevent zooming out
  const kathmandBounds = [
    [27.65, 85.2],    // Southwest corner
    [27.79, 85.45]    // Northeast corner
  ]

  return (
    <MapContainer 
      center={center} 
      zoom={zoom}
      minZoom={minZoom}
      maxZoom={maxZoom}
      maxBounds={kathmandBounds}
      maxBoundsViscosity={1.0}
      style={{ width, height }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {children}
    </MapContainer>
  )
}
