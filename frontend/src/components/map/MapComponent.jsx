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

// Enable smooth horizontal/vertical panning while mouse is hovering near map edges
function HoverPanHandler() {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()
    let animationFrameId = null
    let mousePos = null

    const handleMouseMove = (e) => {
      const rect = container.getBoundingClientRect()
      mousePos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        width: rect.width,
        height: rect.height,
      }
    }

    const handleMouseLeave = () => {
      mousePos = null
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
        animationFrameId = null
      }
    }

    const checkPan = () => {
      if (mousePos) {
        const { x, y, width, height } = mousePos
        const threshold = 80 // pixels from edge to trigger pan
        const maxSpeed = 12 // speed scaling factor
        let dx = 0
        let dy = 0

        if (x < threshold) {
          dx = -maxSpeed * (1 - x / threshold)
        } else if (x > width - threshold) {
          dx = maxSpeed * (1 - (width - x) / threshold)
        }

        if (y < threshold) {
          dy = -maxSpeed * (1 - y / threshold)
        } else if (y > height - threshold) {
          dy = maxSpeed * (1 - (height - y) / threshold)
        }

        if (dx !== 0 || dy !== 0) {
          map.panBy([dx, dy], { animate: false })
        }
      }
      animationFrameId = requestAnimationFrame(checkPan)
    }

    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseleave', handleMouseLeave)
    animationFrameId = requestAnimationFrame(checkPan)

    return () => {
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseleave', handleMouseLeave)
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [map])

  return null
}

// Handle mouse wheel and trackpad scroll to pan (vertically/horizontally) and Ctrl+wheel to zoom
function WheelScrollPanHandler() {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()

    const handleWheel = (e) => {
      if (e.ctrlKey) {
        // Zoom on Ctrl + wheel
        e.preventDefault()
        if (e.deltaY < 0) {
          map.zoomIn()
        } else if (e.deltaY > 0) {
          map.zoomOut()
        }
        return
      }

      // Normal wheel/trackpad scrolling pans the map
      e.preventDefault()

      let dx = e.deltaX
      let dy = e.deltaY

      if (e.shiftKey) {
        // Shift + wheel pans horizontally (left/right)
        dx = e.deltaY || e.deltaX
        dy = 0
      }

      if (dx !== 0 || dy !== 0) {
        map.panBy([dx, dy], { animate: false })
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [map])

  return null
}

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
  recenterOnPropChange = true,
  children 
}) {
  return (
    <MapContainer 
      center={center} 
      zoom={zoom}
      minZoom={minZoom}
      maxZoom={maxZoom}
      zoomControl={false}
      scrollWheelZoom={false}
      style={{ width, height }}
    >
      {recenterOnPropChange && <ChangeMapView center={center} />}
      {mapRef && <SetMapRef mapRef={mapRef} />}
      {showZoomControls && !mapRef && <MapZoomControls />}
      <HoverPanHandler />
      <WheelScrollPanHandler />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {children}
    </MapContainer>
  )
}
