import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { TrackingEvent } from '@/lib/api';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface TrackingMapProps {
  events: TrackingEvent[];
  currentLocation?: {
    lat: number;
    lng: number;
  };
}

const TrackingMap: React.FC<TrackingMapProps> = ({ events, currentLocation }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const validEvents = events.filter((e) => e.lat && e.lng);
    if (validEvents.length === 0 && !currentLocation) return;

    const centerLat =
      currentLocation?.lat || validEvents[0]?.lat || 0;
    const centerLng =
      currentLocation?.lng || validEvents[0]?.lng || 0;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [centerLng, centerLat],
      zoom: 4,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      if (!map.current) return;

      if (validEvents.length > 1) {
        const coordinates = validEvents.map((e) => [e.lng!, e.lat!]);

        map.current.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates,
            },
          },
        });

        map.current.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#5167FC',
            'line-width': 3,
          },
        });

        const bounds = new mapboxgl.LngLatBounds();
        coordinates.forEach((coord) => bounds.extend(coord as [number, number]));
        map.current.fitBounds(bounds, { padding: 50 });
      }

      validEvents.forEach((event, index) => {
        if (!event.lat || !event.lng || !map.current) return;

        const isLatest = index === 0;
        const isOrigin = index === validEvents.length - 1;

        const el = document.createElement('div');
        el.className = 'tracking-marker';
        el.style.width = isLatest ? '20px' : '12px';
        el.style.height = isLatest ? '20px' : '12px';
        el.style.backgroundColor = isLatest
          ? '#5167FC'
          : isOrigin
          ? '#00B6FF'
          : '#E5E7EB';
        el.style.borderRadius = '50%';
        el.style.border = isLatest ? '3px solid white' : '2px solid white';
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="padding: 8px;">
            <strong>${event.status}</strong><br/>
            <span style="font-size: 12px; color: #666;">${event.location}</span><br/>
            <span style="font-size: 11px; color: #999;">
              ${new Date(event.timestamp).toLocaleString('zh-CN')}
            </span>
          </div>
        `);

        new mapboxgl.Marker(el)
          .setLngLat([event.lng, event.lat])
          .setPopup(popup)
          .addTo(map.current);
      });

      if (currentLocation && (!validEvents.length || 
          (validEvents[0].lat !== currentLocation.lat || 
           validEvents[0].lng !== currentLocation.lng))) {
        const el = document.createElement('div');
        el.className = 'current-location-marker';
        el.style.width = '24px';
        el.style.height = '24px';
        el.style.backgroundColor = '#FF6B6B';
        el.style.borderRadius = '50%';
        el.style.border = '4px solid white';
        el.style.boxShadow = '0 2px 8px rgba(255,107,107,0.5)';
        el.style.animation = 'pulse 2s infinite';

        new mapboxgl.Marker(el)
          .setLngLat([currentLocation.lng, currentLocation.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div style="padding: 8px;">
                <strong>当前位置</strong>
              </div>
            `)
          )
          .addTo(map.current);
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [events, currentLocation]);

  return (
    <div className="relative w-full h-96 rounded-lg overflow-hidden">
      <div ref={mapContainer} className="w-full h-full" />
      <style>{`
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(255, 107, 107, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(255, 107, 107, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(255, 107, 107, 0);
          }
        }
      `}</style>
    </div>
  );
};

export default TrackingMap;
