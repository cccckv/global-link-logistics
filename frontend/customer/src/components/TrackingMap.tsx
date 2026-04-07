import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface TrackingEvent {
  eventId: string;
  status: string;
  location: string;
  description?: string;
  timestamp: string;
  lat?: number;
  lng?: number;
}

interface TrackingMapProps {
  events: TrackingEvent[];
  currentLocation?: {
    lat: number;
    lng: number;
  };
}

const createCustomIcon = (color: string, size: number = 25) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background-color: ${color};
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const AutoFitBounds: React.FC<{ positions: [number, number][] }> = ({ positions }) => {
  const map = useMap();
  
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [positions, map]);
  
  return null;
};

const TrackingMap: React.FC<TrackingMapProps> = ({ events, currentLocation }) => {
  const validEvents = events.filter((e) => e.lat && e.lng);
  
  if (validEvents.length === 0 && !currentLocation) {
    return (
      <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">暂无位置信息</p>
      </div>
    );
  }

  const center: [number, number] = currentLocation
    ? [currentLocation.lat, currentLocation.lng]
    : validEvents.length > 0
    ? [validEvents[0].lat!, validEvents[0].lng!]
    : [39.9042, 116.4074];

  const allPositions: [number, number][] = [
    ...validEvents.map(e => [e.lat!, e.lng!] as [number, number]),
    ...(currentLocation ? [[currentLocation.lat, currentLocation.lng] as [number, number]] : []),
  ];

  const routePositions: [number, number][] = validEvents.map(e => [e.lat!, e.lng!] as [number, number]);

  return (
    <div className="relative w-full h-96 rounded-lg overflow-hidden">
      <MapContainer
        center={center}
        zoom={4}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <AutoFitBounds positions={allPositions} />

        {routePositions.length > 1 && (
          <Polyline
            positions={routePositions}
            color="#5167FC"
            weight={3}
            opacity={0.7}
          />
        )}

        {validEvents.map((event, index) => {
          const isLatest = index === 0;
          const isOrigin = index === validEvents.length - 1;
          const color = isLatest ? '#5167FC' : isOrigin ? '#00B6FF' : '#E5E7EB';
          const size = isLatest ? 25 : 15;

          return (
            <Marker
              key={event.eventId}
              position={[event.lat!, event.lng!]}
              icon={createCustomIcon(color, size)}
            >
              <Popup>
                <div className="p-2">
                  <strong className="text-sm">{event.status}</strong>
                  <br />
                  <span className="text-xs text-gray-600">{event.location}</span>
                  <br />
                  <span className="text-xs text-gray-400">
                    {new Date(event.timestamp).toLocaleString('zh-CN')}
                  </span>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {currentLocation && (!validEvents.length || 
          (validEvents[0].lat !== currentLocation.lat || 
           validEvents[0].lng !== currentLocation.lng)) && (
          <Marker
            position={[currentLocation.lat, currentLocation.lng]}
            icon={createCustomIcon('#FF6B6B', 30)}
          >
            <Popup>
              <div className="p-2">
                <strong className="text-sm">当前位置</strong>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
};

export default TrackingMap;
