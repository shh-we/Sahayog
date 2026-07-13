import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

// Create custom emergency markers by type
const getEmergencyIcon = (type) => {
  const colors = {
    fire: '#ff0000',           // Red
    medical: '#0000ff',        // Blue
    security: '#4f46e5',       // Indigo
    natural_disaster: '#ea580c', // Orange
    other: '#808080'           // Gray
  }
  
  const color = colors[type] || colors.other

  return L.divIcon({
    className: 'custom-icon',
    html: `<div style="
      background-color: ${color};
      width: 30px;
      height: 30px;
      border-radius: 50%;
      border: 3px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
    ">!</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
  })
}

export default function EmergencyMarker({ emergency, onClick }) {
  const [longitude, latitude] = emergency.reporterLocation?.coordinates || [null, null]
  const { type, description } = emergency

  // Don't render if coordinates are missing
  if (!latitude || !longitude) {
    return null
  }

  return (
    <Marker 
      position={[latitude, longitude]}
      icon={getEmergencyIcon(type)}
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
