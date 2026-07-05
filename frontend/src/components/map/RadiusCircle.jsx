import { Circle } from 'react-leaflet'

export default function RadiusCircle({ center, radius, color = '#3388ff', type = 'emergency' }) {
  return (
    <Circle
      center={center}
      radius={radius}
      pathOptions={{
        color: color,
        weight: 2,
        opacity: 0.5,
        fillOpacity: 0.1,
        fillColor: color,
        dashArray: type === 'emergency' ? '5, 5' : 'none'
      }}
    />
  )
}
