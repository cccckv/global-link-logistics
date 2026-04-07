import { useEffect, useRef, useState } from 'react';
import { Globe } from 'lucide-react';

const CESIUM_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN;

interface Globe3DProps {
  routes?: Array<{
    from: { lat: number; lng: number };
    to: { lat: number; lng: number };
    color?: string;
  }>;
}

// Fallback component when Cesium is not available
function GlobeFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900">
      <div className="text-center">
        <Globe className="w-32 h-32 text-blue-300 mx-auto mb-4 animate-pulse" />
        <p className="text-blue-200 text-sm">3D 地球可视化</p>
        <p className="text-blue-400 text-xs mt-2">需要配置 Cesium Token</p>
      </div>
    </div>
  );
}

export default function Globe3D({ routes = [] }: Globe3DProps) {
  const [hasError, setHasError] = useState(false);
  const viewerRef = useRef<any>(null);

  // If no token, show fallback immediately
  if (!CESIUM_TOKEN) {
    return <GlobeFallback />;
  }

  // If error occurred during loading, show fallback
  if (hasError) {
    return <GlobeFallback />;
  }

  // Dynamically import Cesium components only if token exists
  const [CesiumComponents, setCesiumComponents] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;

    const loadCesium = async () => {
      try {
        const { Viewer, Entity } = await import('resium');
        const { Cartesian3, Color, Ion } = await import('cesium');
        
        Ion.defaultAccessToken = CESIUM_TOKEN;

        if (isMounted) {
          setCesiumComponents({ Viewer, Entity, Cartesian3, Color });
        }
      } catch (error) {
        console.error('Failed to load Cesium:', error);
        if (isMounted) {
          setHasError(true);
        }
      }
    };

    loadCesium();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (viewerRef.current?.cesiumElement && CesiumComponents) {
      const viewer = viewerRef.current.cesiumElement;
      viewer.scene.globe.enableLighting = true;
      
      viewer.camera.flyTo({
        destination: CesiumComponents.Cartesian3.fromDegrees(0, 20, 20000000),
        duration: 2,
      });
    }
  }, [CesiumComponents]);

  // Loading state
  if (!CesiumComponents) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900">
        <div className="text-center">
          <Globe className="w-32 h-32 text-blue-300 mx-auto mb-4 animate-spin" />
          <p className="text-blue-200 text-sm">加载 3D 地球...</p>
        </div>
      </div>
    );
  }

  const { Viewer, Entity, Cartesian3, Color } = CesiumComponents;

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
