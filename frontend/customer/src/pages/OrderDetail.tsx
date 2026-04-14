import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { quickOrderApi, paymentCollectionApi } from '../lib/api';
import type { QuickOrder, PaymentCollection } from '../lib/api';
import { subscribeToTracking } from '../lib/socket';
import {
  Package,
  MapPin,
  Clock,
  User,
  ArrowLeft,
  CheckCircle,
  DollarSign,
} from 'lucide-react';

const OrderDetail: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<QuickOrder | null>(null);
  const [paymentCollections, setPaymentCollections] = useState<PaymentCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

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

  useEffect(() => {
    if (!orderId || user.userRole !== 'ADMIN') {
      setLoadingPayments(false);
      return;
    }

    const fetchPaymentCollections = async () => {
      try {
        const { data } = await paymentCollectionApi.getAll({ orderId });
        setPaymentCollections(data.data);
      } catch (error) {
        console.error('获取收款记录失败:', error);
      } finally {
        setLoadingPayments(false);
      }
    };

    fetchPaymentCollections();
  }, [orderId, user.userRole]);

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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>返回</span>
        </button>

        <div className="bg-white rounded-lg shadow-sm mb-6">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                订单详情 #{order.orderNumber}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                创建时间: {new Date(order.createdAt).toLocaleDateString('zh-CN', {
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

          {/* 订单基本信息表格 */}
          <div className="px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Package className="w-5 h-5 text-gray-400" />
              订单信息
            </h2>
            <div className="overflow-x-auto rounded-lg border border-gray-300">
              <table className="w-full border-collapse">
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-500 bg-gray-50 w-1/4">订单类型</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{getOrderTypeText(order.orderType)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-500 bg-gray-50 w-1/4">目的地</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{order.destination}</td>
                  </tr>
                  {order.warehouse && (
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-500 bg-gray-50">仓库</td>
                      <td className="px-4 py-3 text-sm text-gray-900" colSpan={3}>{order.warehouse}</td>
                    </tr>
                  )}
                  {order.userMark && (
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-500 bg-gray-50">用户唛头</td>
                      <td className="px-4 py-3 text-sm text-gray-900" colSpan={3}>{order.userMark}</td>
                    </tr>
                  )}
                  {order.declarations && order.declarations.some(d => d.trackingNumber) && (
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-500 bg-gray-50 align-top">包裹快递单号</td>
                      <td className="px-4 py-3 text-sm text-gray-900" colSpan={3}>
                        <div className="space-y-1">
                          {order.declarations
                            .filter(d => d.trackingNumber)
                            .map((decl) => (
                              <div key={decl.id} className="font-mono text-sm">
                                {decl.trackingNumber}
                              </div>
                            ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 提货人信息表格 */}
          {order.pickupAddress && (
            <div className="px-6 py-4 border-t border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <User className="w-5 h-5 text-gray-400" />
                提货人信息
              </h2>
              <div className="overflow-x-auto rounded-lg border border-gray-300">
                <table className="w-full border-collapse">
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-500 bg-gray-50 w-1/4">联系人</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{order.pickupAddress.name}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-500 bg-gray-50 w-1/4">手机号码</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{order.pickupAddress.phone}</td>
                    </tr>
                    {order.pickupAddress.company && (
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-500 bg-gray-50">公司名称</td>
                        <td className="px-4 py-3 text-sm text-gray-900" colSpan={3}>{order.pickupAddress.company}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-500 bg-gray-50">所在地区</td>
                      <td className="px-4 py-3 text-sm text-gray-900" colSpan={3}>
                        {order.pickupAddress.region || '-'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-500 bg-gray-50">详细地址</td>
                      <td className="px-4 py-3 text-sm text-gray-900" colSpan={3}>{order.pickupAddress.address}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 收件人信息表格 */}
          <div className="px-6 py-4 border-t border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-gray-400" />
              收件人信息
            </h2>
            <div className="overflow-x-auto rounded-lg border border-gray-300">
              <table className="w-full border-collapse">
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-500 bg-gray-50 w-1/4">收件人</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{order.recipientAddress.name}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-500 bg-gray-50 w-1/4">手机号码</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{order.recipientAddress.phone}</td>
                  </tr>
                  {order.recipientAddress.company && (
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-500 bg-gray-50">公司名称</td>
                      <td className="px-4 py-3 text-sm text-gray-900" colSpan={3}>{order.recipientAddress.company}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-500 bg-gray-50">所在地区</td>
                    <td className="px-4 py-3 text-sm text-gray-900" colSpan={3}>
                      {order.recipientAddress.region || '-'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-500 bg-gray-50">详细地址</td>
                    <td className="px-4 py-3 text-sm text-gray-900" colSpan={3}>{order.recipientAddress.address}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 申报信息表格 */}
          {order.declarations && order.declarations.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Package className="w-5 h-5 text-gray-400" />
                申报信息
              </h2>
              <div className="overflow-x-auto rounded-lg border border-gray-300">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center">序号</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-left">快递单号</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-left">品名</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center">尺寸(cm)</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center">件数</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center">数量</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center">重量(kg)</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center">单价(￥)</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center">单价(₱)</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {order.declarations.map((decl, index) => (
                      <tr key={decl.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900 text-center">{index + 1}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-mono">{decl.trackingNumber || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{decl.productName}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-center">
                          {decl.length && decl.width && decl.height 
                            ? `${decl.length}×${decl.width}×${decl.height}` 
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-center">{decl.outerQuantity || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-center">{decl.innerQuantity || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-center">{decl.weight}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-center">{decl.cnyUnitPrice || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-center">{decl.phpUnitPrice || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {user.userRole === 'ADMIN' && !loadingPayments && paymentCollections.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-gray-400" />
                订单收款记录
              </h2>
              <div className="overflow-x-auto rounded-lg border border-gray-300">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-left">品名</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center">渠道单价(₱)</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center">应收运费(¥)</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center">应收其他(¥)</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center">实收金额(¥)</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center">渠道运费成本(¥)</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center">渠道其他成本(¥)</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center">利润(¥)</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paymentCollections.map((collection) => (
                      <tr key={collection.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {collection.declaration?.productName || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-center">
                          ₱{collection.channelUnitPricePhp.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-center">
                          ¥{collection.receivableFreightAmount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-center">
                          ¥{collection.receivableOtherAmount?.toFixed(2) || '0.00'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-center font-semibold">
                          ¥{collection.actualReceivedAmount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-center">
                          ¥{collection.channelFreightCost?.toFixed(2) || '0.00'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr className="font-semibold">
                      <td className="px-4 py-3 text-sm text-gray-900">合计</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-center">-</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-center">
                        ¥{paymentCollections.reduce((sum, c) => sum + c.receivableFreightAmount, 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-center">
                        ¥{paymentCollections.reduce((sum, c) => sum + (c.receivableOtherAmount || 0), 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-center font-bold text-primary">
                        ¥{paymentCollections.reduce((sum, c) => sum + c.actualReceivedAmount, 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-center">
                        ¥{paymentCollections.reduce((sum, c) => sum + (c.channelFreightCost || 0), 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-center">
                        ¥{paymentCollections.reduce((sum, c) => sum + (c.channelOtherCost || 0), 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className={`font-bold ${
                          paymentCollections.reduce((sum, c) => sum + (c.profit || 0), 0) >= 0 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          ¥{paymentCollections.reduce((sum, c) => sum + (c.profit || 0), 0).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
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
