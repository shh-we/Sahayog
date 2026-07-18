import { Polyline, Tooltip } from 'react-leaflet'

const SOURCE_CONFIG = {
  astar:   { label: 'A*',           bg: '#16a34a', border: '#15803d' },
  osrm:    { label: 'OSRM',         bg: '#2563eb', border: '#1d4ed8' },
  fallback:{ label: 'Fallback',     bg: '#d97706', border: '#b45309' },
  unknown: { label: 'Route',        bg: '#6b7280', border: '#4b5563' },
}

export default function AStarRoutePolyline({
  path = [],
  variant = 'responder',
  source = 'astar',
  visible = true
}) {
  if (!visible) return null

  const pathOptions =
    variant === 'facility'
      ? {
          color: '#16a34a',
          weight: 5,
          opacity: 0.85,
          dashArray: '10, 8',
          lineCap: 'round',
          lineJoin: 'round'
        }
      : {
          color: '#2563eb',
          weight: 6,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round'
        }

  // Leaflet Polyline expects [lat, lng] positions
  const positions = path.map((coord) => {
    if (Array.isArray(coord) && coord.length === 2) {
      return [coord[1], coord[0]]
    }
    return null
  }).filter(Boolean)

  if (positions.length < 2) {
    return (
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(220,38,38,0.95)',
          color: '#fff',
          fontSize: 11,
          fontWeight: 700,
          padding: '6px 14px',
          borderRadius: 8,
          zIndex: 500,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}
      >
        Route unavailable — road network data missing
      </div>
    )
  }

  const src = SOURCE_CONFIG[source] || SOURCE_CONFIG.unknown

  return (
    <Polyline
      positions={positions}
      pathOptions={pathOptions}
    >
      <Tooltip
        permanent
        direction="top"
        offset={[0, -6]}
        className="astar-route-badge"
      >
        <span
          style={{
            background: src.bg,
            color: '#fff',
            fontSize: 10,
            fontWeight: 800,
            padding: '2px 7px',
            borderRadius: 4,
            border: `1px solid ${src.border}`,
            whiteSpace: 'nowrap',
            lineHeight: '14px',
          }}
        >
          {src.label}
        </span>
      </Tooltip>
    </Polyline>
  )
}
