import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

// Create custom responder marker
const getResponderIcon = (isAvailable) => {
  const color = isAvailable ? '#00cc00' : '#999999'  // Green if available, gray if offline

  return L.divIcon({
    className: 'custom-icon',
    html: `<div style="
      background-color: ${color};
      width: 35px;
      height: 35px;
      border-radius: 50%;
      border: 3px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 20px;
    ">🚑</div>`,
    iconSize: [35, 35],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17]
  })
}

export default function ResponderMarker({ responder, onClick }) {
  const [longitude, latitude] = responder.location?.coordinates || [null, null]
  const { name, isAvailable, skills } = responder

  // Don't render if coordinates are missing
  if (!latitude || !longitude) {
    return null
  }

  return (
    <Marker 
      position={[latitude, longitude]}
      icon={getResponderIcon(isAvailable)}
      eventHandlers={{
        click: () => onClick?.(responder)
      }}
    >
      <Popup>
        <div style={{ minWidth: '200px' }}>
          <h3>{name}</h3>
          <p><strong>Status:</strong> {isAvailable ? '🟢 Available' : '🔴 Offline'}</p>
          <p><strong>Skills:</strong> {skills?.join(', ') || 'None'}</p>
          <button type="button" onClick={() => onClick?.(responder)}>
            View Profile
          </button>
        </div>
      </Popup>
    </Marker>
  )
}
