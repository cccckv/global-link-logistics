import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { quickOrderApi } from '../lib/api';
import type { QuickOrder } from '../lib/api';
import { subscribeToTracking } from '../lib/socket';
import {
  Package,
  MapPin,
  Clock,
  User,
  Phone,
  ArrowLeft,
  CheckCircle,
} from 'lucide-react';

const OrderDetail: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<QuickOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!orderId) return;

    const fetchOrder = async () => {
      try {
        const { data } = await quickOrderApi.getDetail(orderId);
        setOrder(data);

        if (data.shipment?.trackingNumber) {
          const unsubscribe = subscribeToTracking(
            data.shipment.trackingNumber,
            (newEvent) => {
              setOrder((prev) => {
                if (!prev || !prev.shipment) return prev;
                return {
                  ...prev,
                  shipment: {
                    ...prev.shipment,
                    events: [newEvent, ...prev.shipment.events],
                  },
                };
              });
            }
          );
          return unsubscribe;
        }
      } catch (error) {
        console.error('获取订单失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: '待确认',
      confirmed: '已确认',
      in_transit: '运输中',
      delivered: '已送达',
      cancelled: '已取消',
    };
    return statusMap[status.toLowerCase()] || status;
  };

  const getOrderTypeText = (type: string) => {
    const typeMap: Record<string, string> = {
      SEA_LCL: '海运拼柜',
      SEA_FCL: '海运整柜',
      AIR: '空运',
      LAND: '陆运',
      PARCEL: '快递',
      BATCH: '批量订单',
    };
    return typeMap[type] || type;
  };

  const getPaymentStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: '待支付',
      succeeded: '已支付',
      failed: '支付失败',
      refunded: '已退款',
    };
    return statusMap[status.toLowerCase()] || status;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">订单不存在</h3>
          <Link to="/order/list" className="text-primary hover:underline">
            返回订单列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>返回</span>
        </button>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                订单详情 #{order.orderNumber}
              </h1>
              <p className="text-gray-500">
                创建时间:{' '}
                {new Date(order.createdAt).toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <span
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                order.status.toLowerCase() === 'delivered'
                  ? 'bg-green-100 text-green-800'
                  : order.status.toLowerCase() === 'pending'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {getStatusText(order.status)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {order.pickupAddress && (
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <h3 className="font-semibold text-gray-900">提货人信息</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <p className="text-gray-900 font-medium">{order.pickupAddress.name}</p>
                  {order.pickupAddress.company && (
                    <p className="text-gray-600">{order.pickupAddress.company}</p>
                  )}
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-4 h-4" />
                    <span>{order.pickupAddress.phone}</span>
                  </div>
                  <div className="flex items-start gap-2 text-gray-600">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      {order.pickupAddress.region && `${order.pickupAddress.region} `}
                      {order.pickupAddress.address}
                      {order.pickupAddress.postcode && ` (${order.pickupAddress.postcode})`}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-5 h-5 text-gray-400" />
                <h3 className="font-semibold text-gray-900">收件人信息</h3>
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-gray-900 font-medium">{order.recipientAddress.name}</p>
                {order.recipientAddress.company && (
                  <p className="text-gray-600">{order.recipientAddress.company}</p>
                )}
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="w-4 h-4" />
                  <span>{order.recipientAddress.phone}</span>
                </div>
                <div className="flex items-start gap-2 text-gray-600">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    {order.recipientAddress.region && `${order.recipientAddress.region} `}
                    {order.recipientAddress.address}
                    {order.recipientAddress.postcode && ` (${order.recipientAddress.postcode})`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold text-gray-900">订单信息</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 mb-1">订单类型</p>
                <p className="text-gray-900 font-medium">
                  {getOrderTypeText(order.orderType)}
                </p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">目的地</p>
                <p className="text-gray-900 font-medium">{order.destination}</p>
              </div>
              {order.warehouse && (
                <div>
                  <p className="text-gray-500 mb-1">仓库</p>
                  <p className="text-gray-900 font-medium">{order.warehouse}</p>
                </div>
              )}
              {order.trackingNumber && (
                <div>
                  <p className="text-gray-500 mb-1">追踪单号</p>
                  <p className="text-gray-900 font-medium font-mono">{order.trackingNumber}</p>
                </div>
              )}
              {order.userMark && (
                <div>
                  <p className="text-gray-500 mb-1">用户唛头</p>
                  <p className="text-gray-900 font-medium">{order.userMark}</p>
                </div>
              )}
            </div>
          </div>


        </div>

        {order.shipment && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-gray-400" />
              <h2 className="text-xl font-bold text-gray-900">物流追踪</h2>
            </div>

            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">运单号</p>
              <p className="text-lg font-mono font-semibold text-gray-900">
                {order.shipment.trackingNumber}
              </p>
              {order.shipment.carrier && (
                <p className="text-sm text-gray-600 mt-2">
                  承运商: {order.shipment.carrier}
                </p>
              )}
            </div>

            {order.shipment.events && order.shipment.events.length > 0 ? (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                <div className="space-y-6">
                  {order.shipment.events.map((event, index) => (
                    <div key={event.eventId} className="relative flex gap-4">
                      <div className="relative z-10 flex-shrink-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            index === 0
                              ? 'bg-primary'
                              : 'bg-white border-2 border-gray-300'
                          }`}
                        >
                          {index === 0 ? (
                            <CheckCircle className="w-5 h-5 text-white" />
                          ) : (
                            <Clock className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 pb-6">
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="font-medium text-gray-900 mb-1">
                            {event.status}
                          </p>
                          {event.description && (
                            <p className="text-sm text-gray-600 mb-2">
                              {event.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span>{event.location}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>
                                {new Date(event.timestamp).toLocaleString('zh-CN')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">暂无物流追踪信息</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderDetail;
