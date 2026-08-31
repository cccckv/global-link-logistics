import React, { useState, useEffect } from 'react';
import { Search, Loader2, RefreshCw, AlertTriangle, Package } from 'lucide-react';
import { toast } from 'sonner';
import { containerV2Api } from '../../lib/v2-api';

interface Container {
  id: string;
  containerNo: string;
  carrier: string | null;
  status: string;
  returnStatus: 'UNFINISHED' | 'PENDING' | 'RETURNING' | 'COMPLETED';
  hasExtraCharge: boolean;
  extraChargeReason: string | null;
  returnAppointmentDate: string | null;
  actualReturnDate: string | null;
  updatedAt: string;
}

const statusMap = {
  UNFINISHED: { label: '未完结', color: 'bg-gray-100 text-gray-800' },
  PENDING: { label: '待还柜', color: 'bg-yellow-100 text-yellow-800' },
  RETURNING: { label: '还柜中', color: 'bg-blue-100 text-blue-800' },
  COMPLETED: { label: '已还柜', color: 'bg-green-100 text-green-800' },
};

export default function ContainerReturnManagement() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterReturnStatus, setFilterReturnStatus] = useState<string>('');
  const [filterExtraCharge, setFilterExtraCharge] = useState<boolean>(false);

  // Pagination
  const [page, setPage] = useState(1);
  const limit = 20;

  // Modal states
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [feeForm, setFeeForm] = useState({
    amount: '',
    currency: 'PHP',
    reason: '',
  });

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchContainers();
  }, [page, filterReturnStatus, filterExtraCharge]);

  const fetchContainers = async () => {
    try {
      setLoading(true);
      const params: any = {
        page,
        limit,
      };
      if (search) params.search = search;
      if (filterReturnStatus) params.returnStatus = filterReturnStatus;
      if (filterExtraCharge) params.hasExtraCharge = 'true';

      const res = await containerV2Api.list(params);
      if (res.data.success) {
        setContainers(res.data.data as any);
        setTotalPages(res.data.pagination.totalPages || 1);
        setSelectedIds([]); // Reset selection on data load
      }
    } catch (err: any) {
      toast.error('获取货柜列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchContainers();
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const data: any = { returnStatus: newStatus };
      if (newStatus === 'COMPLETED') {
        data.actualReturnDate = new Date().toISOString();
      }
      const res = await containerV2Api.updateReturnStatus(id, data);
      if (res.data.success) {
        toast.success('状态更新成功');
        fetchContainers();
      }
    } catch (err: any) {
      toast.error('状态更新失败');
    }
  };

  const batchUpdateStatus = async (newStatus: string) => {
    if (selectedIds.length === 0) return;
    try {
      const data: any = { returnStatus: newStatus };
      if (newStatus === 'COMPLETED') {
        data.actualReturnDate = new Date().toISOString();
      }
      
      await Promise.all(
        selectedIds.map(id => containerV2Api.updateReturnStatus(id, data))
      );
      
      toast.success(`成功批量更新 ${selectedIds.length} 个货柜状态`);
      fetchContainers();
    } catch (err: any) {
      toast.error('批量更新状态失败，部分货柜可能未更新');
      fetchContainers();
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(containers.map(c => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const saveExtraCharge = async () => {
    if (!selectedContainer) return;
    try {
      // 1. 计入货柜真实成本表 (Container Tracking 中可见)
      await containerV2Api.addFee(selectedContainer.id, {
        feeSubject: 'THC_OVERSTAY_FEE', // 统一归入超期滞箱/码头杂费类
        amount: Number(feeForm.amount),
        currency: feeForm.currency,
        note: feeForm.reason,
      });

      // 2. 仅更新主表的异常标识和备注，用于本页面快捷过滤和展示
      const res = await containerV2Api.updateReturnStatus(selectedContainer.id, {
        hasExtraCharge: true,
        extraChargeReason: feeForm.reason,
      });

      if (res.data.success) {
        toast.success('异常费用已成功归入货柜成本');
        setShowFeeModal(false);
        fetchContainers();
      }
    } catch (err: any) {
      toast.error('费用录入失败');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-blue-600" />
            空箱还柜管理
          </h1>
          <p className="text-sm text-gray-500 mt-1">管理卸货后集装箱的归还进度与异常费用</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          {[{ id: '', label: '全部' }, ...Object.entries(statusMap).map(([k, v]) => ({ id: k, label: v.label }))].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setFilterReturnStatus(tab.id); setPage(1); }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filterReturnStatus === tab.id ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="flex gap-3 w-full md:w-auto">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input 
              type="checkbox" 
              checked={filterExtraCharge}
              onChange={(e) => { setFilterExtraCharge(e.target.checked); setPage(1); }}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            仅异常费用
          </label>
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              placeholder="搜索柜号/提单号..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
          </div>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium">
            搜索
          </button>
        </form>
      </div>

      {selectedIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center justify-between">
          <div className="text-sm text-blue-800 font-medium">
            已选择 <span className="font-bold">{selectedIds.length}</span> 个货柜
          </div>
          <div className="flex gap-2">
            <span className="text-sm text-blue-600 mr-2 flex items-center">批量流转至:</span>
            <button onClick={() => batchUpdateStatus('PENDING')} className="px-3 py-1.5 text-xs font-medium bg-white border border-blue-200 text-blue-700 rounded shadow-sm hover:bg-blue-50">待还柜</button>
            <button onClick={() => batchUpdateStatus('RETURNING')} className="px-3 py-1.5 text-xs font-medium bg-white border border-blue-200 text-blue-700 rounded shadow-sm hover:bg-blue-50">还柜中</button>
            <button onClick={() => batchUpdateStatus('COMPLETED')} className="px-3 py-1.5 text-xs font-medium bg-white border border-blue-200 text-green-700 rounded shadow-sm hover:bg-green-50">已还柜</button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-700 text-xs uppercase font-semibold border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 w-12">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={containers.length > 0 && selectedIds.length === containers.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="px-6 py-4">柜号</th>
                <th className="px-6 py-4">船司</th>
                <th className="px-6 py-4">还柜状态</th>
                <th className="px-6 py-4">异常费用</th>
                <th className="px-6 py-4">更新时间</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
                    加载中...
                  </td>
                </tr>
              ) : containers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    暂无相关货柜数据
                  </td>
                </tr>
              ) : (
                containers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedIds.includes(c.id)}
                        onChange={() => handleSelectOne(c.id)}
                      />
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">{c.containerNo}</td>
                    <td className="px-6 py-4">{c.carrier || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusMap[c.returnStatus]?.color || 'bg-gray-100'}`}>
                        {statusMap[c.returnStatus]?.label || c.returnStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {c.hasExtraCharge ? (
                        <div className="flex items-center gap-1.5 text-red-600 font-medium bg-red-50 px-2.5 py-1 rounded-md inline-flex">
                          <AlertTriangle className="w-4 h-4" />
                          有费用记录
                          {c.extraChargeReason && <span className="text-xs text-red-400 ml-1">({c.extraChargeReason})</span>}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {c.updatedAt ? new Date(c.updatedAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2 flex items-center justify-end">
                      <select
                        value={c.returnStatus}
                        onChange={(e) => updateStatus(c.id, e.target.value)}
                        className="text-sm border border-gray-300 rounded-md py-1 px-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      >
                        <option value="UNFINISHED">未完结</option>
                        <option value="PENDING">待还柜</option>
                        <option value="RETURNING">还柜中</option>
                        <option value="COMPLETED">已还柜</option>
                      </select>
                      <button 
                        onClick={() => {
                          setSelectedContainer(c);
                          setFeeForm({ amount: '', currency: 'PHP', reason: c.extraChargeReason || '' });
                          setShowFeeModal(true);
                        }}
                        className="text-orange-600 hover:text-orange-800 text-sm font-medium border-l border-gray-200 pl-2 ml-2"
                      >
                        录入费用
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {!loading && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
            <div className="text-sm text-gray-500">
              第 <span className="font-medium">{page}</span> 页，共 <span className="font-medium">{totalPages}</span> 页
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white bg-gray-50"
              >
                上一页
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white bg-gray-50"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {showFeeModal && selectedContainer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">录入异常费用</h2>
            <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
              正在为货柜 <span className="font-bold text-gray-900">{selectedContainer.containerNo}</span> 录入额外费用（如滞箱费）。
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">金额</label>
                  <input
                    type="number"
                    value={feeForm.amount}
                    onChange={(e) => setFeeForm({ ...feeForm, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">币种</label>
                  <select
                    value={feeForm.currency}
                    onChange={(e) => setFeeForm({ ...feeForm, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="PHP">PHP</option>
                    <option value="USD">USD</option>
                    <option value="CNY">CNY</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">费用事由</label>
                <input
                  type="text"
                  value={feeForm.reason}
                  onChange={(e) => setFeeForm({ ...feeForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="如: 超期滞箱费"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowFeeModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                取消
              </button>
              <button onClick={saveExtraCharge} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                保存费用
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
