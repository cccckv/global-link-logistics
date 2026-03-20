import { useEffect, useRef } from 'react';
import { Viewer, Entity } from 'resium';
import { Cartesian3, Color, Ion } from 'cesium';

Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN || '';

interface Globe3DProps {
  routes?: Array<{
    from: { lat: number; lng: number };
    to: { lat: number; lng: number };
    color?: string;
  }>;
}

export default function Globe3D({ routes = [] }: Globe3DProps) {
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    if (viewerRef.current?.cesiumElement) {
      const viewer = viewerRef.current.cesiumElement;
      viewer.scene.globe.enableLighting = true;
      
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(0, 20, 20000000),
        duration: 2,
      });
    }
  }, []);

  return (
    <div className="w-full h-full">
      <Viewer
        ref={viewerRef}
        full
        animation={false}
        timeline={false}
        baseLayerPicker={false}
        geocoder={false}
        homeButton={false}
        navigationHelpButton={false}
        sceneModePicker={false}
        selectionIndicator={false}
        infoBox={false}
      >
        {routes.map((route, index) => (
          <Entity
            key={index}
            position={Cartesian3.fromDegrees(route.from.lng, route.from.lat)}
            point={{
              pixelSize: 10,
              color: Color.fromCssColorString(route.color || '#00B6FF'),
            }}
          />
        ))}
      </Viewer>
    </div>
  );
}
