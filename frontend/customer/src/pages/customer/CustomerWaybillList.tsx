import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { waybillV2Api, type Waybill, type ShipmentType, type WaybillStatus } from '../../lib/v2-api';
import {
  Package,
  Search,
  Ship,
  Plane,
  Truck,
  Box,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  Tag,
  MapPin,
} from 'lucide-react';
import { authApi } from '../../lib/api';

const STATUS_CONFIG: Record<
  WaybillStatus,
  { label: string; bg: string; text: string; border: string; icon: any }
> = {
  DRAFT: { label: '待入库', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', icon: Clock },
  INBOUND: { label: '已入库', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: Box },
  LOADED: { label: '已装柜/起飞', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', icon: Ship },
  IN_TRANSIT: { label: '在途运输中', bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', icon: Ship },
  CUSTOMS: { label: '目的港清关中', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: AlertCircle },
  DISPATCHING: { label: '海外派送中', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', icon: Truck },
  DELIVERED: { label: '已妥投签收', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
  CANCELLED: { label: '已取消', bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', icon: AlertCircle },
};

const SHIPMENT_TYPE_LABELS: Record<ShipmentType, { label: string; icon: any; color: string }> = {
  SEA_LCL: { label: '海运拼箱', icon: Ship, color: 'text-blue-600' },
  AIR: { label: '空运专线', icon: Plane, color: 'text-indigo-600' },
  SEA_FCL: { label: '海运整柜', icon: Ship, color: 'text-cyan-600' },
  LAND: { label: '陆运汽运', icon: Truck, color: 'text-amber-600' },
};

export default function CustomerWaybillList() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [waybills, setWaybills] = useState<Waybill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMark, setSelectedMark] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }

    // 静默从服务端拉取最新的 profile (实时同步后台为该用户新分配的唛头)
    authApi.getMe().then((res: any) => {
      const userData = res.data?.user || res.data;
      if (userData && userData.id) {
        setCurrentUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      }
    }).catch(() => {});
  }, []);

  const userShippingMarks: string[] = useMemo(() => {
    return Array.isArray(currentUser?.shippingMarks) ? currentUser.shippingMarks : [];
  }, [currentUser]);

  const loadWaybills = async () => {
    setLoading(true);
    try {
      const params: any = {
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? (statusFilter as WaybillStatus) : undefined,
        userMark: selectedMark !== 'ALL' ? selectedMark : undefined,
        page: pagination.page,
        limit: pagination.limit,
      };

      const res = await waybillV2Api.list(params);
      if (res.data.success) {
        setWaybills(res.data.data);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
        if (res.data.counts) {
          setStatusCounts(res.data.counts);
        }
      }
    } catch (err: any) {
      console.error('加载运单失败:', err);
      toast.error('加载运单数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWaybills();
  }, [pagination.page, pagination.limit, selectedMark, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    loadWaybills();
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Title */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">我的运单</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                实时跟踪您专属唛头名下的货物实测数据、物流轨迹节点与应收账单明细
              </p>
            </div>
          </div>

          {/* Bound Shipping Marks Tag summary */}
          <div className="flex items-center gap-2 bg-blue-50/60 border border-blue-100 px-3.5 py-2 rounded-xl">
            <Tag className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <div className="text-xs text-gray-700">
              <span className="font-semibold text-blue-900">当前已绑定唛头：</span>
              {userShippingMarks.length > 0 ? (
                <span className="font-mono text-blue-700 ml-1 font-medium">
                  {userShippingMarks.join(' / ')}
                </span>
              ) : (
                <span className="text-amber-600 ml-1 font-medium">暂未绑定唛头，请联系客服分配</span>
              )}
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4 space-y-3">
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3 items-center">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="搜索系统运单号、品名或海外目的地..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
              />
            </div>

            {/* Shipping Mark Switcher if user has multiple marks */}
            {userShippingMarks.length > 1 && (
              <div className="flex items-center gap-2 w-full md:w-auto">
                <span className="text-xs text-gray-500 font-medium whitespace-nowrap">筛选唛头:</span>
                <select
                  value={selectedMark}
                  onChange={(e) => {
                    setSelectedMark(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="px-3 py-2 text-xs font-mono font-medium border border-gray-300 rounded-lg bg-white outline-none"
                >
                  <option value="ALL">全部关联唛头 ({userShippingMarks.length}个)</option>
                  {userShippingMarks.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              className="w-full md:w-auto px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition"
            >
              查询
            </button>
          </form>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-gray-100">
            {[
              { id: 'ALL', label: '全部' },
              { id: 'INBOUND', label: '已入库' },
              { id: 'LOADED', label: '已装柜/起飞' },
              { id: 'IN_TRANSIT', label: '在途运输' },
              { id: 'CUSTOMS', label: '清关中' },
              { id: 'DISPATCHING', label: '派送中' },
              { id: 'DELIVERED', label: '已签收' },
            ].map((tab) => {
              const count = statusCounts[tab.id] || 0;
              const isActive = statusFilter === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setStatusFilter(tab.id);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap flex items-center gap-1.5 transition ${
                    isActive
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Waybill Table */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">运单号 / 运输方式</th>
                  <th className="px-6 py-3.5">关联唛头</th>
                  <th className="px-6 py-3.5">货物包裹概况</th>
                  <th className="px-6 py-3.5">目的地</th>
                  <th className="px-6 py-3.5">当前物流状态</th>
                  <th className="px-6 py-3.5">创建时间</th>
                  <th className="px-6 py-3.5 text-right">查看</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && waybills.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-2"></div>
                      <p className="text-xs">加载运单数据中...</p>
                    </td>
                  </tr>
                ) : waybills.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      <Package className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                      暂无相关运单记录
                    </td>
                  </tr>
                ) : (
                  waybills.map((wb) => {
                    const statusCfg = STATUS_CONFIG[wb.status] || STATUS_CONFIG.DRAFT;
                    const StatusIcon = statusCfg.icon;
                    const typeCfg = SHIPMENT_TYPE_LABELS[wb.orderType] || SHIPMENT_TYPE_LABELS.SEA_LCL;
                    const TypeIcon = typeCfg.icon;

                    return (
                      <tr
                        key={wb.id}
                        className="hover:bg-gray-50/80 transition cursor-pointer"
                        onClick={() => navigate(`/customer/waybills/${wb.id}`)}
                      >
                        <td className="px-6 py-4">
                          <div className="font-mono font-bold text-gray-900 text-sm">
                            {wb.waybillNo}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                            <TypeIcon className={`w-3.5 h-3.5 ${typeCfg.color}`} />
                            <span>{typeCfg.label}</span>
                            {wb.expressNo && (
                              <span className="text-[11px] font-mono text-gray-400">
                                · {wb.expressNo}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <Tag className="w-3 h-3 mr-1 text-blue-500" />
                            {wb.userMark}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="text-gray-900 font-medium text-xs">
                            {wb.totalPieces || 0} 件
                            {wb.orderType === 'AIR'
                              ? ` · ${Number(wb.totalWeightKg || 0).toFixed(2)} kg`
                              : ` · ${Number(wb.totalReceivableCbm || 0).toFixed(3)} CBM`}
                          </div>
                          {wb.items && wb.items.length > 0 && (
                            <div className="text-[11px] text-gray-400 truncate max-w-xs mt-0.5">
                              {wb.items.map((i) => i.productName).join('，')}
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1 text-xs text-gray-900 font-medium">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" />
                            <span>{wb.destinationCountry}</span>
                            {wb.destinationPort && (
                              <span className="text-gray-500 font-normal">
                                / {wb.destinationPort}
                              </span>
                            )}
                          </div>
                          {wb.originWarehouse && (
                            <div className="text-[11px] text-gray-400 mt-0.5">
                              起运：{wb.originWarehouse}
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                          >
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusCfg.label}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-xs font-mono text-gray-500">
                          {new Date(wb.createdAt).toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                          })}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/customer/waybills/${wb.id}`);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            详情
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
              <div>
                共 <span className="font-semibold text-gray-900">{pagination.total}</span> 票运单
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                  }
                  disabled={pagination.page === 1}
                  className="px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                <span className="px-2 font-mono">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      page: Math.min(prev.totalPages, prev.page + 1),
                    }))
                  }
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
