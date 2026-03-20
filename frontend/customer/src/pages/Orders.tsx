import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { orderApi, Order } from '@/lib/api';
import { Package, Clock, CheckCircle, XCircle, ChevronRight } from 'lucide-react';

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const { data } = await orderApi.getOrders();
        setOrders(data);
      } catch (error) {
        console.error('获取订单失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'in_transit':
      case 'processing':
        return <Package className="w-5 h-5 text-blue-500" />;
      case 'delivered':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Package className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: '待支付',
      processing: '处理中',
      in_transit: '运输中',
      delivered: '已送达',
      cancelled: '已取消',
    };
    return statusMap[status.toLowerCase()] || status;
  };

  const getShipmentTypeText = (type: string) => {
    const typeMap: Record<string, string> = {
      SEA: '海运',
      AIR: '空运',
      EXPRESS: '快递',
    };
    return typeMap[type] || type;
  };

  const filteredOrders = filter === 'all' 
    ? orders 
    : orders.filter(order => order.status.toLowerCase() === filter);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 页头 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">我的订单</h1>
          <p className="text-gray-600">管理和追踪您的所有物流订单</p>
        </div>

        {/* 筛选和新建按钮 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-primary-blue text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              全部 ({orders.length})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                filter === 'pending'
                  ? 'bg-primary-blue text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              待支付 ({orders.filter(o => o.status.toLowerCase() === 'pending').length})
            </button>
            <button
              onClick={() => setFilter('in_transit')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                filter === 'in_transit'
                  ? 'bg-primary-blue text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              运输中 ({orders.filter(o => o.status.toLowerCase() === 'in_transit').length})
            </button>
            <button
              onClick={() => setFilter('delivered')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                filter === 'delivered'
                  ? 'bg-primary-blue text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              已送达 ({orders.filter(o => o.status.toLowerCase() === 'delivered').length})
            </button>
          </div>
          
          <Link
            to="/order/new"
            className="px-6 py-2 bg-primary-blue text-white rounded-md font-medium hover:bg-blue-600 transition-colors"
          >
            创建新订单
          </Link>
        </div>

        {/* 订单列表 */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">暂无订单</h3>
            <p className="text-gray-500 mb-6">
              {filter === 'all' ? '您还没有创建任何订单' : '该状态下暂无订单'}
            </p>
            {filter === 'all' && (
              <Link
                to="/order/new"
                className="inline-block px-6 py-3 bg-primary-blue text-white rounded-md font-medium hover:bg-blue-600 transition-colors"
              >
                创建第一个订单
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div
                key={order.orderId}
                onClick={() => navigate(`/order/${order.orderId}`)}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(order.status)}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          订单 #{order.orderId.slice(0, 8)}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {new Date(order.createdAt).toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700 mb-2">
                        {getStatusText(order.status)}
                      </span>
                      <p className="text-lg font-bold text-gray-900">
                        {order.currency} {order.totalAmount.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">发件人</p>
                      <p className="text-sm font-medium text-gray-900">{order.senderName}</p>
                      <p className="text-xs text-gray-600 truncate">{order.senderAddress}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">收件人</p>
                      <p className="text-sm font-medium text-gray-900">{order.receiverName}</p>
                      <p className="text-xs text-gray-600 truncate">
                        {order.receiverCountry} - {order.receiverAddress}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">运输方式</p>
                      <p className="text-sm font-medium text-gray-900">
                        {getShipmentTypeText(order.shipmentType)}
                      </p>
                      <p className="text-xs text-gray-600">{order.weight} kg</p>
                    </div>
                  </div>

                  {order.shipment && (
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          运单号: <span className="font-mono font-medium">{order.shipment.trackingNumber}</span>
                        </span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  )}

                  {!order.shipment && order.status.toLowerCase() === 'pending' && (
                    <div className="pt-4 border-t border-gray-100">
                      <Link
                        to={`/payment/${order.orderId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-block px-4 py-2 bg-accent-coral text-white rounded-md text-sm font-medium hover:bg-red-600 transition-colors"
                      >
                        立即支付
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Orders;
