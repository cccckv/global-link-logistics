import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Ship,
  Plane,
  Container,
  Search,
  Plus,
  CheckSquare,
  Square,
  Eye,
  Trash2,
  Layers,
  Package,
  FileSpreadsheet,
} from 'lucide-react';
import { BatchImportModal, type ImportType } from '../../components/v2/BatchImportModal';
import {
  waybillV2Api,
  containerV2Api,
  type Waybill,
  type ShipmentType,
  type WaybillStatus,
  type ContainerMaster,
} from '../../lib/v2-api';
import { Pagination } from '../../components/ui/Pagination';

const STATUS_MAP: Record<WaybillStatus, { label: string; color: string }> = {
  DRAFT: { label: '待入库/已预报', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  INBOUND: { label: '已入库/已核量', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  LOADED: { label: '已装柜/已配载', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  IN_TRANSIT: { label: '在途运输中', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  CUSTOMS: { label: '目的港清关中', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  DISPATCHING: { label: '海外派送中', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  DELIVERED: { label: '已签收完结', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CANCELLED: { label: '已取消', color: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export default function WaybillManagement() {
  const navigate = useNavigate();

  // Filters
  const [orderType, setOrderType] = useState<ShipmentType | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<WaybillStatus | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);

  // Data
  const [waybills, setWaybills] = useState<Waybill[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Selection for Batch Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [containers, setContainers] = useState<ContainerMaster[]>([]);
  const [selectedContainerId, setSelectedContainerId] = useState('');
  const [batchLoadingDate, setBatchLoadingDate] = useState(new Date().toISOString().slice(0, 10));

  // Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importModalType, setImportModalType] = useState<ImportType>('SEA_LCL');
  const [showImportDropdown, setShowImportDropdown] = useState(false);

  const loadWaybills = async () => {
    setLoading(true);
    try {
      const res = await waybillV2Api.list({
        orderType: orderType || undefined,
        status: selectedStatus || undefined,
        search: searchQuery.trim() || undefined,
        page,
        limit,
      });
      if (res.data.success) {
        setWaybills(res.data.data);
        setCounts(res.data.counts || {});
        setTotal(res.data.pagination.total);
        setTotalPages(res.data.pagination.totalPages || Math.ceil(res.data.pagination.total / limit) || 1);
      }
    } catch (err: any) {
      toast.error('加载运单失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWaybills();
  }, [orderType, selectedStatus, page, limit]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadWaybills();
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  // Toggle selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === waybills.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(waybills.map((w) => w.id));
    }
  };

  // Open Batch Modal
  const openBatchStuffing = async () => {
    if (selectedIds.length === 0) {
      toast.warning('请先勾选需要排柜的运单');
      return;
    }
    const res = await containerV2Api.list({ limit: 50 });
    if (res.data.success) {
      setContainers(res.data.data);
      if (res.data.data.length > 0) {
        setSelectedContainerId(res.data.data[0].id);
      }
    }
    setShowBatchModal(true);
  };

  // Execute Batch Assign
  const handleBatchAssign = async () => {
    if (!selectedContainerId) {
      toast.error('请选择集装箱');
      return;
    }
    try {
      const res = await waybillV2Api.batchAssignContainer({
        waybillIds: selectedIds,
        containerId: selectedContainerId,
        loadingDate: batchLoadingDate,
      });
      if (res.data.success) {
        toast.success(`成功为 ${res.data.updatedCount} 票散货分配货柜！`);
        setShowBatchModal(false);
        setSelectedIds([]);
        loadWaybills();
      }
    } catch (err: any) {
      toast.error('批量排柜失败');
    }
  };

  // Delete single waybill
  const handleDelete = async (id: string) => {
    if (!window.confirm('确认删除该运单吗？')) return;
    try {
      await waybillV2Api.delete(id);
      toast.success('运单已删除');
      loadWaybills();
    } catch (err: any) {
      toast.error('删除失败');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header & Quick Action */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
              V2 中台
            </span>
            <h1 className="text-2xl font-bold text-slate-900">运单全景调度与管理</h1>
          </div>
          <p className="text-slate-500 text-xs mt-1">
            统一监控海运拼柜、空运、整柜订单，支持实测核量、多票批量装柜与全流程状态流转
          </p>
        </div>

        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <button
              onClick={openBatchStuffing}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all"
            >
              <Layers className="w-4 h-4" />
              批量排柜 ({selectedIds.length})
            </button>
          )}

          {/* 批量导入下拉 */}
          <div className="relative">
            <button
              onClick={() => setShowImportDropdown(!showImportDropdown)}
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              批量导入订单
            </button>

            {showImportDropdown && (
              <div
                className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-30 animate-fade-in"
                onMouseLeave={() => setShowImportDropdown(false)}
              >
                <button
                  onClick={() => {
                    setImportModalType('SEA_LCL');
                    setShowImportModal(true);
                    setShowImportDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                >
                  <Ship className="w-3.5 h-3.5 text-blue-600" />
                  海运散拼导入 (LCL)
                </button>
                <button
                  onClick={() => {
                    setImportModalType('AIR');
                    setShowImportModal(true);
                    setShowImportDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-sky-50 hover:text-sky-600 flex items-center gap-2"
                >
                  <Plane className="w-3.5 h-3.5 text-sky-600" />
                  空运专线导入 (AIR)
                </button>
                <button
                  onClick={() => {
                    setImportModalType('SEA_FCL');
                    setShowImportModal(true);
                    setShowImportDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 flex items-center gap-2"
                >
                  <Container className="w-3.5 h-3.5 text-emerald-600" />
                  海运整柜导入 (FCL)
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/v2/inbound')}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            快速录入新单
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Top Filter Bar: Type Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 px-4 pt-3 overflow-x-auto">
          {[
            { key: '', label: '全部订单', icon: Package },
            { key: 'SEA_LCL', label: '海运拼柜 (LCL)', icon: Ship },
            { key: 'AIR', label: '空运快递 (AIR)', icon: Plane },
            { key: 'SEA_FCL', label: '海运整柜 (FCL)', icon: Container },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = orderType === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setOrderType(tab.key as any);
                  setPage(1);
                }}
                className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition-all whitespace-nowrap ${
                  active
                    ? 'border-blue-600 text-blue-700 bg-white shadow-sm rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Status Pipeline Filter */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: '', label: '全部状态' },
              { key: 'DRAFT', label: '待入库/预报' },
              { key: 'INBOUND', label: '已入库' },
              { key: 'LOADED', label: '已装柜' },
              { key: 'IN_TRANSIT', label: '在途中' },
              { key: 'CUSTOMS', label: '清关中' },
              { key: 'DELIVERED', label: '已签收' },
            ].map((st) => {
              const active = selectedStatus === st.key;
              const count = st.key ? counts[st.key] || 0 : total;
              return (
                <button
                  key={st.key}
                  onClick={() => {
                    setSelectedStatus(st.key as any);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st.label}
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    active ? 'bg-white/30 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search form */}
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="搜索单号 / 唛头 / 快递号 / 品名"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              搜索
            </button>
          </form>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                <th className="py-3 px-3 text-center w-10">
                  <button onClick={toggleSelectAll} className="p-0.5 text-slate-400 hover:text-slate-700">
                    {selectedIds.length > 0 && selectedIds.length === waybills.length ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-3">系统运单号</th>
                <th className="py-3 px-3">客户唛头</th>
                <th className="py-3 px-3">类型 / 路线</th>
                <th className="py-3 px-3">品名 & 件数</th>
                <th className="py-3 px-3 text-right">计费体积/重量</th>
                <th className="py-3 px-3 text-right">应收总额 (¥)</th>
                <th className="py-3 px-3">装载货柜</th>
                <th className="py-3 px-3 text-center">状态</th>
                <th className="py-3 px-3 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    数据加载中...
                  </td>
                </tr>
              ) : waybills.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    暂无相关运单数据
                  </td>
                </tr>
              ) : (
                (waybills || []).map((wb) => {
                  const getStatusDisplay = () => {
                    if (wb.orderType === 'AIR') {
                      if (wb.status === 'LOADED') return { label: '已发货', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
                      if (wb.status === 'IN_TRANSIT') return { label: '到海外仓/在途', color: 'bg-purple-50 text-purple-700 border-purple-200' };
                      if (wb.status === 'DISPATCHING') return { label: '海外派送中', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
                    }
                    return (wb && wb.status && STATUS_MAP[wb.status]) || STATUS_MAP.DRAFT;
                  };
                  const isSelected = selectedIds.includes(wb.id);
                  const st = getStatusDisplay();
                  const itemSummary = (wb.items || []).map((i) => `${i.productName || '商品'}×${i.quantity || 1}`).join(', ') || '未填明细';

                  return (
                    <tr
                      key={wb.id}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        isSelected ? 'bg-blue-50/70' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <button onClick={() => toggleSelect(wb.id)}>
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono font-bold text-blue-900 block">
                          {wb.waybillNo}
                        </span>
                        {wb.expressNo && (
                          <span className="text-[10px] text-slate-400 block font-mono">
                            专线: {wb.expressNo}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {wb.userMark}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-slate-800 font-medium block">
                          {wb.originWarehouse || '广州'} ➔ {wb.destinationCountry}
                        </span>
                        <div className="flex items-center gap-1 mt-1">
                          {wb.customsType && (
                            <span className="px-1.5 py-0.2 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[9px] font-semibold">
                              {wb.customsType}
                            </span>
                          )}
                          {wb.forwarderChannel && (
                            <span className="px-1.5 py-0.2 bg-purple-50 text-purple-800 border border-purple-200 rounded text-[9px] font-semibold">
                              {wb.forwarderChannel}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 max-w-xs truncate" title={itemSummary}>
                        <span className="font-medium text-slate-800 block truncate">
                          {itemSummary || '未填品名'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          共 {wb.totalPieces} 件
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                        {wb.orderType === 'AIR'
                          ? `${wb.totalWeightKg || 0} kg`
                          : `${Number(wb.totalPayableCbm || 0).toFixed(4)} m³`}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                        ¥ {Number(wb.receivableAmount || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-3">
                        {wb.orderType === 'AIR' ? (
                          wb.expressNo ? (
                            <span className="px-2 py-0.5 bg-purple-50 border border-purple-200 text-purple-800 font-mono font-bold rounded text-[11px] block text-center" title="空运专线单号">
                              {wb.expressNo}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">待发货</span>
                          )
                        ) : wb.containerMaster ? (
                          <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-800 font-mono font-bold rounded text-[11px] block text-center">
                            {wb.containerMaster.containerNo}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">待排柜</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${st.color}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => navigate(`/v2/waybills/${wb.id}`)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="查看详情与全生命周期"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(wb.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Bar */}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={limit}
          pageSizeOptions={[10, 20, 50, 100]}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          showQuickJumper={true}
          showSizeChanger={true}
          showTotal={true}
          disabled={loading}
        />
      </div>

      {/* Batch Container Assign Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                批量散货配载与排柜
              </h3>
              <button
                onClick={() => setShowBatchModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              已选中 <strong className="text-indigo-600">{selectedIds.length}</strong> 票散货运单，请选择将它们装入哪个集装箱货柜：
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  选择目标货柜 (Container)
                </label>
                <select
                  value={selectedContainerId}
                  onChange={(e) => setSelectedContainerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- 请选择目标集装箱 --</option>
                  {containers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.containerNo} ({c.originPort || '起运港'} ➔ {c.destinationPort || '目的港'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  装柜日期
                </label>
                <input
                  type="date"
                  value={batchLoadingDate}
                  onChange={(e) => setBatchLoadingDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold"
              >
                取消
              </button>
              <button
                onClick={handleBatchAssign}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md transition-colors"
              >
                确认批量装柜
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 批量导入订单弹窗 */}
      <BatchImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        importType={importModalType}
        onSuccess={() => {
          toast.success('订单批量导入完成！');
          loadWaybills();
        }}
      />
    </div>
  );
}
