import { useEffect, useState, useRef } from 'react';
import { useMap, Polyline, Marker } from 'react-leaflet';
import L from 'leaflet';
import ResponderMarker from './ResponderMarker';

export default function ActiveRouteLayer({ 
  responderCoords, 
  emergencyCoords, 
  onRouteFetched,
  onArrival,
  onProgress,
  syncRouteCoordinates = null,
  syncJourneyStartedAt = null,
  isEnRoute, 
  renderMarker = false,
  showRoute = true,
  responderName = "Me",
  isAvailable = false,
  customIcon = null,
  journeyDurationMs = 60000,
}) {
  const map = useMap();
  const [routePositions, setRoutePositions] = useState([]);
  const [animatedCoords, setAnimatedCoords] = useState(null);
  
  const initialResponderCoordsRef = useRef(null);
  const animationFrameRef = useRef(null);
  const onArrivalRef = useRef(onArrival);
  const onProgressRef = useRef(onProgress);
  const arrivedRef = useRef(false);

  useEffect(() => {
    onArrivalRef.current = onArrival;
    onProgressRef.current = onProgress;
  }, [onArrival, onProgress]);

  const isDefaultCoords = (coords) => {
    if (!coords) return true;
    return Math.abs(coords[0] - 27.7172) < 0.0001 && Math.abs(coords[1] - 85.3240) < 0.0001;
  };

  if (!syncRouteCoordinates && isEnRoute && !initialResponderCoordsRef.current && responderCoords && !isDefaultCoords(responderCoords)) {
    initialResponderCoordsRef.current = responderCoords;
  }
  if (!isEnRoute) {
    initialResponderCoordsRef.current = null;
    arrivedRef.current = false;
  }

  useEffect(() => {
    if (syncRouteCoordinates) return;
    const startCoords = initialResponderCoordsRef.current;
    if (isEnRoute && startCoords && emergencyCoords) {
      const bounds = L.latLngBounds([startCoords, emergencyCoords]);
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
      const [rLat, rLon] = startCoords;
      const [eLat, eLon] = emergencyCoords;
      const fetchRoute = async () => {
        try {
          const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${rLon},${rLat};${eLon},${eLat}?overview=full&geometries=geojson`);
 const data = await response.json();
 let coords = [];
 if (data.routes && data.routes.length > 0) {
 coords = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
 } else {
 coords = [startCoords, emergencyCoords];
 }
 setRoutePositions(coords);
 if (onRouteFetched) onRouteFetched(coords);
 } catch (error) {
 const coords = [startCoords, emergencyCoords];
 setRoutePositions(coords);
 if (onRouteFetched) onRouteFetched(coords);
 }
 };
 fetchRoute();
 } else if (!isEnRoute) {
 setRoutePositions([]);
 setAnimatedCoords(null);
 if (onRouteFetched) onRouteFetched([]);
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [isEnRoute, emergencyCoords?.[0], emergencyCoords?.[1]]);

 useEffect(() => {
 if (!syncRouteCoordinates || !isEnRoute) return;
 setRoutePositions(syncRouteCoordinates);
 if (syncRouteCoordinates.length >= 2) {
 const bounds = L.latLngBounds(syncRouteCoordinates);
 map.fitBounds(bounds, { padding: [50, 50], animate: true });
 }
 }, [syncRouteCoordinates, isEnRoute, map]);

 useEffect(() => {
 if (!isEnRoute || routePositions.length < 2) {
 setAnimatedCoords(null);
 if (animationFrameRef.current) {
 cancelAnimationFrame(animationFrameRef.current);
 animationFrameRef.current = null;
 }
 return;
 }

 arrivedRef.current = false;
 const segDistances = [];
 let totalDistance = 0;
 for (let i = 0; i < routePositions.length - 1; i++) {
 const p1 = routePositions[i];
 const p2 = routePositions[i + 1];
 const d = Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2));
 segDistances.push(d);
 totalDistance += d;
 }

 let selfStartTime = null;
 let lastThrottledTime = 0;

 const tick = (timestamp) => {
 if (!syncJourneyStartedAt && !selfStartTime) selfStartTime = timestamp;
 let elapsed;
 if (syncJourneyStartedAt) {
 elapsed = Date.now() - new Date(syncJourneyStartedAt).getTime();
 } else {
 elapsed = timestamp - selfStartTime;
 }

 const progress = Math.min(elapsed / journeyDurationMs, 1);

 if (progress >= 1 || arrivedRef.current) {
 if (!arrivedRef.current) {
 arrivedRef.current = true;
 const finalPos = routePositions[routePositions.length - 1];
 setAnimatedCoords(finalPos);
 if (onProgressRef.current) onProgressRef.current(finalPos);
 if (onArrivalRef.current) onArrivalRef.current(finalPos);
 }
 return;
 }

 let targetDist = progress * totalDistance;
 let index = 0;
 while (index < segDistances.length && targetDist > segDistances[index]) {
 targetDist -= segDistances[index];
 index++;
 }
 if (index >= routePositions.length - 1) {
 index = routePositions.length - 2;
 targetDist = segDistances[index];
 }

 const [lat1, lon1] = routePositions[index];
 const [lat2, lon2] = routePositions[index + 1];
 const segFraction = segDistances[index] === 0 ? 0 : targetDist / segDistances[index];
 const currentCoords = [lat1 + (lat2 - lat1) * segFraction, lon1 + (lon2 - lon1) * segFraction];

 setAnimatedCoords(currentCoords);

 const now = Date.now();
 if (now - lastThrottledTime > 1500) {
 lastThrottledTime = now;
 if (onProgressRef.current) onProgressRef.current(currentCoords);
 }

 animationFrameRef.current = requestAnimationFrame(tick);
 };

 animationFrameRef.current = requestAnimationFrame(tick);
 return () => {
 if (animationFrameRef.current) {
 cancelAnimationFrame(animationFrameRef.current);
 animationFrameRef.current = null;
 }
 };
 }, [isEnRoute, routePositions, syncJourneyStartedAt, journeyDurationMs]);

 const hasCoords = syncRouteCoordinates ? syncRouteCoordinates.length > 0 : (responderCoords && emergencyCoords);
 if (!isEnRoute || !hasCoords) return null;

 const displayLoc = animatedCoords || (syncRouteCoordinates ? syncRouteCoordinates[0] : responderCoords);

 return (
 <>
 {showRoute && routePositions.length > 0 && (
 <Polyline 
 positions={routePositions} 
 pathOptions={{ color: '#2563eb', weight: 6, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }} 
 />
 )}
 {renderMarker && displayLoc && (
 customIcon ? (
 <Marker position={displayLoc} icon={customIcon} />
 ) : (
 <ResponderMarker
 responder={{
 location: { coordinates: [displayLoc[1], displayLoc[0]] },
 name: responderName,
 isAvailable: isAvailable
 }}
 />
 )
 )}
 </>
 );
}
