import { useState } from 'react';
import { Search, Package, Ship, MapPin, Loader, Navigation } from 'lucide-react';
import { vesselApi, type VesselPosition } from '../lib/api';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function Home() {
  const [mmsi, setMmsi] = useState('');
  const [vessel, setVessel] = useState<VesselPosition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!mmsi.trim()) {
      setError('请输入MMSI编号');
      return;
    }

    if (!/^\d{9}$/.test(mmsi.trim())) {
      setError('MMSI格式错误，应为9位数字');
      return;
    }

    setError('');
    setLoading(true);
    setVessel(null);

    try {
      const response = await vesselApi.getPosition(mmsi.trim());
      if (response.data.success && response.data.data) {
        setVessel(response.data.data);
      } else {
        setError(response.data.message || '未找到该船舶信息');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '查询失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full min-h-screen overflow-hidden">
      <div 
        className="absolute inset-0 z-0"
        style={{
          background: 'radial-gradient(circle at center, #001529 0%, #000000 100%)'
        }}
      />

      <div className="relative z-10 w-full min-h-screen">
        <div className="container mx-auto px-8 py-12">
          <div className="text-center mb-12">
            <h1 className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 mb-6 tracking-tight leading-tight">
              连接全球，物流无界
            </h1>
            <p className="text-2xl md:text-3xl text-gray-300 font-light tracking-wide">
              实时追踪您的国际物流，安全可靠
            </p>
          </div>

          <div className="max-w-2xl mx-auto mb-8">
            <form onSubmit={handleSearch}>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={mmsi}
                  onChange={(e) => setMmsi(e.target.value)}
                  placeholder="输入9位MMSI编号查询船舶"
                  className="flex-1 px-6 py-4 bg-white/5 backdrop-blur-sm border-2 border-cyan-500/40 rounded-xl text-white placeholder-gray-400 focus:border-cyan-400 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition-all duration-300 text-lg shadow-lg shadow-cyan-500/10"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-semibold hover:from-cyan-400 hover:to-blue-400 hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center shadow-lg shadow-cyan-500/30"
                >
                  {loading ? (
                    <Loader className="w-6 h-6 animate-spin" />
                  ) : (
                    <Search className="w-6 h-6" />
                  )}
                </button>
              </div>
            </form>

            {error && (
              <div className="mt-4 p-4 bg-red-900/30 backdrop-blur-sm border border-red-500/50 rounded-xl">
                <p className="text-red-300 text-center">{error}</p>
              </div>
            )}
          </div>

          <div className="w-full">
            {vessel && (
              <div className="grid grid-cols-12 gap-6 w-full">
                <div className="col-span-12 lg:col-span-4">
                  <div className="bg-gradient-to-br from-blue-900/80 to-blue-950/80 backdrop-blur-md rounded-xl border border-cyan-500/30 p-5 shadow-lg shadow-cyan-500/20">
                    <h3 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
                      <Ship className="w-5 h-5" />
                      船舶信息
                    </h3>
                    
                    <div className="space-y-3">
                      <div className="pb-3 border-b border-cyan-500/20">
                        <div className="text-xl font-bold text-white mb-1">{vessel.shipName}</div>
                        {vessel.shipCnName && (
                          <div className="text-sm text-gray-300">{vessel.shipCnName}</div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="bg-black/20 p-2.5 rounded-lg">
                          <div className="text-gray-400 text-xs mb-0.5">MMSI</div>
                          <div className="text-cyan-400 font-mono text-sm">{vessel.mmsi}</div>
                        </div>
                        <div className="bg-black/20 p-2.5 rounded-lg">
                          <div className="text-gray-400 text-xs mb-0.5">IMO</div>
                          <div className="text-cyan-400 font-mono text-sm">{vessel.imo || 'N/A'}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-black/20 p-2.5 rounded-lg">
                          <div className="text-gray-400 text-xs mb-0.5">航速</div>
                          <div className="text-green-400 font-semibold">{vessel.sog} 节</div>
                        </div>
                        <div className="bg-black/20 p-2.5 rounded-lg">
                          <div className="text-gray-400 text-xs mb-0.5">航向</div>
                          <div className="text-green-400 font-semibold">{vessel.cog}°</div>
                        </div>
                      </div>

                      <div className="bg-black/20 p-2.5 rounded-lg">
                        <div className="text-gray-400 text-xs mb-0.5 flex items-center gap-1">
                          <Navigation className="w-3 h-3" />
                          位置坐标
                        </div>
                        <div className="text-white font-mono text-sm">
                          {vessel.lat.toFixed(4)}° N
                        </div>
                        <div className="text-white font-mono text-sm">
                          {vessel.lng.toFixed(4)}° E
                        </div>
                      </div>

                      <div className="bg-black/20 p-2.5 rounded-lg">
                        <div className="text-gray-400 text-xs mb-0.5">目的港</div>
                        <div className="text-white text-sm">{vessel.destination || 'N/A'}</div>
                      </div>

                      <div className="pt-3 border-t border-cyan-500/20">
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <MapPin className="w-3 h-3" />
                          {vessel.lastTime}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-span-12 lg:col-span-8">
                  <div className="bg-gradient-to-br from-blue-900/80 to-blue-950/80 backdrop-blur-md rounded-xl border border-cyan-500/30 p-5 shadow-lg shadow-cyan-500/20 h-full">
                    <h3 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      船舶位置
                    </h3>
                    
                    <div className="h-[600px] rounded-lg overflow-hidden border border-cyan-500/30">
                      <MapContainer
                        center={[vessel.lat, vessel.lng]}
                        zoom={8}
                        style={{ height: '100%', width: '100%' }}
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <Marker position={[vessel.lat, vessel.lng]}>
                          <Popup>
                            <div className="text-gray-900">
                              <p className="font-bold">{vessel.shipName}</p>
                              <p className="text-sm">{vessel.shipCnName}</p>
                              <p className="text-xs mt-1">
                                位置: {vessel.lat.toFixed(4)}°, {vessel.lng.toFixed(4)}°
                              </p>
                              <p className="text-xs">航速: {vessel.sog} 节</p>
                              <p className="text-xs">航向: {vessel.cog}°</p>
                            </div>
                          </Popup>
                        </Marker>
                      </MapContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {!vessel && !loading && (
            <div className="text-center py-12">
              <Ship className="w-32 h-32 text-cyan-400/20 mx-auto mb-6" />
              <p className="text-2xl text-gray-400">输入MMSI编号开始查询</p>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 bg-black/80 backdrop-blur-sm border-t border-cyan-500/20 py-8 mt-12">
        <div className="container mx-auto px-8">
          <div className="grid grid-cols-3 gap-8 text-center">
            <div className="p-6 bg-gradient-to-br from-blue-900/40 to-blue-950/40 rounded-xl border border-cyan-500/20">
              <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Ship className="w-8 h-8 text-cyan-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">实时追踪</h3>
              <p className="text-gray-400 text-sm">
                全球船舶位置实时监控
              </p>
            </div>

            <div className="p-6 bg-gradient-to-br from-blue-900/40 to-blue-950/40 rounded-xl border border-cyan-500/20">
              <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">精准定位</h3>
              <p className="text-gray-400 text-sm">
                高精度船舶位置数据
              </p>
            </div>

            <div className="p-6 bg-gradient-to-br from-blue-900/40 to-blue-950/40 rounded-xl border border-cyan-500/20">
              <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">专业服务</h3>
              <p className="text-gray-400 text-sm">
                一站式船舶信息查询
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
