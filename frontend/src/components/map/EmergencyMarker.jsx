import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

// Create custom emergency markers by type
const getEmergencyIcon = (type, isTarget) => {
  const colors = {
    fire: '#ff0000',           // Red
    medical: '#0000ff',        // Blue
    security: '#4f46e5',       // Indigo
    natural_disaster: '#ea580c', // Orange
    other: '#808080'           // Gray
  }
  
  const color = isTarget ? '#dc2626' : (colors[type] || colors.other)
  const size = isTarget ? 36 : 30
  const boxShadow = isTarget ? `box-shadow: 0 0 15px 5px rgba(220, 38, 38, 0.5);` : ''
  const animation = isTarget ? `animation: pulseMarker 2s infinite;` : ''

  return L.divIcon({
    className: 'custom-icon',
    html: `
      <style>
        @keyframes pulseMarker {
          0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7); }
          70% { box-shadow: 0 0 0 15px rgba(220, 38, 38, 0); }
          100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
        }
      </style>
      <div style="
      background-color: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      border: 3px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      ${boxShadow}
      ${animation}
    ">!</div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    popupAnchor: [0, -size/2]
  })
}

export default function EmergencyMarker({ emergency, onClick, isTarget = false }) {
  const [longitude, latitude] = emergency.reporterLocation?.coordinates || [null, null]
  const { type, description } = emergency

  // Don't render if coordinates are missing
  if (!latitude || !longitude) {
    return null
  }

  return (
    <Marker 
      position={[latitude, longitude]}
      icon={getEmergencyIcon(type, isTarget)}
      eventHandlers={{
        click: () => onClick?.(emergency)
      }}
    >
      <Popup>
        <div style={{ minWidth: '200px' }}>
          <h3>{type.toUpperCase()}</h3>
          <p>{description}</p>
          <p><strong>Status:</strong> {emergency.status}</p>
          <p><strong>Responders:</strong> {emergency.responders?.length || 0}</p>
          <button type="button" onClick={() => onClick?.(emergency)}>
            View Details
          </button>
        </div>
      </Popup>
    </Marker>
  )
}
