import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, MapPin, Calendar, Package, Loader } from 'lucide-react';
import { trackingApi, type Shipment } from '../lib/api';
import { subscribeToTracking } from '../lib/socket';
import TrackingMap from '../components/TrackingMap';

export default function Tracking() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [trackingNumber, setTrackingNumber] = useState(searchParams.get('number') || '');
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const number = searchParams.get('number');
    if (number) {
      setTrackingNumber(number);
      handleSearch(number);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!shipment?.trackingNumber) return;

    const unsubscribe = subscribeToTracking(shipment.trackingNumber, (newEvent) => {
      setShipment((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          events: [newEvent, ...prev.events],
          currentLocation: newEvent.location,
          currentLat: newEvent.lat,
          currentLng: newEvent.lng,
        };
      });
    });

    return unsubscribe;
  }, [shipment?.trackingNumber]);

  const handleSearch = async (number?: string) => {
    const searchNumber = number || trackingNumber;
    if (!searchNumber.trim()) return;

    setError('');
    setLoading(true);

    try {
      const response = await trackingApi.getTracking(searchNumber.trim());
      setShipment(response.data);
      setSearchParams({ number: searchNumber.trim() });
    } catch (err: any) {
      setError(err.response?.data?.message || '未找到该运单信息');
      setShipment(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  return (
    <div className="min-h-screen bg-neutral-gray py-8">
      <div className="container mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <h1 className="text-3xl font-bold mb-6">物流追踪</h1>
          
          <form onSubmit={handleSubmit} className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="输入运单号..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-primary text-white px-8 py-3 rounded-lg hover:bg-primary-light transition font-semibold disabled:opacity-50"
            >
              {loading ? '查询中...' : '查询'}
            </button>
          </form>

          {error && (
            <div className="mt-4 bg-accent-coral/10 border border-accent-coral text-accent-coral px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}

        {shipment && !loading && (
          <>
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
              <h2 className="text-xl font-bold mb-4">物流地图</h2>
              <TrackingMap
                events={shipment.events}
                currentLocation={
                  shipment.currentLat && shipment.currentLng
                    ? { lat: shipment.currentLat, lng: shipment.currentLng }
                    : undefined
                }
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4">运单信息</h2>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">运单号</p>
                    <p className="font-semibold">{shipment.trackingNumber}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-1">承运商</p>
                    <p className="font-semibold">{shipment.carrier}</p>
                  </div>

                  {shipment.currentLocation && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1 flex items-center">
                        <MapPin className="w-4 h-4 mr-1" />
                        当前位置
                      </p>
                      <p className="font-semibold">{shipment.currentLocation}</p>
                    </div>
                  )}

                  {shipment.estimatedDelivery && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1 flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        预计送达
                      </p>
                      <p className="font-semibold">
                        {new Date(shipment.estimatedDelivery).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                  )}

                  {shipment.actualDelivery && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1 flex items-center">
                        <Package className="w-4 h-4 mr-1" />
                        实际送达
                      </p>
                      <p className="font-semibold text-green-600">
                        {new Date(shipment.actualDelivery).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold mb-6">物流轨迹</h2>

                {shipment.events.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">暂无物流轨迹信息</p>
                ) : (
                  <div className="space-y-4">
                    {shipment.events.map((event, index) => (
                      <div key={event.eventId} className="flex items-start space-x-4">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-3 h-3 rounded-full ${
                              index === 0 ? 'bg-primary' : 'bg-gray-300'
                            }`}
                          />
                          {index < shipment.events.length - 1 && (
                            <div className="w-0.5 h-16 bg-gray-200 my-1" />
                          )}
                        </div>

                        <div className="flex-1 pb-8">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-semibold text-lg">{event.status}</p>
                            <p className="text-sm text-gray-600">
                              {new Date(event.timestamp).toLocaleString('zh-CN')}
                            </p>
                          </div>
                          <p className="text-gray-600 flex items-center">
                            <MapPin className="w-4 h-4 mr-1" />
                            {event.location}
                          </p>
                          {event.description && (
                            <p className="text-sm text-gray-500 mt-1">{event.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
