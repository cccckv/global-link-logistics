import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Search, Edit, X } from 'lucide-react';
import { quickOrderApi, paymentCollectionApi } from '../lib/api';
import type { QuickOrder, PaymentCollection } from '../lib/api';

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
    channelUnitPricePhp: 0,
    receivableFreightAmount: 0,
    receivableOtherAmount: 0,
    actualReceivedAmount: 0,
    channelFreightCost: 0,
    channelOtherCost: 0,
    profit: 0,
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
      const response = await paymentCollectionApi.getAll({ orderId });
      const collections = response.data.data;
      if (collections.length > 0) {
        const collection = collections[0];
        setEditingCollection(collection);
        setEditForm({
          channelUnitPricePhp: collection.channelUnitPricePhp,
          receivableFreightAmount: collection.receivableFreightAmount,
          receivableOtherAmount: collection.receivableOtherAmount,
          actualReceivedAmount: collection.actualReceivedAmount,
          channelFreightCost: collection.channelFreightCost,
          channelOtherCost: collection.channelOtherCost,
          profit: collection.profit,
        });
        setShowEditModal(true);
      } else {
        toast.error('未找到收款记录');
      }
    } catch (error) {
      console.error('Failed to load payment collection:', error);
      toast.error('加载收款信息失败');
    }
  };

  const handleSave = async () => {
    if (!editingCollection) return;

    try {
      await paymentCollectionApi.update(editingCollection.id, editForm);
      toast.success('收款信息已更新');
      setShowEditModal(false);
      loadOrders();
    } catch (error) {
      console.error('Failed to update payment collection:', error);
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
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-6 py-8 text-center text-gray-500">
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

      {/* Edit Modal */}
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">订单编号</label>
                    <input
                      type="text"
                      value={editingCollection.order?.orderNumber || 'N/A'}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">商品名称</label>
                    <input
                      type="text"
                      value={editingCollection.declaration?.productName || 'N/A'}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">渠道单价(₱) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.channelUnitPricePhp}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, channelUnitPricePhp: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">应收运费金额(¥)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.receivableFreightAmount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, receivableFreightAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">应收其他金额(¥)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.receivableOtherAmount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, receivableOtherAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">实收金额(¥)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.actualReceivedAmount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, actualReceivedAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">渠道运费成本(¥)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.channelFreightCost}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, channelFreightCost: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">渠道其他成本(¥)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.channelOtherCost}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, channelOtherCost: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">利润(¥)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.profit}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, profit: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {editingCollection.vouchers && editingCollection.vouchers.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">收款凭证</label>
                    <div className="space-y-2">
                      {editingCollection.vouchers.map((voucher: { id: string; fileUrl: string; fileName?: string; uploadedAt: string }) => (
                        <div key={voucher.id} className="flex items-center gap-2 text-sm">
                          <a
                            href={voucher.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {voucher.fileName || '查看凭证'}
                          </a>
                          <span className="text-gray-500">
                            {new Date(voucher.uploadedAt).toLocaleDateString('zh-CN')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
