import { useState } from 'react';
import { Search, Ship, MapPin, Navigation, Anchor, Clock, Loader, ArrowLeft } from 'lucide-react';
import { vesselApi, type VesselSearchResult, type VesselPosition } from '../lib/api';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const MATCH_TYPE_LABELS: Record<number, string> = {
  1: '船名',
  2: '呼号',
  3: 'MMSI',
  5: 'IMO',
};

export default function VesselPosition() {
  const [keywords, setKeywords] = useState('');
  const [searchResults, setSearchResults] = useState<VesselSearchResult[]>([]);
  const [selectedVessel, setSelectedVessel] = useState<VesselPosition | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [showResults, setShowResults] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!keywords.trim()) {
      setError('请输入查询关键字');
      return;
    }

    setError('');
    setLoading(true);
    setSearchResults([]);
    setSelectedVessel(null);
    setShowResults(false);

    try {
      const response = await vesselApi.searchVessels(keywords.trim(), 20);
      if (response.data.success) {
        setSearchResults(response.data.data);
        setShowResults(true);
        if (response.data.data.length === 0) {
          setError('未找到匹配的船舶');
        }
      } else {
        setError(response.data.message || '搜索失败');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '搜索失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVessel = async (result: VesselSearchResult) => {
    setDetailLoading(true);
    setError('');
    setSelectedVessel(null);

    try {
      const response = await vesselApi.getPosition(result.mmsi.toString());
      if (response.data.success && response.data.data) {
        setSelectedVessel(response.data.data);
        setShowResults(false);
      } else {
        setError(response.data.message || '未找到该船舶详细信息');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '获取船舶位置失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleBackToResults = () => {
    setSelectedVessel(null);
    setShowResults(true);
  };

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2 text-gray-900">
            <Ship className="w-8 h-8 text-[#5167FC]" />
            船舶位置查询
          </h1>
          <p className="text-gray-600">实时查询船舶位置、航速、航向等信息（支持船名、呼号、MMSI、IMO）</p>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2 text-gray-700">查询关键字</label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="输入船名、呼号、MMSI或IMO编号"
                className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 focus:border-[#5167FC] focus:outline-none focus:ring-2 focus:ring-[#5167FC]/50 transition-all text-gray-900"
                disabled={loading}
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-[#5167FC] to-[#00B6FF] text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-[#5167FC]/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    搜索中...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    搜索
                  </>
                )}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-300 rounded-lg">
              <p className="text-red-700">{error}</p>
            </div>
          )}
        </div>

        {showResults && searchResults.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4 text-gray-900">
              搜索结果 ({searchResults.length})
            </h2>
            <div className="space-y-3">
              {searchResults.map((result) => (
                <button
                  key={`${result.mmsi}-${result.lastTimeUtc}`}
                  onClick={() => handleSelectVessel(result)}
                  disabled={detailLoading}
                  className="w-full text-left p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-all border border-gray-200 hover:border-[#5167FC] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Ship className="w-5 h-5 text-[#5167FC]" />
                        <h3 className="font-bold text-lg text-gray-900">{result.shipName}</h3>
                        <span className="px-2 py-1 bg-[#5167FC]/10 text-[#5167FC] text-xs rounded">
                          {MATCH_TYPE_LABELS[result.matchType] || '匹配'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="text-gray-500">MMSI: </span>
                          <span className="font-mono text-gray-900">{result.mmsi}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">IMO: </span>
                          <span className="font-mono text-gray-900">{result.imo || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">呼号: </span>
                          <span className="font-mono text-gray-900">{result.callSign || 'N/A'}</span>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        最后更新: {result.lastTime}
                      </div>
                    </div>
                    <div className="text-[#5167FC]">
                      <Search className="w-5 h-5" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {detailLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 animate-spin text-[#5167FC]" />
            <span className="ml-3 text-lg text-gray-900">加载船舶详细信息...</span>
          </div>
        )}

        {selectedVessel && (
          <>
            <button
              onClick={handleBackToResults}
              className="mb-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg transition-all flex items-center gap-2 border border-gray-300"
            >
              <ArrowLeft className="w-4 h-4" />
              返回搜索结果
            </button>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900">
                  <Ship className="w-6 h-6 text-[#5167FC]" />
                  船舶信息
                </h2>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-500 text-sm mb-1">船名</p>
                      <p className="font-semibold text-gray-900">{selectedVessel.shipName}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm mb-1">中文船名</p>
                      <p className="font-semibold text-gray-900">{selectedVessel.shipCnName || '-'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-500 text-sm mb-1">MMSI</p>
                      <p className="font-mono text-gray-900">{selectedVessel.mmsi}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm mb-1">IMO</p>
                      <p className="font-mono text-gray-900">{selectedVessel.imo || '-'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-500 text-sm mb-1">呼号</p>
                      <p className="font-mono text-gray-900">{selectedVessel.callSign || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm mb-1">船舶类型</p>
                      <p className="text-gray-900">{selectedVessel.shipType}</p>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-gray-900">
                      <Navigation className="w-4 h-4 text-[#5167FC]" />
                      航行信息
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-gray-500 text-sm mb-1">经度</p>
                        <p className="font-mono text-gray-900">{selectedVessel.lng.toFixed(6)}°</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-sm mb-1">纬度</p>
                        <p className="font-mono text-gray-900">{selectedVessel.lat.toFixed(6)}°</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div>
                        <p className="text-gray-500 text-sm mb-1">航速</p>
                        <p className="font-semibold text-gray-900">{selectedVessel.sog} 节</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-sm mb-1">航向</p>
                        <p className="font-semibold text-gray-900">{selectedVessel.cog}°</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-sm mb-1">船首向</p>
                        <p className="font-semibold text-gray-900">{selectedVessel.heading === 511 ? 'N/A' : selectedVessel.heading + '°'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-gray-900">
                      <Anchor className="w-4 h-4 text-[#5167FC]" />
                      目的地信息
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-gray-500 text-sm mb-1">目的港</p>
                        <p className="font-semibold text-gray-900">{selectedVessel.destination || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-sm mb-1">预计到达</p>
                        <p className="text-sm text-gray-900">{selectedVessel.eta || '-'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-gray-900">
                      <Ship className="w-4 h-4 text-[#5167FC]" />
                      船舶参数
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-gray-500 text-sm mb-1">船长</p>
                        <p className="text-gray-900">{selectedVessel.length} m</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-sm mb-1">船宽</p>
                        <p className="text-gray-900">{selectedVessel.width} m</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-sm mb-1">吃水</p>
                        <p className="text-gray-900">{selectedVessel.draught} m</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="w-4 h-4" />
                      <span>最后更新：{selectedVessel.lastTime}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900">
                  <MapPin className="w-6 h-6 text-[#5167FC]" />
                  船舶位置
                </h2>
                
                <div className="h-[600px] rounded-lg overflow-hidden">
                  <MapContainer
                    center={[selectedVessel.lat, selectedVessel.lng]}
                    zoom={10}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[selectedVessel.lat, selectedVessel.lng]}>
                      <Popup>
                        <div className="text-gray-900">
                          <p className="font-bold">{selectedVessel.shipName}</p>
                          <p className="text-sm">{selectedVessel.shipCnName}</p>
                          <p className="text-xs mt-1">
                            位置: {selectedVessel.lat.toFixed(4)}°, {selectedVessel.lng.toFixed(4)}°
                          </p>
                          <p className="text-xs">航速: {selectedVessel.sog} 节</p>
                          <p className="text-xs">航向: {selectedVessel.cog}°</p>
                        </div>
                      </Popup>
                    </Marker>
                  </MapContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
