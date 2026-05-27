import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Search, Edit, X } from 'lucide-react';
import { quickOrderApi, paymentCollectionApi } from '../lib/api';
import type { QuickOrder, PaymentCollection } from '../lib/api';
import { fetchWithAuth } from '../lib/fetchWithAuth';

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    SEA_LCL: '海运拼柜',
    AIR: '空运快递',
    LAND: '陆运装车',
    BATCH: '批量导入拼柜',
    SEA_FCL: '海运整柜',
    PARCEL: '拼邮快递',
  };
  return labels[type] || type;
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    PENDING: '待审核',
    CONFIRMED: '已确认',
    IN_TRANSIT: '运输中',
    DELIVERED: '已送达',
    CANCELLED: '已取消',
  };
  return labels[status] || status;
};

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    CONFIRMED: 'bg-blue-100 text-blue-800',
    IN_TRANSIT: 'bg-purple-100 text-purple-800',
    DELIVERED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

const calculateWeight = (order: any) => {
  if (!order.declarations || order.declarations.length === 0) return '-';
  const total = order.declarations.reduce((sum: number, d: any) => sum + (Number(d.weight) || 0), 0);
  return `${total.toFixed(2)}kg`;
};

const calculateVolume = (order: any) => {
  if (!order.declarations || order.declarations.length === 0) return '-';
  const total = order.declarations.reduce((sum: number, d: any) => {
    const l = Number(d.length) || 0;
    const w = Number(d.width) || 0;
    const h = Number(d.height) || 0;
    return sum + (l * w * h / 1000000);
  }, 0);
  return total > 0 ? `${total.toFixed(3)}m³` : '-';
};

export default function AdminOrderManagement() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<QuickOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCollection, setEditingCollection] = useState<PaymentCollection | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [filters, setFilters] = useState({
    keyword: '',
    page: 1,
    limit: 20,
  });
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });

  const [editForm, setEditForm] = useState({
    carPickupReceivable: 0,
    carPickupActual: 0,
  });

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (user.userRole !== 'ADMIN') {
    navigate('/');
    return null;
  }

  useEffect(() => {
    loadOrders();
  }, [filters.page]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await quickOrderApi.getList({
        searchType: 'orderNumber',
        keyword: filters.keyword || undefined,
        page: filters.page,
        limit: filters.limit,
      });
      setOrders(response.data.data);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to load orders:', error);
      toast.error('加载订单失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setFilters({ ...filters, page: 1 });
    loadOrders();
  };

  const handleEdit = async (orderId: string) => {
    try {
      const response = await paymentCollectionApi.getByOrderId(orderId);
      const collection = response.data;
      setEditingCollection(collection);
      setEditForm({
        carPickupReceivable: collection.carPickupReceivable ?? 0,
        carPickupActual: collection.carPickupActual ?? 0,
      });
      setShowEditModal(true);
    } catch {
      toast.error('未找到收款记录');
    }
  };

  const handleSave = async () => {
    if (!editingCollection) return;
    try {
      await paymentCollectionApi.upsert(editingCollection.orderId, {
        totalPieces: editingCollection.totalPieces,
        totalVolume: editingCollection.totalVolume ?? undefined,
        totalWeight: editingCollection.totalWeight ?? undefined,
        receivableAmount: editingCollection.receivableAmount,
        payableAmount: editingCollection.payableAmount,
        receivableCurrency: editingCollection.receivableCurrency,
        payableCurrency: editingCollection.payableCurrency,
        carPickupReceivable: editForm.carPickupReceivable || undefined,
        carPickupActual: editForm.carPickupActual || undefined,
      });
      toast.success('收款信息已更新');
      setShowEditModal(false);
      loadOrders();
    } catch {
      toast.error('更新失败');
    }
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingCollection(null);
  };

  if (loading && orders.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">订单收款管理（管理员专用）</h1>

          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="搜索订单号..."
                value={filters.keyword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters({ ...filters, keyword: e.target.value })}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <button
              onClick={handleSearch}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition"
            >
              <Search className="w-5 h-5" />
              搜索
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">唛头</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">入仓单号</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">品名</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">快递数量</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">订柜箱型</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">重量</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">体积</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">仓库</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">目的地</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">运输方式</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">订单状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">订单类型</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">下单时间</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-6 py-8 text-center text-gray-500">
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr 
                      key={order.orderId} 
                      onClick={() => navigate(`/order/${order.orderId}`, { state: { from: '/admin/order-management' } })}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.userMark || order.mark || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                        {order.orderNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.declarations?.[0]?.productName || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.declarations?.filter(d => d.trackingNumber).length > 0
                          ? `${order.declarations.filter(d => d.trackingNumber).length}个`
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.containers?.[0]?.containerType || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {calculateWeight(order)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {calculateVolume(order)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.warehouse || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.destination}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getTypeLabel(order.orderType)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getTypeLabel(order.orderType)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                      </td>
                    </tr>
                   ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              共 {pagination.total} 条记录，第 {pagination.page} / {pagination.totalPages} 页
            </div>
            <div className="flex gap-2">
              <button
                disabled={pagination.page === 1}
                onClick={() => setFilters({ ...filters, page: pagination.page - 1 })}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                上一页
              </button>
              <button
                disabled={pagination.page === pagination.totalPages}
                onClick={() => setFilters({ ...filters, page: pagination.page + 1 })}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      </div>

      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">编辑收款信息</h2>
              <button
                onClick={closeEditModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editingCollection && (
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg text-sm">
                  {[
                    { label: '订单编号', value: editingCollection.order?.orderNumber || '-' },
                    { label: '总件数', value: `${editingCollection.totalPieces} 件` },
                    { label: '总重量', value: editingCollection.totalWeight != null ? `${editingCollection.totalWeight.toFixed(3)} kg` : '-' },
                    { label: '应收总价', value: `${editingCollection.receivableCurrency === 'PHP' ? '₱' : '¥'}${editingCollection.receivableAmount.toFixed(2)}` },
                    { label: '应付总价', value: `${editingCollection.payableCurrency === 'PHP' ? '₱' : '¥'}${editingCollection.payableAmount.toFixed(2)}` },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="font-medium text-gray-900 mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">应收叫车费 (¥)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.carPickupReceivable}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, carPickupReceivable: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">实收叫车费 (¥)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.carPickupActual}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, carPickupActual: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={closeEditModal}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
