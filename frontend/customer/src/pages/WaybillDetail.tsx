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
  ArrowLeft,
  CheckCircle,
  FileText,
  Eye,
  X,
  File,
  Image as ImageIcon,
  FileBadge,
} from 'lucide-react';

const WaybillDetail: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<QuickOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewVoucher, setPreviewVoucher] = useState<QuickOrder['paymentVouchers'][0] | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blobLoading, setBlobLoading] = useState(false);
  const [blobType, setBlobType] = useState<string | null>(null);
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

  useEffect(() => {
    if (!previewVoucher?.id) {
      setBlobUrl(null);
      return;
    }
    const controller = new AbortController();
    setBlobLoading(true);
    setBlobUrl(null);

    const loadBlob = async () => {
      try {
        const token = localStorage.getItem('jwt_token');
        const res = await fetch(`/api/vouchers/${previewVoucher.id}`, {
          headers: { Authorization: token ? `Bearer ${token}` : '' },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        setBlobType(blob.type);
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch {
        setBlobUrl(null);
      } finally {
        setBlobLoading(false);
      }
    };

    loadBlob();
    return () => {
      controller.abort();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewVoucher?.id]);

  const handleDownload = async (voucher: QuickOrder['paymentVouchers'][0]) => {
    const token = localStorage.getItem('jwt_token');
    const res = await fetch(`/api/vouchers/${voucher.id}`, {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = voucher.fileName || '凭证';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

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
                运单详情 #{order.orderNumber}
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
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center">体积(m³)</th>
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
                            ? ((decl.length * decl.width * decl.height) / 1000000).toFixed(4)
                            : '-'}
                        </td>
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

          <div className="px-6 py-4 border-t border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-400" />
              付款凭证
            </h2>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      文件名称
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      上传时间
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {order.paymentVouchers && order.paymentVouchers.length > 0 ? (
                    order.paymentVouchers.map((voucher) => (
                      <tr key={voucher.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {voucher.fileName || '付款凭证'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(voucher.uploadedAt).toLocaleDateString('zh-CN')}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => setPreviewVoucher(voucher)}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            查看
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500">
                        暂无付款凭证记录
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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

      {previewVoucher && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setPreviewVoucher(null)}
        >
          <div
            className="relative bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {blobType?.startsWith('image/') ? (
                  <ImageIcon className="w-5 h-5 text-blue-500 shrink-0" />
                ) : blobType === 'application/pdf' ? (
                  <FileBadge className="w-5 h-5 text-red-500 shrink-0" />
                ) : (
                  <File className="w-5 h-5 text-gray-500 shrink-0" />
                )}
                <span className="font-medium text-gray-900 truncate">
                  {previewVoucher.fileName || '付款凭证'}
                </span>
              </div>
              <button
                onClick={() => setPreviewVoucher(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 ml-3 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5 bg-gray-50 flex items-center justify-center min-h-[200px]">
              {blobLoading ? (
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">加载中...</span>
                </div>
              ) : blobType?.startsWith('image/') ? (
                blobUrl ? (
                  <img
                    src={blobUrl}
                    alt={previewVoucher.fileName || '付款凭证'}
                    className="max-w-full max-h-[65vh] mx-auto rounded-lg object-contain shadow"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <File className="w-12 h-12" />
                    <span className="text-sm">加载失败，请重试</span>
                  </div>
                )
              ) : blobType === 'application/pdf' ? (
                blobUrl ? (
                  <embed
                    src={blobUrl}
                    type="application/pdf"
                    className="w-full h-[65vh] rounded-lg"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <FileBadge className="w-12 h-12" />
                    <span className="text-sm">加载失败，请重试</span>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-[65vh] gap-4">
                  <File className="w-16 h-16 text-gray-300" />
                  <p className="text-gray-500 text-sm">此文件类型不支持在线预览</p>
                  <button
                    onClick={() => handleDownload(previewVoucher)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    下载文件
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-xs text-gray-500 shrink-0 bg-white">
              <span>
                {previewVoucher.fileSize
                  ? `${(previewVoucher.fileSize / 1024 / 1024).toFixed(2)} MB`
                  : ''}
              </span>
              <span>{new Date(previewVoucher.uploadedAt).toLocaleString('zh-CN')}</span>
              <button
                onClick={() => handleDownload(previewVoucher)}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
              >
                <FileText className="w-3.5 h-3.5" />
                下载
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WaybillDetail;
