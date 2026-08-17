import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Container,
  Plus,
  Search,
  Anchor,
  Layers,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Edit3,
  X,
  RotateCcw,
} from 'lucide-react';
import {
  containerV2Api,
  type ContainerMaster,
  type ContainerStatus,
  type CurrencyType,
} from '../../lib/v2-api';
import {
  ORIGIN_PORTS,
  DESTINATION_COUNTRIES,
} from '../../lib/logistics-dictionary';

const STATUS_MAP: Record<ContainerStatus, { label: string; color: string }> = {
  LOADING: { label: '装柜配载中', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  SAILING: { label: '航运在途中 (SAILING)', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  ARRIVED: { label: '已抵达目的港', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  CUSTOMS: { label: '海关清关中 (CUSTOMS)', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  DISPATCHING: { label: '海外拆箱派送中', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  COMPLETED: { label: '全部完结', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

export default function ContainerTracking() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') || searchParams.get('containerNo') || '';

  const [containers, setContainers] = useState<ContainerMaster[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(urlSearch);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedOriginPort, setSelectedOriginPort] = useState<string>('ALL');
  const [selectedDestPort, setSelectedDestPort] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New container modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [containerNo, setContainerNo] = useState('');
  const [containerType, setContainerType] = useState('HQ_40');
  const [blNumber, setBlNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [vesselVoyage, setVesselVoyage] = useState('');
  const [originPort, setOriginPort] = useState('');
  const [destinationPort, setDestinationPort] = useState('');
  const [bookingChannel, setBookingChannel] = useState('');
  const [clearanceChannel, setClearanceChannel] = useState('');

  // Edit container modal (补录提单号/船讯)
  const [editingContainer, setEditingContainer] = useState<ContainerMaster | null>(null);
  const [editBlNumber, setEditBlNumber] = useState('');
  const [editCarrier, setEditCarrier] = useState('');
  const [editVesselVoyage, setEditVesselVoyage] = useState('');
  const [editSailingDate, setEditSailingDate] = useState('');
  const [editEta, setEditEta] = useState('');
  const [editOriginPort, setEditOriginPort] = useState('');
  const [editDestinationPort, setEditDestinationPort] = useState('');

  // Add Fee Modal
  const [feeModalContainerId, setFeeModalContainerId] = useState<string | null>(null);
  const [feeSubject, setFeeSubject] = useState('BOOKING_FEE');
  const [feeAmount, setFeeAmount] = useState(0);
  const [feeCurrency, setFeeCurrency] = useState<CurrencyType>('USD');
  const [feeRate, setFeeRate] = useState(7.2);
  const [feeNote, setFeeNote] = useState('');

  const loadContainers = async (overrideSearch?: string, overrideStatus?: string, overrideOrigin?: string, overrideDest?: string) => {
    setLoading(true);
    try {
      const q = overrideSearch !== undefined ? overrideSearch : searchQuery;
      const st = overrideStatus !== undefined ? overrideStatus : selectedStatus;
      const org = overrideOrigin !== undefined ? overrideOrigin : selectedOriginPort;
      const dst = overrideDest !== undefined ? overrideDest : selectedDestPort;

      const res = await containerV2Api.list({
        search: q.trim() || undefined,
        status: st !== 'ALL' ? (st as ContainerStatus) : undefined,
        originPort: org !== 'ALL' ? org : undefined,
        destinationPort: dst !== 'ALL' ? dst : undefined,
      });

      if (res.data.success) {
        const list: ContainerMaster[] = res.data.data;
        setContainers(list);

        // Auto expand matching container
        if (q.trim() && list.length > 0) {
          const exact = list.find((c) => c.containerNo.toLowerCase() === q.trim().toLowerCase()) || list[0];
          setExpandedId(exact.id);
        }
      }
    } catch (err: any) {
      toast.error('加载集装箱失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const urlQ = searchParams.get('search') || searchParams.get('containerNo') || '';
    if (urlQ) {
      setSearchQuery(urlQ);
      loadContainers(urlQ);
    } else {
      loadContainers();
    }
  }, [searchParams]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSearchParams({ search: searchQuery.trim() });
    } else {
      setSearchParams({});
    }
    loadContainers(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedStatus('ALL');
    setSelectedOriginPort('ALL');
    setSelectedDestPort('ALL');
    setSearchParams({});
    loadContainers('', 'ALL', 'ALL', 'ALL');
  };

  const handleCreateContainer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!containerNo.trim()) return;
    try {
      await containerV2Api.create({
        containerNo: containerNo.trim(),
        containerType,
        blNumber: blNumber.trim() || undefined,
        carrier: carrier.trim() || undefined,
        vesselVoyage: vesselVoyage.trim() || undefined,
        originPort: originPort.trim() || undefined,
        destinationPort: destinationPort.trim() || undefined,
        bookingChannel: bookingChannel.trim() || undefined,
        clearanceChannel: clearanceChannel.trim() || undefined,
        loadingDate: new Date().toISOString(),
        status: 'LOADING',
      });
      toast.success('集装箱创建成功！');
      setShowCreateModal(false);
      setContainerNo('');
      setBlNumber('');
      setCarrier('');
      setVesselVoyage('');
      setOriginPort('');
      setDestinationPort('');
      loadContainers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || '创建失败');
    }
  };

  const handleOpenEdit = (c: ContainerMaster) => {
    setEditingContainer(c);
    setEditBlNumber(c.blNumber || '');
    setEditCarrier(c.carrier || '');
    setEditVesselVoyage(c.vesselVoyage || '');
    setEditSailingDate(c.sailingDate ? new Date(c.sailingDate).toISOString().slice(0, 10) : '');
    setEditEta(c.eta ? new Date(c.eta).toISOString().slice(0, 10) : '');
    setEditOriginPort(c.originPort || '');
    setEditDestinationPort(c.destinationPort || '');
  };

  const handleUpdateContainer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContainer) return;
    try {
      await containerV2Api.update(editingContainer.id, {
        blNumber: editBlNumber.trim() || undefined,
        carrier: editCarrier.trim() || undefined,
        vesselVoyage: editVesselVoyage.trim() || undefined,
        sailingDate: editSailingDate || undefined,
        eta: editEta || undefined,
        originPort: editOriginPort || undefined,
        destinationPort: editDestinationPort || undefined,
      });
      toast.success('货柜信息已更新 (提单号与船讯已同步)！');
      setEditingContainer(null);
      loadContainers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || '更新失败');
    }
  };

  const handleStatusChange = async (cId: string, status: ContainerStatus) => {
    // 拦截校验：如果切换为全部完结 (COMPLETED)，先检查该货柜是否所有订单都是 DELIVERED (已签收完结)
    if (status === 'COMPLETED') {
      const targetCont = containers.find((c) => c.id === cId);
      if (targetCont && targetCont.waybills && targetCont.waybills.length > 0) {
        const unfinished = targetCont.waybills.filter((w) => w.status !== 'DELIVERED');
        if (unfinished.length > 0) {
          const sampleList = unfinished.slice(0, 3).map((w) => w.waybillNo).join('、');
          const extra = unfinished.length > 3 ? ` 等共 ${unfinished.length} 票` : '';
          toast.error(
            `无法将货柜修改为全部完结：柜内仍有 ${unfinished.length} 票运单未签收完结（${sampleList}${extra}），必须等待所有运单签收完结后方可修改！`,
            { duration: 6000 }
          );
          return;
        }
      }
    }

    try {
      await containerV2Api.update(cId, { status });
      toast.success('集装箱状态与名下散货已同步更新');
      loadContainers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || '更新状态失败');
    }
  };

  const handleAddContainerFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feeModalContainerId || feeAmount <= 0) return;
    try {
      await containerV2Api.addFee(feeModalContainerId, {
        feeSubject,
        amount: feeAmount,
        currency: feeCurrency,
        exchangeRate: feeCurrency === 'CNY' ? 1.0 : feeRate,
        note: feeNote,
      });
      toast.success('整柜干线费用添加成功！');
      setFeeModalContainerId(null);
      setFeeAmount(0);
      setFeeNote('');
      loadContainers();
    } catch (err: any) {
      toast.error('添加费用失败');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-full text-xs font-bold">
              海运干线
            </span>
            <h1 className="text-2xl font-bold text-slate-900">集装箱整柜与清关跟踪</h1>
          </div>
          <p className="text-slate-500 text-xs mt-1">
            监控集装箱航运干线节点、穿透查看柜内装载的所有散货拼箱明细与整柜全链路成本链
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          新建集装箱 (货柜)
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜索集装箱柜号 (如 TGBU5218902)、海运提单号 (B/L)、船名航次、船司 (如 万海/WAN HAI)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-medium text-slate-900"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchParams({});
                  loadContainers('', selectedStatus, selectedOriginPort, selectedDestPort);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedStatus(val);
                loadContainers(searchQuery, val, selectedOriginPort, selectedDestPort);
              }}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white"
            >
              <option value="ALL">全部状态</option>
              <option value="LOADING">装柜配载中 (LOADING)</option>
              <option value="SAILING">航运在途中 (SAILING)</option>
              <option value="ARRIVED">已到目的港 (ARRIVED)</option>
              <option value="CUSTOMS">海关清关中 (CUSTOMS)</option>
              <option value="DISPATCHING">海外拆派中 (DISPATCHING)</option>
              <option value="COMPLETED">全部完结 (COMPLETED)</option>
            </select>

            <select
              value={selectedOriginPort}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedOriginPort(val);
                loadContainers(searchQuery, selectedStatus, val, selectedDestPort);
              }}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white"
            >
              <option value="ALL">全部起运港</option>
              {ORIGIN_PORTS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            <select
              value={selectedDestPort}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedDestPort(val);
                loadContainers(searchQuery, selectedStatus, selectedOriginPort, val);
              }}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white"
            >
              <option value="ALL">全部目的港</option>
              {DESTINATION_COUNTRIES.flatMap((c) => c.ports).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              搜索
            </button>

            {(searchQuery || selectedStatus !== 'ALL' || selectedOriginPort !== 'ALL' || selectedDestPort !== 'ALL') && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="px-3 py-2.5 text-xs text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                重置
              </button>
            )}
          </div>
        </form>

        {/* Active Filter Badges */}
        {(searchQuery || selectedStatus !== 'ALL' || selectedOriginPort !== 'ALL' || selectedDestPort !== 'ALL') && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 text-xs text-slate-600">
            <span className="text-slate-400 font-medium">当前筛选:</span>
            {searchQuery && (
              <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg font-mono font-bold flex items-center gap-1.5">
                柜号/关键词: {searchQuery}
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchParams({});
                    loadContainers('', selectedStatus, selectedOriginPort, selectedDestPort);
                  }}
                  className="text-indigo-400 hover:text-red-500 font-normal"
                >
                  ×
                </button>
              </span>
            )}
            {selectedStatus !== 'ALL' && (
              <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-semibold flex items-center gap-1.5">
                状态: {STATUS_MAP[selectedStatus as ContainerStatus]?.label || selectedStatus}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStatus('ALL');
                    loadContainers(searchQuery, 'ALL', selectedOriginPort, selectedDestPort);
                  }}
                  className="text-blue-400 hover:text-red-500 font-normal"
                >
                  ×
                </button>
              </span>
            )}
            {selectedOriginPort !== 'ALL' && (
              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-semibold">
                起运港: {selectedOriginPort}
              </span>
            )}
            {selectedDestPort !== 'ALL' && (
              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-semibold">
                目的港: {selectedDestPort}
              </span>
            )}
            <span className="ml-auto text-slate-500 font-medium">
              共筛选出 <strong className="text-indigo-700 font-bold">{containers.length}</strong> 个集装箱货柜
            </span>
          </div>
        )}
      </div>

      {/* Container List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 text-center text-slate-400">正在加载集装箱数据...</div>
        ) : containers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            暂无集装箱数据，点击右上角“新建集装箱”
          </div>
        ) : (
          containers.map((container) => {
            const isExpanded = expandedId === container.id;
            const st = STATUS_MAP[container.status] || STATUS_MAP.LOADING;
            const stuffedCount = container.waybills?.length || 0;
            const totalVol = container.waybills?.reduce((s, w) => s + Number(w.totalPayableCbm || 0), 0) || 0;
            const totalPieces = container.waybills?.reduce((s, w) => s + w.totalPieces, 0) || 0;

            return (
              <div
                key={container.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all hover:border-indigo-300"
              >
                {/* Main Row */}
                <div className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Container ID & Route */}
                  <div className="flex items-start gap-4">
                    <div className="p-3.5 bg-indigo-50 text-indigo-700 rounded-2xl">
                      <Container className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold font-mono text-slate-900">
                          {container.containerNo}
                        </h2>
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-mono font-bold">
                          {container.containerType || '40HQ'}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${st.color}`}>
                          {st.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
                        <span className="flex items-center gap-1 font-medium text-slate-800">
                          <Anchor className="w-3.5 h-3.5 text-blue-600" />
                          {container.originPort || '起运港'} ➔ {container.destinationPort || '目的港'}
                        </span>
                        {container.blNumber && (
                          <span>提单号: <strong className="font-mono text-slate-800">{container.blNumber}</strong></span>
                        )}
                        <span>船司/航次: {container.carrier || '-'} / {container.vesselVoyage || '-'}</span>
                        <span>装柜日: {container.loadingDate ? new Date(container.loadingDate).toISOString().slice(0, 10) : '-'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Summary & Actions */}
                  <div className="flex items-center gap-6 self-end lg:self-auto">
                    {/* Metrics */}
                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 block">装载散货</span>
                      <p className="text-sm font-bold text-slate-900 font-mono">
                        {stuffedCount} 票 / {totalPieces} 件 ({totalVol.toFixed(3)} m³)
                      </p>
                    </div>

                    {/* Status quick select */}
                    <select
                      value={container.status}
                      onChange={(e) => handleStatusChange(container.id, e.target.value as ContainerStatus)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white"
                    >
                      <option value="LOADING">装柜配载中</option>
                      <option value="SAILING">航运在途中</option>
                      <option value="ARRIVED">已到目的港</option>
                      <option value="CUSTOMS">海关清关中</option>
                      <option value="DISPATCHING">海外拆箱派送</option>
                      <option value="COMPLETED">全部完结</option>
                    </select>

                    <button
                      onClick={() => handleOpenEdit(container)}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                      title="补录提单号、船名航次或船期"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      补录提单/船讯
                    </button>

                    <button
                      onClick={() => {
                        setFeeModalContainerId(container.id);
                        if (feeSubject === 'BOOKING_FEE') {
                          setFeeCurrency('USD');
                          setFeeRate(7.2);
                        } else {
                          setFeeCurrency('PHP');
                          setFeeRate(0.125);
                        }
                      }}
                      className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors"
                    >
                      + 录入整柜成本
                    </button>

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : container.id)}
                      className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                      {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details: Stuffed Waybills & Full Cost Chain */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-6 space-y-6">
                    {/* Stuffed Waybill Table */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-indigo-600" />
                        柜内装载的所有拼箱运单 ({stuffedCount})
                      </h3>

                      {stuffedCount === 0 ? (
                        <p className="text-xs text-slate-400 py-4 bg-white rounded-xl text-center border border-dashed border-slate-200">
                          该货柜内暂无装载散货。可在运单列表中批量勾选散货分配至此柜。
                        </p>
                      ) : (
                        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                                <th className="py-2.5 px-3">运单号</th>
                                <th className="py-2.5 px-3">客户唛头</th>
                                <th className="py-2.5 px-3 text-center">件数</th>
                                <th className="py-2.5 px-3 text-right">核算体积</th>
                                <th className="py-2.5 px-3 text-right">应收金额 (¥)</th>
                                <th className="py-2.5 px-3 text-center">状态</th>
                                <th className="py-2.5 px-3 text-center">查看</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {(container.waybills || []).map((wb) => (
                                <tr key={wb.id} className="hover:bg-slate-50/80">
                                  <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{wb.waybillNo}</td>
                                  <td className="py-2.5 px-3 font-bold text-slate-800">{wb.userMark}</td>
                                  <td className="py-2.5 px-3 text-center font-bold">{wb.totalPieces || 0}</td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700">
                                    {Number(wb.totalPayableCbm || 0).toFixed(4)} m³
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                                    ¥ {Number(wb.receivableAmount || 0).toFixed(2)}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px]">
                                      {wb.status}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <button
                                      onClick={() => navigate(`/v2/waybills/${wb.id}`)}
                                      className="text-blue-600 hover:underline font-semibold"
                                    >
                                      详情
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Full Cost Chain */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        整柜全链路干线成本明细 (订舱/港杂/清关/THC/拖车)
                      </h3>

                      {container.fees && container.fees.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          {(container.fees || []).map((f) => (
                            <div
                              key={f.id}
                              className="p-3 bg-white border border-slate-200 rounded-xl space-y-1"
                            >
                              <span className="text-[10px] font-bold text-slate-500 uppercase block">
                                {f.feeSubject}
                              </span>
                              <p className="text-sm font-bold font-mono text-slate-900">
                                {f.currency} {Number(f.amount).toFixed(2)}
                              </p>
                              <span className="text-[10px] text-slate-400 block font-mono">
                                折合: ¥ {Number(f.amountInCny || f.amount).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">
                          尚未录入干线成本，点击上方“+ 录入整柜成本”进行记录。
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* New Container Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateContainer}
            className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-base font-bold text-slate-900">新建集装箱 (货柜主数据)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  集装箱柜号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="如 MILU6019768 / 广62柜"
                  value={containerNo}
                  onChange={(e) => setContainerNo(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  柜型
                </label>
                <select
                  value={containerType}
                  onChange={(e) => setContainerType(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                >
                  <option value="HQ_40">40HQ 高柜</option>
                  <option value="GP_20">20GP 小柜</option>
                  <option value="GP_40">40GP 普柜</option>
                  <option value="HQ_45">45HQ 超高柜</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  海运提单号 (B/L)
                </label>
                <input
                  type="text"
                  placeholder="如 MCLPXMN082208"
                  value={blNumber}
                  onChange={(e) => setBlNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  船公司
                </label>
                <input
                  type="text"
                  placeholder="如 万海航运, 中远海运"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  起运港口
                </label>
                <select
                  value={originPort}
                  onChange={(e) => setOriginPort(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                >
                  <option value="">-- 请选择起运港 --</option>
                  {ORIGIN_PORTS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                  {originPort && !ORIGIN_PORTS.includes(originPort) && (
                    <option value={originPort}>{originPort} (自定义)</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  清关目的港
                </label>
                <select
                  value={destinationPort}
                  onChange={(e) => setDestinationPort(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                >
                  <option value="">-- 请选择清关目的港 --</option>
                  {DESTINATION_COUNTRIES.map((c) => (
                    <optgroup key={c.name} label={`${c.name} (${c.enName})`}>
                      {c.ports.map((port) => (
                        <option key={port} value={port}>
                          {port}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  {destinationPort && !DESTINATION_COUNTRIES.some((c) => c.ports.includes(destinationPort)) && (
                    <option value={destinationPort}>{destinationPort} (自定义)</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  订舱渠道
                </label>
                <input
                  type="text"
                  placeholder="如 优尼科"
                  value={bookingChannel}
                  onChange={(e) => setBookingChannel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  清关渠道
                </label>
                <input
                  type="text"
                  placeholder="如 泉州万海-菲立亚-渠道5"
                  value={clearanceChannel}
                  onChange={(e) => setClearanceChannel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-slate-600 text-xs font-semibold"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold"
              >
                确认创建
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Container Fee Modal */}
      {feeModalContainerId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleAddContainerFee}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-base font-bold text-slate-900">录入整柜干线全链路成本</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                费用科目
              </label>
              <select
                value={feeSubject}
                onChange={(e) => {
                  setFeeSubject(e.target.value);
                  if (e.target.value === 'BOOKING_FEE') {
                    setFeeCurrency('USD');
                    setFeeRate(7.2);
                  } else if (e.target.value.includes('THC') || e.target.value.includes('CLEARANCE')) {
                    setFeeCurrency('PHP');
                    setFeeRate(0.125);
                  } else {
                    setFeeCurrency('CNY');
                    setFeeRate(1.0);
                  }
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold"
              >
                <option value="BOOKING_FEE">订舱海运费 (BOOKING_FEE)</option>
                <option value="PORT_SURCHARGE">港杂费 (PORT_SURCHARGE)</option>
                <option value="TRUCKING_FEE">头程拖车费 (TRUCKING_FEE)</option>
                <option value="CUSTOMS_FEE">国内报关费 (CUSTOMS_FEE)</option>
                <option value="CLEARANCE_FEE">目的港清关费 (CLEARANCE_FEE)</option>
                <option value="THC_OVERSTAY_FEE">目的港 THC超期/堆箱费 (THC_OVERSTAY_FEE)</option>
                <option value="DEST_TRUCKING_FEE">目的港送柜拖车费 (DEST_TRUCKING_FEE)</option>
                <option value="OTHER_FEE">其他杂项 (OTHER_FEE)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  金额
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="如 235"
                  value={feeAmount || ''}
                  onChange={(e) => setFeeAmount(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  币种
                </label>
                <select
                  value={feeCurrency}
                  onChange={(e) => setFeeCurrency(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                >
                  <option value="USD">$ USD 美元</option>
                  <option value="PHP">₱ PHP 比索</option>
                  <option value="CNY">¥ CNY 人民币</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                折算人民币汇率 (1 {feeCurrency} = ¥)
              </label>
              <input
                type="number"
                step="0.0001"
                value={feeRate}
                onChange={(e) => setFeeRate(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                备注说明
              </label>
              <input
                type="text"
                placeholder="如 7859.2 比索码头滞箱费"
                value={feeNote}
                onChange={(e) => setFeeNote(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setFeeModalContainerId(null)}
                className="px-4 py-2 text-slate-600 text-xs font-semibold"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold"
              >
                确认记录成本
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* ✏️ 编辑集装箱 / 补录提单号与船讯模态框 */}
      {/* ========================================================= */}
      {editingContainer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleUpdateContainer}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-bold">
                  货柜信息维护
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1 flex items-center gap-2">
                  <Container className="w-5 h-5 text-blue-600" />
                  {editingContainer.containerNo} (补录提单/船讯)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingContainer(null)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5">
              {/* 海运提单号 (B/L No.) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  海运提单号 (Bill of Lading / B/L No.)
                </label>
                <input
                  type="text"
                  placeholder="如 MCLPXMN082208, WHL01928374"
                  value={editBlNumber}
                  onChange={(e) => setEditBlNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-blue-50/40 border border-blue-300 rounded-lg text-xs font-mono font-bold text-blue-950 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 船司 & 船名航次 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    船公司 / 承运庄家
                  </label>
                  <input
                    type="text"
                    placeholder="如 万海航运, 中外运"
                    value={editCarrier}
                    onChange={(e) => setEditCarrier(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    船名 / 航次
                  </label>
                  <input
                    type="text"
                    placeholder="如 WAN HAI 312 / V.S012"
                    value={editVesselVoyage}
                    onChange={(e) => setEditVesselVoyage(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium"
                  />
                </div>
              </div>

              {/* 开船日 & ETA */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    实际开船日 (ETD)
                  </label>
                  <input
                    type="date"
                    value={editSailingDate}
                    onChange={(e) => setEditSailingDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    预计到港日 (ETA)
                  </label>
                  <input
                    type="date"
                    value={editEta}
                    onChange={(e) => setEditEta(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* 起运港 & 目的港 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    起运港口
                  </label>
                  <select
                    value={editOriginPort}
                    onChange={(e) => setEditOriginPort(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                  >
                    <option value="">-- 请选择起运港 --</option>
                    {ORIGIN_PORTS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                    {editOriginPort && !ORIGIN_PORTS.includes(editOriginPort) && (
                      <option value={editOriginPort}>{editOriginPort} (自定义)</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    目的港口
                  </label>
                  <select
                    value={editDestinationPort}
                    onChange={(e) => setEditDestinationPort(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                  >
                    <option value="">-- 请选择清关目的港 --</option>
                    {DESTINATION_COUNTRIES.map((c) => (
                      <optgroup key={c.name} label={`${c.name} (${c.enName})`}>
                        {c.ports.map((port) => (
                          <option key={port} value={port}>
                            {port}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    {editDestinationPort && !DESTINATION_COUNTRIES.some((c) => c.ports.includes(editDestinationPort)) && (
                      <option value={editDestinationPort}>{editDestinationPort} (自定义)</option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingContainer(null)}
                className="px-4 py-2 text-slate-600 text-xs font-semibold hover:text-slate-800"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-md"
              >
                保存更新
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
