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

// Exposes the Leaflet map instance to a parent ref
function SetMapRef({ mapRef }) {
  const map = useMap()
  useEffect(() => {
    if (mapRef) mapRef.current = map
  }, [map, mapRef])
  return null
}

// Optional internal zoom controls (used when no external ref is provided)
function MapZoomControls() {
  const map = useMap()
  return (
    <div className="absolute top-4 right-4 z-[400] flex flex-col gap-1 bg-white p-1 rounded-lg shadow-sm border border-gray-200">
      <button
        type="button"
        onClick={() => map.zoomIn()}
        className="w-7 h-7 flex items-center justify-center text-gray-700 hover:bg-gray-100 rounded-md font-bold text-base transition-colors select-none cursor-pointer"
        title="Zoom In"
      >
        +
      </button>
      <div className="h-px bg-gray-100 w-full" />
      <button
        type="button"
        onClick={() => map.zoomOut()}
        className="w-7 h-7 flex items-center justify-center text-gray-700 hover:bg-gray-100 rounded-md font-bold text-base transition-colors select-none cursor-pointer"
        title="Zoom Out"
      >
        −
      </button>
    </div>
  )
}

export default function MapComponent({ 
  center = [27.7172, 85.3240], // Kathmandu center
  zoom = 13, 
  minZoom = 3,
  maxZoom = 18,
  width = '100%',
  height = '100%',
  mapRef = null,
  showZoomControls = true,
  children 
}) {
  return (
    <MapContainer 
      center={center} 
      zoom={zoom}
      minZoom={minZoom}
      maxZoom={maxZoom}
      zoomControl={false}
      style={{ width, height }}
    >
      <ChangeMapView center={center} />
      {mapRef && <SetMapRef mapRef={mapRef} />}
      {showZoomControls && !mapRef && <MapZoomControls />}
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {children}
    </MapContainer>
  )
}
