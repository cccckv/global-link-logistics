import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  DollarSign,
  Search,
  RefreshCw,
  Filter,
  CheckCircle2,
  Clock,
  TrendingUp,
  CreditCard,
  FileText,
  Paperclip,
  Plus,
  Edit2,
  Trash2,
  X,
  ChevronRight,
  ShieldCheck,
  RotateCcw,
  ArrowUpRight,
  ArrowDownRight,
  Lock,
  Upload,
  Eye,
  AlertCircle,
} from 'lucide-react';
import {
  financeV2Api,
  type Waybill,
  type WaybillFee,
  type CurrencyType,
  type FeeDirection,
  type FinanceKpiSummary,
} from '../../lib/v2-api';
import { LocalFileUpload, type UploadedFileItem } from '../../components/v2/LocalFileUpload';
import { CONTAINER_FEE_SUBJECTS } from './WaybillDetailView';

export default function FinanceWorkbench() {
  // 列表与分页状态
  const [loading, setLoading] = useState(false);
  const [waybills, setWaybills] = useState<Waybill[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 1,
  });

  // 顶部全局 KPI 指标
  const [kpi, setKpi] = useState<FinanceKpiSummary>({
    totalReceivableCny: 0,
    totalPayableCny: 0,
    totalProfitCny: 0,
    profitMargin: 0,
    uncollectedReceivableCny: 0,
    unpaidPayableCny: 0,
    rawReceivablePhp: 0,
    rawReceivableUsd: 0,
    totalOrdersCount: 0,
  });

  // 筛选器状态
  const [statusFilter, setStatusFilter] = useState<string>('DELIVERED');
  const [settlementFilter, setSettlementFilter] = useState<string>('ALL');
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 抽屉详情状态 (选中的运单)
  const [selectedWaybill, setSelectedWaybill] = useState<Waybill | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 凭证大图预览 Lightbox
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // 结清操作模态框状态
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [settleTarget, setSettleTarget] = useState<{
    type: 'FREIGHT' | 'FEE';
    feeId?: string;
    title: string;
    amount: number;
    currency: string;
    amountInCny: number;
  } | null>(null);
  const [settlePaymentMethod, setSettlePaymentMethod] = useState('银行对公');
  const [settlePaymentNote, setSettlePaymentNote] = useState('');
  const [settleSubmitting, setSettleSubmitting] = useState(false);

  // 增改费用模态框状态
  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [feeCategoryType, setFeeCategoryType] = useState<'CUSTOM' | 'CONTAINER'>('CUSTOM');
  const [containerFeeSubject, setContainerFeeSubject] = useState<string>('BOOKING_FEE');
  const [feeDirection, setFeeDirection] = useState<FeeDirection>('RECEIVABLE');
  const [feeName, setFeeName] = useState('');
  const [feeCurrency, setFeeCurrency] = useState<CurrencyType>('CNY');
  const [feeAmount, setFeeAmount] = useState<number | ''>('');
  const [feeExchangeRate, setFeeExchangeRate] = useState<number | ''>('');
  const [feeNote, setFeeNote] = useState('');
  const [feeSubmitting, setFeeSubmitting] = useState(false);

  // 统一收付款凭证图文归档模态框状态 (支持批量上传)
  const [voucherUploadModalOpen, setVoucherUploadModalOpen] = useState(false);
  const [batchVoucherFiles, setBatchVoucherFiles] = useState<UploadedFileItem[]>([]);
  const [newVoucherType, setNewVoucherType] = useState<string>('OTHER');
  const [customVoucherType, setCustomVoucherType] = useState<string>('');
  const [voucherSubmitting, setVoucherSubmitting] = useState(false);

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 加载工作台数据
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financeV2Api.getWorkbenchData({
        status: statusFilter,
        settlementFilter,
        orderType: orderTypeFilter,
        search: debouncedSearch,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: pagination.page,
        limit: pagination.limit,
      });

      if (res.data && res.data.success) {
        setWaybills(res.data.data || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
        if (res.data.kpi) {
          setKpi(res.data.kpi);
        }

        // 若当前打开了抽屉，同步更新选中运单的最新数据
        if (selectedWaybill) {
          const fresh = res.data.data.find((w) => w.id === selectedWaybill.id);
          if (fresh) {
            setSelectedWaybill(fresh);
          }
        }
      }
    } catch (err: any) {
      console.error('加载财务核算数据失败:', err);
      toast.error('加载财务核算数据失败: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  }, [
    statusFilter,
    settlementFilter,
    orderTypeFilter,
    debouncedSearch,
    startDate,
    endDate,
    pagination.page,
    pagination.limit,
    selectedWaybill?.id,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 打开结清模态框
  const handleOpenSettleModal = (target: {
    type: 'FREIGHT' | 'FEE';
    feeId?: string;
    title: string;
    amount: number;
    currency: string;
    amountInCny: number;
  }) => {
    setSettleTarget(target);
    setSettlePaymentMethod('银行对公');
    setSettlePaymentNote('');
    setSettleModalOpen(true);
  };

  // 提交结清
  const handleConfirmSettle = async () => {
    if (!selectedWaybill || !settleTarget) return;

    setSettleSubmitting(true);
    try {
      if (settleTarget.type === 'FREIGHT') {
        await financeV2Api.settleFreight(selectedWaybill.id, {
          isSettled: true,
          paymentMethod: settlePaymentMethod,
          paymentNote: settlePaymentNote,
        });
        toast.success(`主运费款项已成功结清确认！`);
      } else if (settleTarget.type === 'FEE' && settleTarget.feeId) {
        await financeV2Api.settleFee(settleTarget.feeId, {
          isPaid: true,
          paymentMethod: settlePaymentMethod,
          paymentNote: settlePaymentNote,
        });
        toast.success(`费用【${settleTarget.title}】已成功结清确认！`);
      }

      setSettleModalOpen(false);
      await fetchData();
    } catch (err: any) {
      toast.error('结清失败: ' + (err.response?.data?.error || err.message));
    } finally {
      setSettleSubmitting(false);
    }
  };

  // 撤销结清 (反结清)
  const handleUnsettle = async (type: 'FREIGHT' | 'FEE', feeId?: string, name?: string) => {
    if (!selectedWaybill) return;
    if (!window.confirm(`确定要撤销【${name || '该款项'}】的结清状态吗？撤销后条目将恢复为待结清。`)) {
      return;
    }

    try {
      if (type === 'FREIGHT') {
        await financeV2Api.settleFreight(selectedWaybill.id, {
          isSettled: false,
        });
        toast.success('主运费已撤销结清状态');
      } else if (type === 'FEE' && feeId) {
        await financeV2Api.settleFee(feeId, {
          isPaid: false,
        });
        toast.success(`费用【${name}】已撤销结清状态`);
      }
      await fetchData();
    } catch (err: any) {
      toast.error('撤销结清失败: ' + (err.response?.data?.error || err.message));
    }
  };

  // 打开增加费用模态框
  const handleOpenAddFee = (dir: FeeDirection) => {
    if (!selectedWaybill) return;
    setEditingFeeId(null);
    setFeeDirection(dir);
    if (dir === 'PAYABLE' && selectedWaybill.orderType === 'SEA_FCL' && selectedWaybill.containerMaster) {
      setFeeCategoryType('CONTAINER');
      setContainerFeeSubject('BOOKING_FEE');
      const found = CONTAINER_FEE_SUBJECTS.find((s) => s.value === 'BOOKING_FEE');
      setFeeName(found?.label || '海运订舱费 (BOOKING_FEE)');
      const curr = found?.defaultCurrency || 'USD';
      setFeeCurrency(curr);
      setFeeExchangeRate(
        curr === 'USD'
          ? selectedWaybill.usdRate || 7.2
          : curr === 'PHP'
          ? selectedWaybill.phpRate || 8.0
          : 1.0
      );
    } else {
      setFeeCategoryType('CUSTOM');
      setFeeName('');
      setFeeCurrency('CNY');
      setFeeExchangeRate(
        dir === 'RECEIVABLE' && selectedWaybill.settlementCurrency === 'PHP'
          ? selectedWaybill.phpRate || 8.0
          : dir === 'RECEIVABLE' && selectedWaybill.settlementCurrency === 'USD'
          ? selectedWaybill.usdRate || 7.2
          : 1.0
      );
    }
    setFeeAmount('');
    setFeeNote('');
    setFeeModalOpen(true);
  };

  // 打开编辑费用模态框
  const handleOpenEditFee = (fee: WaybillFee & { feeSubject?: string }) => {
    if (fee.isPaid) {
      toast.error('已结清条目已被锁定，如需修改请先撤销结清');
      return;
    }
    setEditingFeeId(fee.id || null);
    setFeeDirection(fee.feeDirection || 'PAYABLE');
    setFeeCategoryType(fee.feeSubject ? 'CONTAINER' : 'CUSTOM');
    if (fee.feeSubject) {
      setContainerFeeSubject(fee.feeSubject);
    }
    setFeeName(fee.feeName || CONTAINER_FEE_SUBJECTS.find((s) => s.value === fee.feeSubject)?.label || fee.feeSubject || '');
    setFeeCurrency(fee.currency);
    setFeeAmount(Number(fee.amount));
    setFeeExchangeRate(Number(fee.exchangeRate || 1.0));
    setFeeNote(fee.note || '');
    setFeeModalOpen(true);
  };

  // 保存费用 (新增或修改)
  const handleSaveFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWaybill) return;
    if (!feeName.trim()) {
      toast.error('请输入款项名称');
      return;
    }
    if (feeAmount === '' || Number(feeAmount) <= 0) {
      toast.error('请输入有效的金额');
      return;
    }

    setFeeSubmitting(true);
    try {
      if (editingFeeId) {
        await financeV2Api.updateFee(editingFeeId, {
          feeName: feeName.trim(),
          amount: Number(feeAmount),
          currency: feeCurrency,
          exchangeRate: Number(feeExchangeRate || 1.0),
          note: feeNote.trim(),
        });
        toast.success('费用条目已成功更新，运单毛利已重新核算！');
      } else {
        await financeV2Api.addFee(selectedWaybill.id, {
          feeName: feeName.trim(),
          feeDirection,
          amount: Number(feeAmount),
          currency: feeCurrency,
          exchangeRate: Number(feeExchangeRate || 1.0),
          note: feeNote.trim(),
          containerFeeSubject: feeCategoryType === 'CONTAINER' ? containerFeeSubject : undefined,
        });
        toast.success('新费用条目已成功补录，运单毛利已重新核算！');
      }

      setFeeModalOpen(false);
      await fetchData();
    } catch (err: any) {
      toast.error('保存费用失败: ' + (err.response?.data?.error || err.message));
    } finally {
      setFeeSubmitting(false);
    }
  };

  // 删除费用
  const handleDeleteFee = async (feeId: string, name: string) => {
    if (!window.confirm(`确定要删除费用【${name}】吗？删除后将自动重算运单总账与毛利。`)) {
      return;
    }
    try {
      await financeV2Api.deleteFee(feeId);
      toast.success(`费用【${name}】已成功删除并重算利润！`);
      await fetchData();
    } catch (err: any) {
      toast.error('删除费用失败: ' + (err.response?.data?.error || err.message));
    }
  };

  // 批量保存新上传的收付款图文凭证
  const handleSaveBatchVouchers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWaybill) return;
    if (batchVoucherFiles.length === 0) {
      toast.error('请至少上传一张凭证文件');
      return;
    }
    setVoucherSubmitting(true);
    try {
      let successCount = 0;
      const customPrefix =
        newVoucherType === 'OTHER' && customVoucherType.trim()
          ? `[${customVoucherType.trim()}] `
          : '';

      for (const fileItem of batchVoucherFiles) {
        const finalFileName = `${customPrefix}${fileItem.name || `凭证单据_${new Date().toISOString().slice(0, 10)}.png`}`;
        await financeV2Api.addAttachment(selectedWaybill.id, {
          attachmentType: (newVoucherType as any) || 'OTHER',
          fileUrl: fileItem.url,
          fileName: finalFileName,
        });
        successCount++;
      }
      toast.success(`成功批量归档 ${successCount} 份单据凭证！`);
      setVoucherUploadModalOpen(false);
      setBatchVoucherFiles([]);
      setCustomVoucherType('');
      await fetchData();
    } catch (err: any) {
      toast.error('归档凭证失败: ' + (err.response?.data?.error || err.message));
    } finally {
      setVoucherSubmitting(false);
    }
  };

  // 删除单据凭证
  const handleDeleteVoucher = async (attId: string, name?: string) => {
    if (!window.confirm(`确定要删除凭证【${name || '该文件'}】吗？`)) return;
    try {
      await financeV2Api.deleteAttachment(attId);
      toast.success('凭证已成功移除');
      await fetchData();
    } catch (err: any) {
      toast.error('删除凭证失败: ' + (err.response?.data?.error || err.message));
    }
  };

  // 动态折算预览 (编辑杂费弹窗内)
  const calcFeePreviewCny = () => {
    if (feeAmount === '' || Number(feeAmount) <= 0) return 0;
    const amt = Number(feeAmount);
    const rate = Number(feeExchangeRate || 1.0);
    if (feeCurrency === 'USD') return amt * rate;
    if (feeCurrency === 'PHP') return rate > 0.0001 ? amt / rate : 0;
    return amt;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 text-slate-900">
      {/* 顶部标题栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                财务核算与对账工作台
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold font-mono">
                  Finance V2
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                专供财务人员使用的高效对账中台 · 细颗粒度款项逐笔结清 · 收付款凭证图文归档 · 人民币纯毛利核算
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            刷新数据
          </button>
        </div>
      </div>

      {/* 顶部全局多币种折合 KPI 看板 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* 卡片 1: 总应收 */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 relative overflow-hidden shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold">已结单总应收 (CNY)</span>
            <span className="p-1 rounded-md bg-emerald-50 text-emerald-600">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
            ¥ {kpi.totalReceivableCny.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          {(kpi.rawReceivablePhp > 0 || kpi.rawReceivableUsd > 0) && (
            <div className="text-[10px] text-slate-500 mt-1 font-mono flex flex-wrap gap-2">
              {kpi.rawReceivablePhp > 0 && (
                <span>比索 ₱ {kpi.rawReceivablePhp.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}</span>
              )}
              {kpi.rawReceivableUsd > 0 && (
                <span>美金 $ {kpi.rawReceivableUsd.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}</span>
              )}
            </div>
          )}
        </div>

        {/* 卡片 2: 总成本 */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 relative overflow-hidden shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold">已结单总应付 (CNY)</span>
            <span className="p-1 rounded-md bg-rose-50 text-rose-600">
              <ArrowDownRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-800 font-mono">
            ¥ {kpi.totalPayableCny.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">干线承运 + 港杂清关拖车硬成本</p>
        </div>

        {/* 卡片 3: 纯毛利与毛利率 (带除零保护) */}
        <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/40 border border-emerald-200 rounded-2xl p-4 relative overflow-hidden shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between text-emerald-800 text-xs mb-1">
            <span className="font-bold flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              综合纯毛利润
            </span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-black font-mono">
              {kpi.profitMargin}%
            </span>
          </div>
          <div className={`text-xl sm:text-2xl font-black font-mono ${kpi.totalProfitCny < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
            ¥ {kpi.totalProfitCny.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] text-emerald-700/80 mt-1">已对冲外汇换算统一折算</p>
        </div>

        {/* 卡片 4: 待收款项 (未结清应收) */}
        <div className="bg-amber-50/40 border border-amber-200/90 rounded-2xl p-4 relative overflow-hidden shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between text-amber-800 text-xs mb-1">
            <span className="font-semibold">待收回款 (未结应收)</span>
            <span className="p-1 rounded-md bg-amber-100 text-amber-700">
              <Clock className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-700 font-mono">
            ¥ {kpi.uncollectedReceivableCny.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] text-amber-700/80 mt-1">待客户打款核销</p>
        </div>

        {/* 卡片 5: 待付款项 (未结清应付) */}
        <div className="bg-purple-50/40 border border-purple-200/90 rounded-2xl p-4 relative overflow-hidden shadow-sm hover:shadow transition col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-purple-800 text-xs mb-1">
            <span className="font-semibold">待付支出 (未结应付)</span>
            <span className="p-1 rounded-md bg-purple-100 text-purple-700">
              <CreditCard className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-purple-700 font-mono">
            ¥ {kpi.unpaidPayableCny.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] text-purple-700/80 mt-1">待支付车队/报关/船司成本</p>
        </div>
      </div>

      {/* 筛选与检索工具栏 */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
        {/* 第一行: 业务类型 Tabs + 结清状态快捷过滤 */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* 运输方式 Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 self-start">
            {[
              { key: 'ALL', label: '全部业务' },
              { key: 'SEA_LCL', label: '海运拼箱' },
              { key: 'AIR', label: '空运快递' },
              { key: 'SEA_FCL', label: '海运整柜' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setOrderTypeFilter(tab.key);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  orderTypeFilter === tab.key
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 结清状态快捷筛选 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              结清筛选:
            </span>
            {[
              { key: 'ALL', label: '全部' },
              { key: 'UNSETTLED_RECEIVABLE', label: '待收款项' },
              { key: 'UNSETTLED_PAYABLE', label: '待付款项' },
              { key: 'HAS_UNSETTLED', label: '存在未结款' },
              { key: 'ALL_SETTLED', label: '收付全结清' },
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => {
                  setSettlementFilter(filter.key);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                  settlementFilter === filter.key
                    ? 'bg-amber-100 text-amber-800 border-amber-300 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* 第二行: 搜索框 + 订单状态准入 + 日期过滤 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 综合搜索 */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜索运单号 / 唛头 / 柜号 / 快递号..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
            />
          </div>

          {/* 准入门槛: 订单状态 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 shrink-0 font-medium">订单状态:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
            >
              <option value="DELIVERED">已结单 (已送达签收完结) [推荐默认]</option>
              <option value="ALL">全部历史订单 (含运输在途)</option>
              <option value="DISPATCHING">末端派送中</option>
              <option value="CUSTOMS">目的港清关中</option>
              <option value="IN_TRANSIT">干线航运中</option>
              <option value="LOADED">已装柜出运</option>
              <option value="INBOUND">仓库已入库</option>
            </select>
          </div>

          {/* 开始日期 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 shrink-0 font-medium">起止日期:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-mono transition"
            />
          </div>

          {/* 结束日期 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 shrink-0 font-medium">至:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-mono transition"
            />
          </div>
        </div>
      </div>

      {/* 核心数据大表 */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">运单号 / 运输方式</th>
                <th className="py-3.5 px-3">客户唛头</th>
                <th className="py-3.5 px-3">件数 / 计费规格</th>
                <th className="py-3.5 px-3 text-center">应收结清进度</th>
                <th className="py-3.5 px-3 text-center">应付结清进度</th>
                <th className="py-3.5 px-4 text-right">折合总应收 (CNY)</th>
                <th className="py-3.5 px-4 text-right">折合总应付 (CNY)</th>
                <th className="py-3.5 px-4 text-right">纯毛利 (¥) / 利率</th>
                <th className="py-3.5 px-3">签收日期</th>
                <th className="py-3.5 px-4 text-right">财务操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && waybills.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    正在精确核算财务数据...
                  </td>
                </tr>
              ) : waybills.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-400 italic">
                    暂无符合条件的核算订单
                  </td>
                </tr>
              ) : (
                waybills.map((wb) => {
                  const recProgress = wb.financialProgress?.receivable;
                  const payProgress = wb.financialProgress?.payable;
                  const profit = Number(wb.profitAmount || 0);
                  const rec = Number(wb.receivableAmount || 0);
                  const margin = rec > 0.0001 ? ((profit / rec) * 100).toFixed(1) + '%' : '0.0%';

                  return (
                    <tr
                      key={wb.id}
                      className="hover:bg-slate-50/80 transition group cursor-pointer"
                      onClick={() => {
                        setSelectedWaybill(wb);
                        setDrawerOpen(true);
                      }}
                    >
                      {/* 运单号 & 业务类型 */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900 group-hover:text-emerald-600 transition flex items-center gap-1.5">
                          {wb.waybillNo}
                          <ChevronRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${
                              wb.orderType === 'SEA_LCL'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : wb.orderType === 'AIR'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-purple-50 text-purple-700 border-purple-200'
                            }`}
                          >
                            {wb.orderType === 'SEA_LCL'
                              ? '海运拼箱'
                              : wb.orderType === 'AIR'
                              ? '空运专线'
                              : '海运整柜'}
                          </span>
                          {wb.containerMaster?.containerNo && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              {wb.containerMaster.containerNo}
                            </span>
                          )}
                          {(() => {
                            const vCount = (wb.attachments || []).length;
                            return vCount > 0 ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold font-mono flex items-center gap-1">
                                <Paperclip className="w-2.5 h-2.5" />
                                {vCount}张凭证
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </td>

                      {/* 客户唛头 */}
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-800">{wb.userMark}</span>
                        {wb.customer?.name && (
                          <div className="text-[11px] text-slate-500 truncate max-w-[120px]">
                            {wb.customer.name}
                          </div>
                        )}
                      </td>

                      {/* 件数 / 规格 */}
                      <td className="py-3 px-3 font-mono text-[11px]">
                        <div className="text-slate-800 font-medium">{wb.totalPieces || 0} 件</div>
                        {wb.orderType === 'AIR' ? (
                          <div className="text-slate-500 font-semibold">
                            {Number(wb.totalWeightKg || 0).toFixed(2)} kg
                          </div>
                        ) : (
                          <div className="text-slate-500 font-semibold">
                            {Number(wb.totalReceivableCbm || wb.totalPayableCbm || 0).toFixed(3)} m³
                          </div>
                        )}
                      </td>

                      {/* 应收结清进度 */}
                      <td className="py-3 px-3 text-center">
                        {recProgress ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold font-mono border ${
                              recProgress.isComplete
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : recProgress.settledItems > 0
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {recProgress.isComplete ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Clock className="w-3 h-3 text-amber-600" />
                            )}
                            {recProgress.settledItems}/{recProgress.totalItems} 项已结
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                        {recProgress && !recProgress.isComplete && recProgress.uncollectedCny > 0 && (
                          <div className="text-[10px] text-amber-600 font-mono mt-0.5">
                            未收 ¥{recProgress.uncollectedCny.toFixed(2)}
                          </div>
                        )}
                      </td>

                      {/* 应付结清进度 */}
                      <td className="py-3 px-3 text-center">
                        {payProgress && payProgress.totalItems > 0 ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold font-mono border ${
                              payProgress.isComplete
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : payProgress.settledItems > 0
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {payProgress.isComplete ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Clock className="w-3 h-3 text-purple-600" />
                            )}
                            {payProgress.settledItems}/{payProgress.totalItems} 项已付
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">无应付杂费</span>
                        )}
                        {payProgress && !payProgress.isComplete && payProgress.unpaidCny > 0 && (
                          <div className="text-[10px] text-purple-600 font-mono mt-0.5">
                            未付 ¥{payProgress.unpaidCny.toFixed(2)}
                          </div>
                        )}
                      </td>

                      {/* 折合总应收 */}
                      <td className="py-3 px-4 text-right font-mono">
                        <div className="text-sm font-bold text-emerald-700">
                          ¥ {Number(wb.receivableAmount || 0).toFixed(2)}
                        </div>
                        {wb.settlementCurrency && wb.settlementCurrency !== 'CNY' && wb.rawReceivableAmount ? (
                          <div className="text-[10px] text-slate-400">
                            {wb.settlementCurrency === 'PHP' ? '₱' : '$'}{' '}
                            {Number(wb.rawReceivableAmount).toLocaleString('zh-CN', {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                        ) : null}
                      </td>

                      {/* 折合总应付 */}
                      <td className="py-3 px-4 text-right font-mono text-sm font-bold text-slate-700">
                        ¥ {Number(wb.payableAmount || 0).toFixed(2)}
                      </td>

                      {/* 纯毛利与利率 */}
                      <td className="py-3 px-4 text-right font-mono">
                        <div className={`text-sm font-black ${profit < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                          ¥ {profit.toFixed(2)}
                        </div>
                        <div className={`text-[10px] font-bold ${profit < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                          {margin}
                        </div>
                      </td>

                      {/* 签收日期 */}
                      <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                        {wb.signedDate
                          ? new Date(wb.signedDate).toISOString().slice(0, 10)
                          : wb.status === 'DELIVERED'
                          ? '已结单'
                          : '运输在途'}
                      </td>

                      {/* 操作 */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setSelectedWaybill(wb);
                            setDrawerOpen(true);
                          }}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ml-auto shadow-xs"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          对账核算
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 分页控制栏 */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            共 <span className="font-bold text-slate-800">{pagination.total}</span> 票核算订单
            （当前第 {pagination.page} / {pagination.totalPages} 页）
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-40 transition font-semibold shadow-xs"
            >
              上一页
            </button>
            <span className="font-mono px-2 text-slate-700 font-bold">{pagination.page}</span>
            <button
              onClick={() => setPagination((p) => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-40 transition font-semibold shadow-xs"
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 单票对账核算抽屉 (Drawer) */}
      {/* ========================================================= */}
      {drawerOpen && selectedWaybill && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-4xl bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            {/* 抽屉头部 */}
            <div className="p-5 border-b border-slate-200 bg-slate-50/90 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-slate-900 font-mono">{selectedWaybill.waybillNo}</h2>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-bold">
                      {selectedWaybill.userMark}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                      {selectedWaybill.orderType === 'SEA_LCL'
                        ? '海运拼箱'
                        : selectedWaybill.orderType === 'AIR'
                        ? '空运专线'
                        : '海运整柜'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    目的国: {selectedWaybill.destinationCountry} {selectedWaybill.destinationPort ? `(${selectedWaybill.destinationPort})` : ''} ·
                    件数: {selectedWaybill.totalPieces} 件 ·
                    {selectedWaybill.orderType === 'AIR'
                      ? `重量: ${Number(selectedWaybill.totalWeightKg || 0).toFixed(2)} kg`
                      : `方量: ${Number(selectedWaybill.totalReceivableCbm || selectedWaybill.totalPayableCbm || 0).toFixed(3)} m³`}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 抽屉内容区: 两列并排 (应收 vs 应付) */}
            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white">
              {/* 左列: 应收款项清单 (RECEIVABLES) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">应收款项明细 (Receivables)</h3>
                  </div>
                  <button
                    onClick={() => handleOpenAddFee('RECEIVABLE')}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs"
                  >
                    <Plus className="w-3 h-3" />
                    添加应收杂费
                  </button>
                </div>

                {/* 1. 主运费 / 包干款条目 */}
                <div className="bg-emerald-50/30 border border-emerald-100 rounded-xl p-3.5 space-y-2 relative shadow-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        {selectedWaybill.isFixedPrice ? '📦 协议包干一口价' : '🌊 主海空运费 (算方/过磅计费)'}
                      </span>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        结算币种: {selectedWaybill.settlementCurrency || 'CNY'}
                        {selectedWaybill.settlementCurrency === 'USD' && (
                          <span> (@汇率 {Number(selectedWaybill.usdRate || 7.2).toFixed(4)})</span>
                        )}
                        {selectedWaybill.settlementCurrency === 'PHP' && (
                          <span> (@汇率 {Number(selectedWaybill.phpRate || 8.0).toFixed(4)})</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <div className="text-sm font-black text-emerald-700">
                        ¥ {Number(selectedWaybill.receivableAmount || 0).toFixed(2)}
                      </div>
                      {selectedWaybill.settlementCurrency && selectedWaybill.settlementCurrency !== 'CNY' && (
                        <div className="text-[10px] text-slate-500">
                          原币 {selectedWaybill.settlementCurrency === 'PHP' ? '₱' : '$'}{' '}
                          {Number(selectedWaybill.rawReceivableAmount || 0).toLocaleString('zh-CN', {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 结清状态栏 */}
                  <div className="pt-2 border-t border-emerald-100 flex items-center justify-between text-xs">
                    {selectedWaybill.isFreightSettled ? (
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          已结清
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {selectedWaybill.freightSettledBy || '财务'} ·{' '}
                          {selectedWaybill.freightPaymentMethod || '已核销'}
                          {selectedWaybill.freightSettledAt
                            ? ` (${new Date(selectedWaybill.freightSettledAt).toISOString().slice(0, 10)})`
                            : ''}
                        </span>
                        {selectedWaybill.freightPaymentNote && (
                          <span className="text-[10px] text-slate-400 max-w-[140px] truncate" title={selectedWaybill.freightPaymentNote}>
                            [{selectedWaybill.freightPaymentNote}]
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-600" />
                        待收款核销
                      </span>
                    )}

                    <div className="flex items-center gap-1.5">
                      {selectedWaybill.isFreightSettled ? (
                        <button
                          onClick={() => handleUnsettle('FREIGHT', undefined, '主运费')}
                          className="text-[11px] text-slate-400 hover:text-rose-600 font-semibold flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          撤销结清
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            handleOpenSettleModal({
                              type: 'FREIGHT',
                              title: '主海空运费',
                              amount: Number(selectedWaybill.rawReceivableAmount || selectedWaybill.receivableAmount || 0),
                              currency: selectedWaybill.settlementCurrency || 'CNY',
                              amountInCny: Number(selectedWaybill.receivableAmount || 0),
                            })
                          }
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          确认结清
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. 附加应收杂费清单 */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    附加代收杂费 ({selectedWaybill.fees?.filter((f) => f.feeDirection === 'RECEIVABLE').length || 0})
                  </div>

                  {(!selectedWaybill.fees ||
                    selectedWaybill.fees.filter((f) => f.feeDirection === 'RECEIVABLE').length === 0) && (
                    <div className="p-6 bg-slate-50 rounded-xl text-center text-xs text-slate-400 italic border border-dashed border-slate-200">
                      暂无代收杂费，可点击上方「+ 添加应收杂费」补录
                    </div>
                  )}

                  {(selectedWaybill.fees || [])
                    .filter((f) => f.feeDirection === 'RECEIVABLE')
                    .map((fee) => (
                      <div
                        key={fee.id}
                        className={`bg-white border rounded-xl p-3 space-y-2 transition shadow-xs ${
                          fee.isPaid ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-800 text-xs">{fee.feeName}</span>
                            {fee.note && <span className="text-[10px] text-slate-500 ml-1.5">({fee.note})</span>}
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              原币: {fee.currency} {Number(fee.amount).toFixed(2)}{' '}
                              {fee.currency !== 'CNY' && (
                                <span>(@汇率 {Number(fee.exchangeRate || 1.0).toFixed(4)})</span>
                              )}
                            </div>
                          </div>

                          <div className="text-right font-mono">
                            <span className="text-xs font-bold text-emerald-700">
                              折合 ¥ {Number(fee.amountInCny || fee.amount).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* 结清状态栏与操作 */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                          {fee.isPaid ? (
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" />
                                已结清
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {fee.paidBy || '财务'} ·{' '}
                                {fee.paymentMethod || '已核销'}
                                {fee.paidAt ? ` (${new Date(fee.paidAt).toISOString().slice(0, 10)})` : ''}
                              </span>
                              {fee.paymentNote && (
                                <span className="text-[10px] text-slate-400 max-w-[120px] truncate" title={fee.paymentNote}>
                                  [{fee.paymentNote}]
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              待结清
                            </span>
                          )}

                          <div className="flex items-center gap-2">
                            {fee.isPaid ? (
                              <button
                                onClick={() => handleUnsettle('FEE', fee.id, fee.feeName)}
                                className="text-[11px] text-slate-400 hover:text-rose-600 font-semibold flex items-center gap-1"
                              >
                                <RotateCcw className="w-3 h-3" />
                                撤销结清
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleOpenEditFee(fee)}
                                  className="text-slate-400 hover:text-slate-700 p-1"
                                  title="修改费用金额与汇率"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => fee.id && handleDeleteFee(fee.id, fee.feeName)}
                                  className="text-slate-400 hover:text-rose-600 p-1"
                                  title="删除此费用"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleOpenSettleModal({
                                      type: 'FEE',
                                      feeId: fee.id,
                                      title: fee.feeName,
                                      amount: Number(fee.amount),
                                      currency: fee.currency,
                                      amountInCny: Number(fee.amountInCny || fee.amount),
                                    })
                                  }
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition shadow-xs flex items-center gap-1"
                                >
                                  <ShieldCheck className="w-3 h-3" />
                                  结清
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* 右列: 应付款项清单 (PAYABLES) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                      <ArrowDownRight className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">应付款项明细 (Payables)</h3>
                  </div>
                  <button
                    onClick={() => handleOpenAddFee('PAYABLE')}
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs"
                  >
                    <Plus className="w-3 h-3" />
                    添加应付成本
                  </button>
                </div>

                {/* 附加应付成本清单 (包括运单通用应付与整柜干线/还柜异常成本) */}
                <div className="space-y-2">
                  {(!selectedWaybill.fees ||
                    selectedWaybill.fees.filter((f) => f.feeDirection === 'PAYABLE').length === 0) &&
                    (!selectedWaybill.containerMaster?.fees ||
                      selectedWaybill.containerMaster.fees.length === 0) && (
                    <div className="p-6 bg-slate-50 rounded-xl text-center text-xs text-slate-400 italic border border-dashed border-slate-200">
                      该运单暂未录入干线/报关/清关/拖车等应付成本
                    </div>
                  )}

                  {/* 整柜干线履约与还柜异常成本 (ContainerMaster Fees) */}
                  {selectedWaybill.orderType === 'SEA_FCL' &&
                    (selectedWaybill.containerMaster?.fees || []).map((cfee: any) => {
                      const subInfo = CONTAINER_FEE_SUBJECTS.find((s) => s.value === cfee.feeSubject);
                      const displayName = subInfo ? subInfo.label : cfee.feeSubject || '集装箱成本';
                      const badgeText = subInfo ? subInfo.badge : '整柜成本';
                      return (
                        <div
                          key={`cfee-${cfee.id}`}
                          className={`bg-white border rounded-xl p-3 space-y-2 transition shadow-xs ${
                            cfee.isPaid ? 'border-rose-200 bg-rose-50/10' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                                  [{badgeText}]
                                </span>
                                <span className="font-bold text-slate-800 text-xs">{displayName}</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  (柜号: {selectedWaybill.containerMaster?.containerNo || '未绑定'})
                                </span>
                              </div>
                              {cfee.note && (
                                <div className="text-[10px] text-slate-500 mt-0.5">备注: {cfee.note}</div>
                              )}
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                原币: {cfee.currency} {Number(cfee.amount).toFixed(2)}{' '}
                                {cfee.currency !== 'CNY' && (
                                  <span>(@汇率 {Number(cfee.exchangeRate || 1.0).toFixed(4)})</span>
                                )}
                              </div>
                            </div>

                            <div className="text-right font-mono">
                              <span className="text-xs font-bold text-rose-700">
                                折合 ¥ {Number(cfee.amountInCny || cfee.amount).toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {/* 结清状态栏与操作 */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                            {cfee.isPaid ? (
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-bold flex items-center gap-1">
                                  <Lock className="w-2.5 h-2.5" />
                                  已付款
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {cfee.paidBy || '财务'} · {cfee.paymentMethod || '已支付'}
                                  {cfee.paidAt ? ` (${new Date(cfee.paidAt).toISOString().slice(0, 10)})` : ''}
                                </span>
                                {cfee.paymentNote && (
                                  <span className="text-[10px] text-slate-400 max-w-[120px] truncate" title={cfee.paymentNote}>
                                    [{cfee.paymentNote}]
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                待付款
                              </span>
                            )}

                            <div className="flex items-center gap-2">
                              {cfee.isPaid ? (
                                <button
                                  onClick={() => handleUnsettle('FEE', cfee.id, displayName)}
                                  className="text-[11px] text-slate-400 hover:text-rose-600 font-semibold flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  撤销付款
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() =>
                                      handleOpenEditFee({
                                        id: cfee.id,
                                        feeName: displayName,
                                        feeDirection: 'PAYABLE',
                                        amount: cfee.amount,
                                        currency: cfee.currency,
                                        exchangeRate: cfee.exchangeRate,
                                        note: cfee.note,
                                        feeSubject: cfee.feeSubject,
                                        isPaid: cfee.isPaid,
                                      })
                                    }
                                    className="text-slate-400 hover:text-slate-700 p-1"
                                    title="修改成本金额与汇率"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => cfee.id && handleDeleteFee(cfee.id, displayName)}
                                    className="text-slate-400 hover:text-rose-600 p-1"
                                    title="删除此成本项"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleOpenSettleModal({
                                        type: 'FEE',
                                        feeId: cfee.id,
                                        title: displayName,
                                        amount: Number(cfee.amount),
                                        currency: cfee.currency,
                                        amountInCny: Number(cfee.amountInCny || cfee.amount),
                                      })
                                    }
                                    className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold transition shadow-xs flex items-center gap-1"
                                  >
                                    <ShieldCheck className="w-3 h-3" />
                                    确认付款
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  {/* 运单常规应付杂费 (Waybill Fees) */}

                  {(selectedWaybill.fees || [])
                    .filter((f) => f.feeDirection === 'PAYABLE')
                    .map((fee) => (
                      <div
                        key={fee.id}
                        className={`bg-white border rounded-xl p-3 space-y-2 transition shadow-xs ${
                          fee.isPaid ? 'border-rose-200 bg-rose-50/10' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-800 text-xs">{fee.feeName}</span>
                            {fee.note && <span className="text-[10px] text-slate-500 ml-1.5">({fee.note})</span>}
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              原币: {fee.currency} {Number(fee.amount).toFixed(2)}{' '}
                              {fee.currency !== 'CNY' && (
                                <span>(@汇率 {Number(fee.exchangeRate || 1.0).toFixed(4)})</span>
                              )}
                            </div>
                          </div>

                          <div className="text-right font-mono">
                            <span className="text-xs font-bold text-rose-700">
                              折合 ¥ {Number(fee.amountInCny || fee.amount).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* 结清状态栏与操作 */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                          {fee.isPaid ? (
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-bold flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" />
                                已付款
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {fee.paidBy || '财务'} ·{' '}
                                {fee.paymentMethod || '已支付'}
                                {fee.paidAt ? ` (${new Date(fee.paidAt).toISOString().slice(0, 10)})` : ''}
                              </span>
                              {fee.paymentNote && (
                                <span className="text-[10px] text-slate-400 max-w-[120px] truncate" title={fee.paymentNote}>
                                  [{fee.paymentNote}]
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              待付款
                            </span>
                          )}

                          <div className="flex items-center gap-2">
                            {fee.isPaid ? (
                              <button
                                onClick={() => handleUnsettle('FEE', fee.id, fee.feeName)}
                                className="text-[11px] text-slate-400 hover:text-rose-600 font-semibold flex items-center gap-1"
                              >
                                <RotateCcw className="w-3 h-3" />
                                撤销付款
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleOpenEditFee(fee)}
                                  className="text-slate-400 hover:text-slate-700 p-1"
                                  title="修改成本金额与汇率"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => fee.id && handleDeleteFee(fee.id, fee.feeName)}
                                  className="text-slate-400 hover:text-rose-600 p-1"
                                  title="删除此成本项"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleOpenSettleModal({
                                      type: 'FEE',
                                      feeId: fee.id,
                                      title: fee.feeName,
                                      amount: Number(fee.amount),
                                      currency: fee.currency,
                                      amountInCny: Number(fee.amountInCny || fee.amount),
                                    })
                                  }
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold transition shadow-xs flex items-center gap-1"
                                >
                                  <ShieldCheck className="w-3 h-3" />
                                  确认付款
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* ========================================================= */}
              {/* 统一收付款凭证与单据图文归档画廊专区 (Voucher & Proofs Archive) */}
              {/* ========================================================= */}
              <div className="col-span-1 lg:col-span-2 pt-6 border-t border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                      <Paperclip className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      统一收付款凭证与单据图文归档
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-mono font-semibold">
                        {(selectedWaybill.attachments || []).length} 份文件
                      </span>
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setBatchVoucherFiles([]);
                      setNewVoucherType('OTHER');
                      setCustomVoucherType('');
                      setVoucherUploadModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    + 批量上传凭证
                  </button>
                </div>

                {(!selectedWaybill.attachments || selectedWaybill.attachments.length === 0) ? (
                  <div className="p-8 bg-slate-50 rounded-2xl text-center border border-dashed border-slate-200 space-y-2">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mx-auto text-slate-400 shadow-xs border border-slate-100">
                      <Paperclip className="w-5 h-5" />
                    </div>
                    <p className="text-xs text-slate-600 font-medium">暂无归档凭证</p>
                    <p className="text-[11px] text-slate-400">
                      支持随时上传客户打款水单、银行电汇底单、海关税单或车队发票
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                    {selectedWaybill.attachments.map((att) => {
                      const isImg =
                        /\.(jpg|jpeg|png|webp|gif|bmp)(\?.*)?$/i.test(att.fileUrl) ||
                        att.fileUrl.startsWith('data:image');
                      const isPdf = /\.pdf(\?.*)?$/i.test(att.fileUrl);

                      const customMatch = att.fileName?.match(/^\[(.*?)\]/);
                      const typeLabel =
                        customMatch && customMatch[1]
                          ? customMatch[1]
                          : att.attachmentType === 'PAYMENT_PROOF'
                          ? '收付款水单'
                          : att.attachmentType === 'CUSTOMS_SLIP'
                          ? '缴税放行单'
                          : att.attachmentType === 'SIGN_IMAGE'
                          ? '客户签收单'
                          : att.attachmentType === 'BILL_OF_LADING'
                          ? '海运提单'
                          : '其他凭据';

                      const displayFileName = customMatch ? att.fileName?.replace(/^\[.*?\]\s*/, '') : att.fileName;

                      return (
                        <div
                          key={att.id}
                          className="group relative bg-white border border-slate-200 hover:border-blue-400 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition flex flex-col"
                        >
                          {/* 预览缩略图容器 */}
                          <div
                            onClick={() => {
                              if (isImg) {
                                setPreviewImageUrl(att.fileUrl);
                              } else {
                                window.open(att.fileUrl, '_blank');
                              }
                            }}
                            className="h-32 bg-slate-100 relative cursor-pointer overflow-hidden flex items-center justify-center"
                          >
                            {isImg ? (
                              <>
                                <img
                                  src={att.fileUrl}
                                  alt={att.fileName || '凭证图片'}
                                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                />
                                <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold gap-1">
                                  <Eye className="w-4 h-4" /> 点击放大
                                </div>
                              </>
                            ) : isPdf ? (
                              <div className="flex flex-col items-center justify-center text-rose-600 gap-1 p-2 text-center">
                                <span className="px-2 py-0.5 bg-rose-50 rounded font-bold text-xs border border-rose-200">
                                  PDF 文档
                                </span>
                                <span className="text-[10px] text-slate-500 truncate max-w-[120px]">
                                  {displayFileName || '打开文档'}
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center text-blue-600 gap-1 p-2 text-center">
                                <Paperclip className="w-6 h-6" />
                                <span className="text-[10px] text-slate-500 truncate max-w-[120px]">
                                  {displayFileName || '附件文件'}
                                </span>
                              </div>
                            )}

                            {/* 类型标签徽章 */}
                            <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-xs text-slate-700 border border-slate-200 font-bold shadow-xs">
                              {typeLabel}
                            </span>
                          </div>

                          {/* 卡片底部信息 */}
                          <div className="p-2.5 bg-white flex items-center justify-between text-[11px] border-t border-slate-100">
                            <div className="truncate pr-2">
                              <div className="font-semibold text-slate-800 truncate" title={att.fileName || ''}>
                                {displayFileName || '凭证单据'}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {att.uploadedAt ? new Date(att.uploadedAt).toISOString().slice(0, 10) : ''}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteVoucher(att.id, att.fileName || '')}
                              className="text-slate-400 hover:text-rose-600 p-1 transition shrink-0"
                              title="删除此凭证"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 抽屉底部汇总条 */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-6 text-xs font-mono">
                <div>
                  <span className="text-slate-500">总应收: </span>
                  <span className="text-emerald-700 font-bold">
                    ¥ {Number(selectedWaybill.receivableAmount || 0).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">总成本: </span>
                  <span className="text-rose-700 font-bold">
                    ¥ {Number(selectedWaybill.payableAmount || 0).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">净毛利: </span>
                  <span
                    className={`font-black ${
                      Number(selectedWaybill.profitAmount || 0) < 0 ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                  >
                    ¥ {Number(selectedWaybill.profitAmount || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setDrawerOpen(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition shadow-xs"
              >
                关闭抽屉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 款项结清 / 付款确认模态框 */}
      {/* ========================================================= */}
      {settleModalOpen && settleTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-100 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">款项结清确认</h3>
                  <p className="text-[11px] text-slate-500">逐笔确认款项已实收或实付，并归档凭证</p>
                </div>
              </div>
              <button
                onClick={() => setSettleModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">核销科目:</span>
                <span className="text-slate-900 font-bold">{settleTarget.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">发生原币:</span>
                <span className="text-emerald-600 font-bold">
                  {settleTarget.currency} {Number(settleTarget.amount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">折合人民币:</span>
                <span className="text-emerald-700 font-bold">
                  ¥ {Number(settleTarget.amountInCny).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  结算收付款渠道 <span className="text-rose-500">*</span>
                </label>
                <select
                  value={settlePaymentMethod}
                  onChange={(e) => setSettlePaymentMethod(e.target.value)}
                  className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-2xs"
                >
                  <option value="银行对公">银行对公账户转账</option>
                  <option value="菲律宾BDO">菲律宾 BDO 银行转账</option>
                  <option value="菲律宾BPI">菲律宾 BPI 银行转账</option>
                  <option value="菲律宾GCash">菲律宾 GCash 电子钱包</option>
                  <option value="微信支付">微信支付</option>
                  <option value="支付宝">支付宝</option>
                  <option value="现金现结">现金现结</option>
                  <option value="其他渠道">其他渠道</option>
                </select>
              </div>

              {/* 订单级凭证防漏智能提醒 */}
              {selectedWaybill && (
                <div>
                  {(selectedWaybill.attachments && selectedWaybill.attachments.length > 0) ? (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-[11px]">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        本单已在凭证库归档 <strong>{selectedWaybill.attachments.length}</strong> 份单据与收付款凭证，可直接确认结清。
                      </span>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-800 text-[11px]">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-amber-900">提示：本运单暂未归档任何收付款凭证</div>
                        <div className="text-[10px] text-amber-700 mt-0.5">
                          建议先在抽屉下方的凭证区批量上传转账水单，亦可直接确认结清稍后补齐。
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">核销流水备注 (选填)</label>
                <input
                  type="text"
                  placeholder="如: 8月25日工行已到账 / 现金收讫"
                  value={settlePaymentNote}
                  onChange={(e) => setSettlePaymentNote(e.target.value)}
                  className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-2xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSettleModalOpen(false)}
                className="px-4 py-2 text-slate-500 hover:text-slate-800 text-xs font-semibold"
              >
                取消
              </button>
              <button
                type="button"
                disabled={settleSubmitting}
                onClick={handleConfirmSettle}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {settleSubmitting ? '核销处理中...' : '确认结清此款项'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 财务增改费用模态框 */}
      {/* ========================================================= */}
      {feeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-100 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div
                  className={`p-2 rounded-xl ${
                    feeDirection === 'RECEIVABLE'
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-rose-50 text-rose-600'
                  }`}
                >
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingFeeId ? '修改费用科目' : feeDirection === 'RECEIVABLE' ? '补录应收杂费' : '补录应付成本'}
                  </h3>
                  <p className="text-[11px] text-slate-500">录入后系统将即时联动重新计算总账与纯毛利</p>
                </div>
              </div>
              <button onClick={() => setFeeModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-xl font-bold">
                ✕
              </button>
            </div>

            {!editingFeeId && selectedWaybill?.orderType === 'SEA_FCL' && selectedWaybill.containerMaster && feeDirection === 'PAYABLE' && (
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setFeeCategoryType('CONTAINER');
                    setContainerFeeSubject('BOOKING_FEE');
                    const found = CONTAINER_FEE_SUBJECTS.find((s) => s.value === 'BOOKING_FEE');
                    setFeeName(found?.label || '海运订舱费 (BOOKING_FEE)');
                    const curr = found?.defaultCurrency || 'USD';
                    setFeeCurrency(curr);
                    setFeeExchangeRate(
                      curr === 'USD'
                        ? selectedWaybill.usdRate || 7.2
                        : curr === 'PHP'
                        ? selectedWaybill.phpRate || 8.0
                        : 1.0
                    );
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    feeCategoryType === 'CONTAINER'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  🚢 整柜履约成本 (集装箱科目)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFeeCategoryType('CUSTOM');
                    setFeeName('');
                    setFeeCurrency('CNY');
                    setFeeExchangeRate(1.0);
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    feeCategoryType === 'CUSTOM'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  📝 其他通用杂费
                </button>
              </div>
            )}

            <form onSubmit={handleSaveFee} className="space-y-3.5 text-xs">
              {feeCategoryType === 'CONTAINER' && selectedWaybill?.containerMaster && !editingFeeId ? (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    整柜标准成本科目{' '}
                    <span className="text-emerald-600 font-normal">
                      (关联合同柜号: {selectedWaybill.containerMaster.containerNo})
                    </span>
                  </label>
                  <select
                    value={containerFeeSubject}
                    onChange={(e) => {
                      const val = e.target.value;
                      setContainerFeeSubject(val);
                      const found = CONTAINER_FEE_SUBJECTS.find((s) => s.value === val);
                      if (found) {
                        setFeeName(found.label);
                        const curr = found.defaultCurrency;
                        setFeeCurrency(curr);
                        if (curr === 'USD') {
                          setFeeExchangeRate(selectedWaybill?.usdRate || 7.2);
                        } else if (curr === 'PHP') {
                          setFeeExchangeRate(selectedWaybill?.phpRate || 8.0);
                        } else {
                          setFeeExchangeRate(1.0);
                        }
                      }
                    }}
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 font-semibold shadow-2xs"
                  >
                    {CONTAINER_FEE_SUBJECTS.map((sub) => (
                      <option key={sub.value} value={sub.value}>
                        [{sub.badge}] {sub.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 mt-1.5 font-sans">
                    💡 该费用将直接记入集装箱履约成本台账，与集装箱跟踪及还柜异常联动核销。
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    费用科目名称 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={feeDirection === 'RECEIVABLE' ? '如: 代收报关费 / 送货车费' : '如: 码头THC堆存 / 拖车费 / 派件小费'}
                    value={feeName}
                    onChange={(e) => setFeeName(e.target.value)}
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-2xs"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">结算币种</label>
                  <select
                    value={feeCurrency}
                    onChange={(e) => {
                      const curr = e.target.value as CurrencyType;
                      setFeeCurrency(curr);
                      if (curr === 'PHP') {
                        setFeeExchangeRate(selectedWaybill?.phpRate || 8.0);
                      } else if (curr === 'USD') {
                        setFeeExchangeRate(selectedWaybill?.usdRate || 7.2);
                      } else {
                        setFeeExchangeRate(1.0);
                      }
                    }}
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold shadow-2xs"
                  >
                    <option value="CNY">¥ 人民币 (CNY)</option>
                    <option value="PHP">₱ 菲律宾比索 (PHP)</option>
                    <option value="USD">$ 美元 (USD)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    原币发生金额 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="如: 500.00"
                    value={feeAmount}
                    onChange={(e) => setFeeAmount(e.target.value ? Number(e.target.value) : '')}
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono font-bold shadow-2xs"
                  />
                </div>
              </div>

              {feeCurrency !== 'CNY' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    折合人民币汇率 ({feeCurrency === 'USD' ? '1 USD = X CNY' : '1 CNY = Y PHP'})
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    required
                    value={feeExchangeRate}
                    onChange={(e) => setFeeExchangeRate(e.target.value ? Number(e.target.value) : '')}
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono shadow-2xs"
                  />
                </div>
              )}

              {/* 实时折合人民币预览 */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 font-mono flex items-center justify-between text-xs">
                <span className="text-slate-500">折合人民币预计:</span>
                <span className="text-emerald-600 font-black text-sm">
                  ¥ {calcFeePreviewCny().toFixed(2)}
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">费用备注 (选填)</label>
                <input
                  type="text"
                  placeholder="如: 进港拖车费发票实付"
                  value={feeNote}
                  onChange={(e) => setFeeNote(e.target.value)}
                  className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-2xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFeeModalOpen(false)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-800 text-xs font-semibold"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={feeSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {feeSubmitting ? '保存重算中...' : '确认并重新核算利润'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 批量上传收付款凭证图文模态框 */}
      {/* ========================================================= */}
      {voucherUploadModalOpen && selectedWaybill && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-100 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">批量归档收付款凭证与单据</h3>
                  <p className="text-[11px] text-slate-500">
                    为运单 {selectedWaybill.waybillNo} 集中上传打款水单、银行电汇底单或发票
                  </p>
                </div>
              </div>
              <button
                onClick={() => setVoucherUploadModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBatchVouchers} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  单据凭证分类 <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newVoucherType}
                  onChange={(e) => setNewVoucherType(e.target.value)}
                  className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold shadow-2xs"
                >
                  <option value="OTHER">其他单据凭证 (默认，支持自定义输入)</option>
                  <option value="PAYMENT_PROOF">收付款水单 / 银行电子回单</option>
                  <option value="CUSTOMS_SLIP">海关缴税放行水单</option>
                  <option value="SIGN_IMAGE">客户签字签收回执</option>
                  <option value="BILL_OF_LADING">海运提单 (B/L) 扫描件</option>
                </select>

                {newVoucherType === 'OTHER' && (
                  <div className="mt-2.5 p-2.5 bg-blue-50/50 border border-blue-200 rounded-xl space-y-1 animate-in fade-in duration-200">
                    <label className="block text-blue-900 font-semibold text-[11px]">
                      ✏️ 自定义分类名称 / 凭证说明 (选填)
                    </label>
                    <input
                      type="text"
                      placeholder="如: 送货签收单、装柜过磅单、现场破损拍照"
                      value={customVoucherType}
                      onChange={(e) => setCustomVoucherType(e.target.value)}
                      className="w-full py-1.5 px-2.5 bg-white border border-blue-200 rounded-lg text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 text-xs shadow-2xs"
                    />
                    <p className="text-[10px] text-blue-600">
                      填写的自定义名称将作为该批凭证的归档分类标识，留空默认保存为原始文件名。
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  选择并上传凭证文件 (支持多选 / 批量拖拽) <span className="text-rose-500">*</span>
                </label>
                <LocalFileUpload
                  multiple
                  multipleFiles={batchVoucherFiles}
                  onMultipleChange={(files) => setBatchVoucherFiles(files)}
                  helperText="可同时多选/拖拽多张 JPG、PNG 水单截图或银行 PDF 回单"
                />
              </div>

              {batchVoucherFiles.length > 0 && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-700 font-semibold">
                    <span>待归档文件清单:</span>
                    <span className="text-blue-600 font-mono font-bold">共 {batchVoucherFiles.length} 份文件</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {batchVoucherFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between px-2.5 py-1.5 bg-white rounded-lg text-[11px] text-slate-700 border border-slate-200 shadow-2xs"
                      >
                        <span className="truncate max-w-[320px]" title={file.name}>
                          {idx + 1}. {file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setBatchVoucherFiles((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          className="text-slate-400 hover:text-rose-600 p-0.5"
                          title="移除此项"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVoucherUploadModalOpen(false)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-800 text-xs font-semibold"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={voucherSubmitting || batchVoucherFiles.length === 0}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {voucherSubmitting
                    ? '批量归档中...'
                    : `确认批量归档 (${batchVoucherFiles.length} 份)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 凭证大图预览 Lightbox 模态框 */}
      {/* ========================================================= */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 text-sm font-bold flex items-center gap-1 bg-slate-800/80 px-3 py-1 rounded-full"
            >
              <X className="w-4 h-4" /> 关闭预览
            </button>
            <img
              src={previewImageUrl}
              alt="收付款凭证大图"
              className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl border border-slate-700"
            />
          </div>
        </div>
      )}
    </div>
  );
}
