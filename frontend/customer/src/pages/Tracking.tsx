import { useState, useEffect, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, MapPin, Calendar, Package, Loader } from 'lucide-react';
import { trackingApi, type Shipment } from '../lib/api';
import { subscribeToTracking } from '../lib/socket';

const TrackingMap = lazy(() => import('../components/TrackingMap'));

type SearchMode = 'trackingNumber' | 'orderId' | 'receiverPhone';

export default function Tracking() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchMode, setSearchMode] = useState<SearchMode>('trackingNumber');
  const [searchValue, setSearchValue] = useState(searchParams.get('number') || '');
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    setIsAuthenticated(!!token);
  }, []);

  useEffect(() => {
    const number = searchParams.get('number');
    if (number) {
      setSearchValue(number);
      setSearchMode('trackingNumber');
      handleSearch(number, 'trackingNumber');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!selectedShipment?.trackingNumber) return;

    const unsubscribe = subscribeToTracking(selectedShipment.trackingNumber, (newEvent) => {
      setSelectedShipment((prev) => {
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
  }, [selectedShipment?.trackingNumber]);

  const handleSearch = async (value?: string, mode?: SearchMode) => {
    const searchString = value || searchValue;
    const currentMode = mode || searchMode;

    if (!searchString.trim()) return;

    setError('');
    setLoading(true);
    setShipments([]);
    setSelectedShipment(null);

    try {
      if (isAuthenticated) {
        const params: any = {};
        if (currentMode === 'trackingNumber') {
          params.trackingNumber = searchString.trim();
        } else if (currentMode === 'orderId') {
          params.orderId = searchString.trim();
        } else if (currentMode === 'receiverPhone') {
          params.receiverPhone = searchString.trim();
        }

        const response = await trackingApi.searchTracking(params);
        if (response.data.shipments.length > 0) {
          setShipments(response.data.shipments);
          setSelectedShipment(response.data.shipments[0]);
          if (currentMode === 'trackingNumber') {
            setSearchParams({ number: searchString.trim() });
          }
        } else {
          setError('未找到符合条件的运单信息');
        }
      } else {
        if (currentMode !== 'trackingNumber') {
          setError('请先登录以使用高级查询功能');
          return;
        }
        const response = await trackingApi.getTracking(searchString.trim());
        setShipments([response.data.shipment]);
        setSelectedShipment(response.data.shipment);
        setSearchParams({ number: searchString.trim() });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '未找到该运单信息');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  const getSearchPlaceholder = () => {
    switch (searchMode) {
      case 'orderId':
        return '输入订单号...';
      case 'receiverPhone':
        return '输入收件人手机号...';
      default:
        return '输入运单号...';
    }
  };

  return (
    <div className="min-h-screen bg-neutral-gray py-8">
      <div className="container mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <h1 className="text-3xl font-bold mb-6">物流追踪</h1>
          
          {isAuthenticated && (
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSearchMode('trackingNumber')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  searchMode === 'trackingNumber'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                运单号
              </button>
              <button
                onClick={() => setSearchMode('orderId')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  searchMode === 'orderId'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                订单号
              </button>
              <button
                onClick={() => setSearchMode('receiverPhone')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  searchMode === 'receiverPhone'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                收件人手机
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={getSearchPlaceholder()}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-primary text-white px-8 py-3 rounded-lg hover:bg-primary/90 transition font-semibold disabled:opacity-50"
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

        {shipments.length > 1 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">查询结果 ({shipments.length})</h2>
            <div className="grid gap-3">
              {shipments.map((shipment) => (
                <button
                  key={shipment.shipmentId}
                  onClick={() => setSelectedShipment(shipment)}
                  className={`text-left p-4 rounded-lg border-2 transition-colors ${
                    selectedShipment?.shipmentId === shipment.shipmentId
                      ? 'border-primary bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{shipment.trackingNumber}</p>
                      <p className="text-sm text-gray-600">{shipment.currentLocation || '暂无位置信息'}</p>
                    </div>
                    <Package className="w-5 h-5 text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}

        {selectedShipment && !loading && (
          <>
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
              <h2 className="text-xl font-bold mb-4">物流地图</h2>
              <Suspense fallback={
                <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Loader className="w-8 h-8 text-primary animate-spin" />
                </div>
              }>
                <TrackingMap
                  events={selectedShipment.events}
                  currentLocation={
                    selectedShipment.currentLat && selectedShipment.currentLng
                      ? { lat: selectedShipment.currentLat, lng: selectedShipment.currentLng }
                      : undefined
                  }
                />
              </Suspense>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <h2 className="text-xl font-bold mb-4">运单信息</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center space-x-2 text-gray-500 mb-1">
                        <Package className="w-4 h-4" />
                        <span className="text-sm">运单号</span>
                      </div>
                      <p className="font-mono font-semibold text-lg">{selectedShipment.trackingNumber}</p>
                    </div>

                    <div>
                      <div className="flex items-center space-x-2 text-gray-500 mb-1">
                        <MapPin className="w-4 h-4" />
                        <span className="text-sm">当前位置</span>
                      </div>
                      <p className="font-medium">{selectedShipment.currentLocation || '暂无位置信息'}</p>
                    </div>

                    {selectedShipment.estimatedDelivery && (
                      <div>
                        <div className="flex items-center space-x-2 text-gray-500 mb-1">
                          <Calendar className="w-4 h-4" />
                          <span className="text-sm">预计送达</span>
                        </div>
                        <p className="font-medium">
                          {new Date(selectedShipment.estimatedDelivery).toLocaleDateString('zh-CN')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <h2 className="text-xl font-bold mb-4">物流动态</h2>
                  
                  {selectedShipment.events.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">暂无物流动态</p>
                  ) : (
                    <div className="space-y-4">
                      {selectedShipment.events.map((event, index) => (
                        <div key={event.eventId} className="flex space-x-4">
                          <div className="flex flex-col items-center">
                            <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-primary' : 'bg-gray-300'}`} />
                            {index < selectedShipment.events.length - 1 && (
                              <div className="w-0.5 h-full bg-gray-200 my-1" />
                            )}
                          </div>
                          
                          <div className="flex-1 pb-6">
                            <div className="flex items-start justify-between mb-1">
                              <p className="font-semibold text-gray-900">{event.status}</p>
                              <span className="text-sm text-gray-500">
                                {new Date(event.timestamp).toLocaleString('zh-CN')}
                              </span>
                            </div>
                            <p className="text-gray-600">{event.description || event.location}</p>
                            {event.location && event.description && (
                              <p className="text-sm text-gray-500 mt-1 flex items-center">
                                <MapPin className="w-3 h-3 mr-1" />
                                {event.location}
                              </p>
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
