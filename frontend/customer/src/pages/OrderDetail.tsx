import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { quickOrderApi, paymentCollectionApi, uploadApi } from '../lib/api';
import { fetchWithAuth } from '../lib/fetchWithAuth';
import type { QuickOrder, QuickOrderDeclaration, PaymentCollection, PaymentVoucher } from '../lib/api';
import { subscribeToTracking } from '../lib/socket';
import {
  Package,
  MapPin,
  Clock,
  User,
  ArrowLeft,
  CheckCircle,
  DollarSign,
  FileText,
  Eye,
  X,
  File,
  Image as ImageIcon,
  FileBadge,
} from 'lucide-react';

const OrderDetail: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [order, setOrder] = useState<QuickOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentCollection, setPaymentCollection] = useState<PaymentCollection | null>(null);
  const [editingDecls, setEditingDecls] = useState<Array<QuickOrderDeclaration & { id: string; _key: number; _receivableCur: 'CNY' | 'PHP'; _payableCur: 'CNY' | 'PHP' }>>([]);
  const [declsChanged, setDeclsChanged] = useState(false);
  const [savingDecls, setSavingDecls] = useState(false);
  const [previewVoucher, setPreviewVoucher] = useState<PaymentVoucher | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blobLoading, setBlobLoading] = useState(false);
  const [blobType, setBlobType] = useState<string | null>(null);
  const [uploadingVoucher, setUploadingVoucher] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [deletingVoucherId, setDeletingVoucherId] = useState<string | null>(null);
  const [editingVoyage, setEditingVoyage] = useState(false);
  const [voyageInput, setVoyageInput] = useState('');
  const [savingVoyage, setSavingVoyage] = useState(false);
  const voucherInputRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!orderId) return;

    const fetchOrder = async () => {
      try {
        const { data } = await quickOrderApi.getDetail(orderId);
        setOrder(data);
        setEditingDecls((data.declarations || []).map((d: QuickOrderDeclaration & { id: string }, i: number) => ({
          ...d,
          _key: i,
          _receivableCur: (d.phpUnitPrice != null ? 'PHP' : 'CNY') as 'CNY' | 'PHP',
          _payableCur: (d.channelUnitPricePhp != null ? 'PHP' : 'CNY') as 'CNY' | 'PHP',
        })));

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
      return;
    }

    const fetchPaymentCollection = async () => {
      try {
        const { data } = await paymentCollectionApi.getByOrderId(orderId);
        setPaymentCollection(data);
      } catch {
        setPaymentCollection(null);
      }
    };

    fetchPaymentCollection();
  }, [orderId, user.userRole]);

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
        const res = await fetchWithAuth(`/api/vouchers/${previewVoucher.id}`, {
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
    const res = await fetchWithAuth(`/api/vouchers/${voucher.id}`);
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
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-500 bg-gray-50">船号/航次</td>
                    <td className="px-4 py-3 text-sm text-gray-900" colSpan={3}>
                      {editingVoyage ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={voyageInput}
                            onChange={e => setVoyageInput(e.target.value)}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                          />
                          <button
                            disabled={savingVoyage}
                            onClick={async () => {
                              if (!orderId) return;
                              setSavingVoyage(true);
                              try {
                                await quickOrderApi.update(orderId, { voyageNumber: voyageInput });
                                setOrder(prev => prev ? { ...prev, voyageNumber: voyageInput } : prev);
                                setEditingVoyage(false);
                                toast.success('船号已保存');
                              } catch {
                                toast.error('保存失败，请重试');
                              } finally {
                                setSavingVoyage(false);
                              }
                            }}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            {savingVoyage ? '保存中...' : '保存'}
                          </button>
                          <button
                            onClick={() => setEditingVoyage(false)}
                            className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 transition-colors"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>{order.voyageNumber || '-'}</span>
                          <button
                            onClick={() => { setVoyageInput(order.voyageNumber || ''); setEditingVoyage(true); }}
                            className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            编辑
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
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
                   {order.receivedAt && (
                     <tr>
                       <td className="px-4 py-3 text-sm font-medium text-gray-500 bg-gray-50">签收时间</td>
                       <td className="px-4 py-3 text-sm text-gray-900" colSpan={3}>
                         {new Date(order.receivedAt).toLocaleString('zh-CN')}
                       </td>
                     </tr>
                   )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-400" />
              海外收件人信息
            </h2>
            <div className="overflow-x-auto rounded-lg border border-gray-300">
              <table className="w-full border-collapse">
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-500 bg-gray-50 w-1/4">海外收件人</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{order.overseasAddress?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-500 bg-gray-50 w-1/4">手机号码</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{order.overseasAddress?.phone || '-'}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-500 bg-gray-50">公司名称</td>
                    <td className="px-4 py-3 text-sm text-gray-900" colSpan={3}>{order.overseasAddress?.company || '-'}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-500 bg-gray-50">所在地区</td>
                    <td className="px-4 py-3 text-sm text-gray-900" colSpan={3}>{order.overseasAddress?.region || '-'}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-500 bg-gray-50">详细地址</td>
                    <td className="px-4 py-3 text-sm text-gray-900" colSpan={3}>{order.overseasAddress?.address || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Package className="w-5 h-5 text-gray-400" />
                  申报信息
                </h2>
                {declsChanged && (
                  <button
                    disabled={savingDecls}
                    onClick={async () => {
                      if (!orderId) return;
                      setSavingDecls(true);
                      try {
                        const payload = editingDecls.map(({ _key, id: _id, ...rest }) => rest);
                        const { data } = await quickOrderApi.updateDeclarations(orderId, payload);
                        const mapped = (data as Array<QuickOrderDeclaration & { id: string }>).map((d, i) => ({ ...d, _key: i }));
                        setEditingDecls(mapped);
                        setOrder(prev => prev ? { ...prev, declarations: data as Array<QuickOrderDeclaration & { id: string }> } : prev);
                        setDeclsChanged(false);
                        toast.success('申报信息已保存');
                      } catch {
                        toast.error('保存失败，请重试');
                      } finally {
                        setSavingDecls(false);
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {savingDecls ? '保存中...' : '保存修改'}
                  </button>
                )}
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-300">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center">序号</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-left">快递单号</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-left">品名</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center">件数</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center">长(cm)</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center">宽(cm)</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center">高(cm)</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center">单件重量(kg)</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center">体积(m³)</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center">应收单价</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center">应付单价</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {editingDecls.map((decl, index) => (
                      <tr key={decl._key} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900 text-center">{index + 1}</td>
                        <td className="px-4 py-3 text-sm">
                          <input
                            type="text"
                            value={decl.trackingNumber || ''}
                            onChange={e => { const v = e.target.value; setEditingDecls(prev => prev.map((d, i) => i === index ? { ...d, trackingNumber: v } : d)); setDeclsChanged(true); }}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <input
                            type="text"
                            value={decl.productName}
                            onChange={e => { const v = e.target.value; setEditingDecls(prev => prev.map((d, i) => i === index ? { ...d, productName: v } : d)); setDeclsChanged(true); }}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <input
                            type="number"
                            value={decl.quantity}
                            onChange={e => { const v = Number(e.target.value); setEditingDecls(prev => prev.map((d, i) => i === index ? { ...d, quantity: v } : d)); setDeclsChanged(true); }}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <input
                            type="number"
                            value={decl.length ?? ''}
                            onChange={e => { const v = e.target.value === '' ? undefined : Number(e.target.value); setEditingDecls(prev => prev.map((d, i) => i === index ? { ...d, length: v } : d)); setDeclsChanged(true); }}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <input
                            type="number"
                            value={decl.width ?? ''}
                            onChange={e => { const v = e.target.value === '' ? undefined : Number(e.target.value); setEditingDecls(prev => prev.map((d, i) => i === index ? { ...d, width: v } : d)); setDeclsChanged(true); }}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <input
                            type="number"
                            value={decl.height ?? ''}
                            onChange={e => { const v = e.target.value === '' ? undefined : Number(e.target.value); setEditingDecls(prev => prev.map((d, i) => i === index ? { ...d, height: v } : d)); setDeclsChanged(true); }}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <input
                            type="number"
                            value={decl.weight}
                            onChange={e => { const v = Number(e.target.value); setEditingDecls(prev => prev.map((d, i) => i === index ? { ...d, weight: v } : d)); setDeclsChanged(true); }}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-center">
                          {decl.length && decl.width && decl.height
                            ? ((decl.length * decl.width * decl.height / 1000000) * decl.quantity).toFixed(4)
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex gap-1">
                            <select
                              value={decl._receivableCur}
                              onChange={e => {
                                const cur = e.target.value as 'CNY' | 'PHP';
                                setEditingDecls(prev => prev.map((d, i) => i === index ? { ...d, _receivableCur: cur, cnyUnitPrice: undefined, phpUnitPrice: undefined } : d));
                                setDeclsChanged(true);
                              }}
                              className="px-1 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-14"
                            >
                              <option value="CNY">¥</option>
                              <option value="PHP">₱</option>
                            </select>
                            <input
                              type="number"
                              value={decl._receivableCur === 'PHP' ? (decl.phpUnitPrice ?? '') : (decl.cnyUnitPrice ?? '')}
                              onChange={e => {
                                const v = e.target.value === '' ? undefined : Number(e.target.value);
                                setEditingDecls(prev => prev.map((d, i) => i === index
                                  ? decl._receivableCur === 'PHP'
                                    ? { ...d, phpUnitPrice: v, cnyUnitPrice: undefined }
                                    : { ...d, cnyUnitPrice: v, phpUnitPrice: undefined }
                                  : d));
                                setDeclsChanged(true);
                              }}
                              className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex gap-1">
                            <select
                              value={decl._payableCur}
                              onChange={e => {
                                const cur = e.target.value as 'CNY' | 'PHP';
                                setEditingDecls(prev => prev.map((d, i) => i === index ? { ...d, _payableCur: cur, channelUnitPricePhp: undefined, channelUnitPriceCny: undefined } : d));
                                setDeclsChanged(true);
                              }}
                              className="px-1 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-14"
                            >
                              <option value="CNY">¥</option>
                              <option value="PHP">₱</option>
                            </select>
                            <input
                              type="number"
                              value={decl._payableCur === 'PHP' ? (decl.channelUnitPricePhp ?? '') : (decl.channelUnitPriceCny ?? '')}
                              onChange={e => {
                                const v = e.target.value === '' ? undefined : Number(e.target.value);
                                setEditingDecls(prev => prev.map((d, i) => i === index
                                  ? decl._payableCur === 'PHP'
                                    ? { ...d, channelUnitPricePhp: v, channelUnitPriceCny: undefined }
                                    : { ...d, channelUnitPriceCny: v, channelUnitPricePhp: undefined }
                                  : d));
                                setDeclsChanged(true);
                              }}
                              className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <button
                            onClick={() => {
                              if (!window.confirm('确认删除该申报明细？')) return;
                              setEditingDecls(prev => prev.filter((_, i) => i !== index));
                              setDeclsChanged(true);
                            }}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => {
                  setEditingDecls(prev => [...prev, { id: '', _key: Date.now(), trackingNumber: '', productName: '', quantity: 1, weight: 0, _receivableCur: 'CNY', _payableCur: 'CNY' }]);
                  setDeclsChanged(true);
                }}
                className="mt-3 px-4 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors w-full"
              >
                ＋ 添加明细
              </button>
            </div>

          {(() => {
            const decls = editingDecls;
            const totalPieces = decls.reduce((sum, d) => sum + (d.quantity || 0), 0);
            const volM3 = (d: typeof decls[0]) =>
              d.length && d.width && d.height
                ? (d.length * d.width * d.height) / 1_000_000
                : 0;
            const totalWeight = decls.reduce((sum, d) => sum + (d.weight || 0) * (d.quantity || 0), 0);
            const receivableUsePhp = decls.some(d => !!d.phpUnitPrice);
            const payableUsePhp = decls.some(d => !!d.channelUnitPricePhp);
            const isSeaLcl = order.orderType === 'SEA_LCL';
            const totalReceivable = decls.reduce((sum, d) => {
              const price = receivableUsePhp ? (d.phpUnitPrice || 0) : (d.cnyUnitPrice || 0);
              const factor = isSeaLcl ? volM3(d) : (d.weight || 0);
              return sum + price * factor * (d.quantity || 0);
            }, 0);
            const totalPayable = decls.reduce((sum, d) => {
              const price = payableUsePhp ? (d.channelUnitPricePhp || 0) : (d.channelUnitPriceCny || 0);
              const factor = isSeaLcl ? volM3(d) : (d.weight || 0);
              return sum + price * factor * (d.quantity || 0);
            }, 0);
            const receivableSymbol = receivableUsePhp ? '₱' : '¥';
            const payableSymbol = payableUsePhp ? '₱' : '¥';
            return (
              <div className="px-6 py-4 border-t border-gray-100">
                <div className="grid grid-cols-4 gap-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                  <div>
                    <span className="text-gray-500">总件数</span>
                    <p className="text-lg font-semibold text-gray-900 mt-1">{totalPieces} 件</p>
                  </div>
                  <div>
                    <span className="text-gray-500">总重量</span>
                    <p className="text-lg font-semibold text-gray-900 mt-1">{totalWeight.toFixed(2)} kg</p>
                  </div>
                  <div>
                    <span className="text-gray-500">应收总价</span>
                    <p className="text-lg font-semibold text-blue-600 mt-1">
                      {totalReceivable > 0 ? `${receivableSymbol}${totalReceivable.toFixed(2)}` : '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">应付总价</span>
                    <p className="text-lg font-semibold text-orange-600 mt-1">
                      {totalPayable > 0 ? `${payableSymbol}${totalPayable.toFixed(2)}` : '-'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {user.userRole === 'ADMIN' && (
            <div className="px-6 py-4 border-t border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <DollarSign className="w-5 h-5 text-gray-400" />
                订单收款记录
              </h2>
              {!paymentCollection ? (
                <div className="text-center py-8 text-gray-500">暂无收款记录</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  {[
                    { label: '总件数', value: `${paymentCollection.totalPieces} 件` },
                    { label: '总体积', value: paymentCollection.totalVolume != null ? `${paymentCollection.totalVolume.toFixed(4)} m³` : '-' },
                    { label: '总重量', value: paymentCollection.totalWeight != null ? `${paymentCollection.totalWeight.toFixed(3)} kg` : '-' },
                    { label: '应收总价', value: paymentCollection.receivableAmount != null ? `${paymentCollection.receivableCurrency === 'PHP' ? '₱' : '¥'}${paymentCollection.receivableAmount.toFixed(2)}` : '-', highlight: 'blue' },
                    { label: '应付总价', value: paymentCollection.payableAmount != null ? `${paymentCollection.payableCurrency === 'PHP' ? '₱' : '¥'}${paymentCollection.payableAmount.toFixed(2)}` : '-', highlight: 'orange' },
                    { label: '应收叫车费', value: paymentCollection.carPickupReceivable != null ? `¥${paymentCollection.carPickupReceivable.toFixed(2)}` : '-' },
                    { label: '应付叫车费', value: paymentCollection.carPickupActual != null ? `¥${paymentCollection.carPickupActual.toFixed(2)}` : '-' },
                  ].map(({ label, value, highlight }) => (
                    <div key={label}>
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className={`text-base font-semibold mt-0.5 ${highlight === 'blue' ? 'text-blue-600' : highlight === 'orange' ? 'text-orange-600' : 'text-gray-900'}`}>{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="px-6 py-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" />
                收件凭证
              </h2>
              <button
                onClick={() => receiptInputRef.current?.click()}
                disabled={uploadingReceipt}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {uploadingReceipt ? '上传中...' : '上传凭证'}
              </button>
              <input
                ref={receiptInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !orderId) return;
                  setUploadingReceipt(true);
                  try {
                    const { data: uploaded } = await uploadApi.uploadReceipt(file);
                    const { data: voucher } = await quickOrderApi.addPaymentVoucher(orderId, uploaded.fileUrl, uploaded.fileName, uploaded.fileType, 'RECEIPT');
                    setOrder(prev => prev ? { ...prev, paymentVouchers: [...(prev.paymentVouchers || []), voucher] } : prev);
                    toast.success('凭证上传成功');
                  } catch {
                    toast.error('上传失败，请重试');
                  } finally {
                    setUploadingReceipt(false);
                    e.target.value = '';
                  }
                }}
              />
            </div>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">文件名称</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">上传时间</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {order.paymentVouchers?.filter(v => v.voucherType === 'RECEIPT').length ? (
                    order.paymentVouchers.filter(v => v.voucherType === 'RECEIPT').map((voucher) => (
                       <tr key={voucher.id} className="hover:bg-gray-50">
                         <td className="px-4 py-3 text-sm text-gray-900">{voucher.fileName || '收件凭证'}</td>
                         <td className="px-4 py-3 text-sm text-gray-600">{new Date(voucher.uploadedAt).toLocaleDateString('zh-CN')}</td>
                         <td className="px-4 py-3 text-sm">
                           <div className="flex items-center gap-3">
                             <button onClick={() => setPreviewVoucher(voucher)} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors">
                               <Eye className="w-4 h-4" />查看
                             </button>
                             <button
                               disabled={deletingVoucherId === voucher.id}
                               onClick={async () => {
                                 if (!window.confirm('确认删除该凭证？删除后不可恢复。')) return;
                                 setDeletingVoucherId(voucher.id);
                                 try {
                                   await paymentCollectionApi.deleteVoucher(voucher.id);
                                   setOrder(prev => prev ? { ...prev, paymentVouchers: prev.paymentVouchers?.filter(v => v.id !== voucher.id) } : prev);
                                   toast.success('凭证已删除');
                                 } catch {
                                   toast.error('删除失败，请重试');
                                 } finally {
                                   setDeletingVoucherId(null);
                                 }
                               }}
                               className="flex items-center gap-1 text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                             >
                               {deletingVoucherId === voucher.id ? '删除中...' : '删除'}
                             </button>
                           </div>
                         </td>
                       </tr>
                    ))
                  ) : (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500">暂无收件凭证</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" />
                付款凭证
              </h2>
              <button
                onClick={() => voucherInputRef.current?.click()}
                disabled={uploadingVoucher}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {uploadingVoucher ? '上传中...' : '上传凭证'}
              </button>
              <input
                ref={voucherInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !orderId) return;
                  setUploadingVoucher(true);
                  try {
                    const { data: uploaded } = await uploadApi.uploadPaymentVoucher(file);
                    const { data: voucher } = await quickOrderApi.addPaymentVoucher(orderId, uploaded.fileUrl, uploaded.fileName, uploaded.fileType);
                    setOrder(prev => prev ? { ...prev, paymentVouchers: [...(prev.paymentVouchers || []), voucher] } : prev);
                    toast.success('凭证上传成功');
                  } catch {
                    toast.error('上传失败，请重试');
                  } finally {
                    setUploadingVoucher(false);
                    e.target.value = '';
                  }
                }}
              />
            </div>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">文件名称</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">上传时间</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {order.paymentVouchers?.filter(v => v.voucherType !== 'RECEIPT').length ? (
                    order.paymentVouchers.filter(v => v.voucherType !== 'RECEIPT').map((voucher) => (
                       <tr key={voucher.id} className="hover:bg-gray-50">
                         <td className="px-4 py-3 text-sm text-gray-900">{voucher.fileName || '付款凭证'}</td>
                         <td className="px-4 py-3 text-sm text-gray-600">{new Date(voucher.uploadedAt).toLocaleDateString('zh-CN')}</td>
                         <td className="px-4 py-3 text-sm">
                           <div className="flex items-center gap-3">
                             <button onClick={() => setPreviewVoucher(voucher)} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors">
                               <Eye className="w-4 h-4" />查看
                             </button>
                             <button
                               disabled={deletingVoucherId === voucher.id}
                               onClick={async () => {
                                 if (!window.confirm('确认删除该凭证？删除后不可恢复。')) return;
                                 setDeletingVoucherId(voucher.id);
                                 try {
                                   await paymentCollectionApi.deleteVoucher(voucher.id);
                                   setOrder(prev => prev ? { ...prev, paymentVouchers: prev.paymentVouchers?.filter(v => v.id !== voucher.id) } : prev);
                                   toast.success('凭证已删除');
                                 } catch {
                                   toast.error('删除失败，请重试');
                                 } finally {
                                   setDeletingVoucherId(null);
                                 }
                               }}
                               className="flex items-center gap-1 text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                             >
                               {deletingVoucherId === voucher.id ? '删除中...' : '删除'}
                             </button>
                           </div>
                         </td>
                       </tr>
                    ))
                  ) : (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500">暂无付款凭证记录</td></tr>
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

export default OrderDetail;
