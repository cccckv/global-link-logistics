import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Search, X, Download, ChevronDown, ChevronLeft, ChevronRight, Package, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import { quickOrderApi, paymentCollectionApi } from '../lib/api';
import type { QuickOrder, PaymentCollection, QuickOrderStatus, QuickOrderDeclaration } from '../lib/api';

type TabKey = 'all' | 'loading' | 'sailing' | 'arrived' | 'customs' | 'dispatching';
type SearchType = 'orderNumber' | 'trackingNumber' | 'productName' | 'warehouseNumber';

interface ExportColumn {
  key: string;
  label: string;
  getValue: (order: QuickOrder, decl: (QuickOrderDeclaration & { id: string }) | null, isFirstDecl: boolean) => string | number;
}

const ALL_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'mark',              label: '唛头',         getValue: (o, _d, isFirst) => isFirst ? (o.userMark || o.mark || '-') : '' },
  { key: 'orderNumber',       label: '入仓单号',      getValue: (o, _d, isFirst) => isFirst ? o.orderNumber : '' },
  { key: 'airWaybillNumber',  label: '运单号',        getValue: (o, _d, isFirst) => isFirst ? (o.airWaybillNumber || '-') : '' },
  { key: 'trackingNumber',    label: '快递单号',      getValue: (_o, d) => d?.trackingNumber || '-' },
  { key: 'productName',       label: '品名',          getValue: (_o, d) => d?.productName || '-' },
  { key: 'quantity',          label: '数量',          getValue: (_o, d) => d?.quantity != null ? String(d.quantity) : '-' },
  { key: 'weight',            label: '重量(kg)',      getValue: (_o, d) => d?.weight != null ? String(d.weight) : '-' },
  { key: 'volume',            label: '体积(m³)',      getValue: (_o, d) => {
    if (!d || d.length == null || d.width == null || d.height == null) return '-';
    return (d.length * d.width * d.height / 1000000).toFixed(6);
  }},
  { key: 'receivableUnitPrice', label: '应收单价',    getValue: (_o, d) => {
    if (!d) return '-';
    if (d.phpUnitPrice != null) return `₱${d.phpUnitPrice}`;
    if (d.cnyUnitPrice != null) return `¥${d.cnyUnitPrice}`;
    return '-';
  }},
  { key: 'payableUnitPrice',  label: '应付单价',      getValue: (_o, d) => {
    if (!d) return '-';
    if (d.channelUnitPricePhp != null) return `₱${d.channelUnitPricePhp}`;
    if (d.channelUnitPriceCny != null) return `¥${d.channelUnitPriceCny}`;
    return '-';
  }},
  { key: 'declIndex',         label: '申报序号/总数', getValue: (o, d) => {
    if (!d) return '-';
    const decls = (o.declarations ?? []) as (QuickOrderDeclaration & { id: string })[];
    const idx = decls.findIndex(x => x.id === d.id);
    return `${idx + 1}/${decls.length}`;
  }},
  { key: 'containerType',     label: '订柜箱型',      getValue: (o, _d, isFirst) => isFirst ? (o.containers?.[0]?.containerType || '-') : '' },
  { key: 'warehouse',         label: '仓库',          getValue: (o, _d, isFirst) => isFirst ? (o.warehouse || '-') : '' },
  { key: 'destination',       label: '目的地',        getValue: (o, _d, isFirst) => isFirst ? o.destination : '' },
  { key: 'orderType',         label: '运输方式',      getValue: (o, _d, isFirst) => isFirst ? getTypeLabel(o.orderType) : '' },
  { key: 'status',            label: '订单状态',      getValue: (o, _d, isFirst) => isFirst ? getStatusLabel(o.status) : '' },
  { key: 'createdAt',         label: '下单时间',      getValue: (o, _d, isFirst) => isFirst ? new Date(o.createdAt).toLocaleString('zh-CN') : '' },
  { key: 'totalPieces',       label: '总件数',        getValue: (o, _d, isFirst) => isFirst ? String(o.paymentCollection?.totalPieces ?? '-') : '' },
  { key: 'totalWeight',       label: '收款总重量',    getValue: (o, _d, isFirst) => isFirst ? (o.paymentCollection?.totalWeight != null ? `${o.paymentCollection.totalWeight.toFixed(3)}kg` : '-') : '' },
  { key: 'totalVolume',       label: '收款总体积',    getValue: (o, _d, isFirst) => isFirst ? (o.paymentCollection?.totalVolume != null ? `${o.paymentCollection.totalVolume.toFixed(3)}m³` : '-') : '' },
  { key: 'receivableAmount',  label: '应收金额',      getValue: (o, _d, isFirst) => isFirst ? (o.paymentCollection ? `${o.paymentCollection.receivableCurrency === 'PHP' ? '₱' : '¥'}${o.paymentCollection.receivableAmount.toFixed(2)}` : '-') : '' },
  { key: 'payableAmount',     label: '应付金额',      getValue: (o, _d, isFirst) => isFirst ? (o.paymentCollection ? `${o.paymentCollection.payableCurrency === 'PHP' ? '₱' : '¥'}${o.paymentCollection.payableAmount.toFixed(2)}` : '-') : '' },
  { key: 'carPickupReceivable', label: '应收叫车费',  getValue: (o, _d, isFirst) => isFirst ? (o.paymentCollection?.carPickupReceivable != null ? `¥${o.paymentCollection.carPickupReceivable.toFixed(2)}` : '-') : '' },
  { key: 'carPickupActual',   label: '实收叫车费',    getValue: (o, _d, isFirst) => isFirst ? (o.paymentCollection?.carPickupActual != null ? `¥${o.paymentCollection.carPickupActual.toFixed(2)}` : '-') : '' },
  { key: 'oceanFreight',      label: '海运费',        getValue: (o, _d, isFirst) => isFirst ? (o.paymentCollection?.oceanFreight != null ? `¥${o.paymentCollection.oceanFreight.toFixed(2)}` : '-') : '' },
  { key: 'bookingFee',        label: '订舱费用',      getValue: (o, _d, isFirst) => isFirst ? (o.paymentCollection?.bookingFee != null ? `¥${o.paymentCollection.bookingFee.toFixed(2)}` : '-') : '' },
  { key: 'portGateFee',       label: '港杂费',        getValue: (o, _d, isFirst) => isFirst ? (o.paymentCollection?.portGateFee != null ? `¥${o.paymentCollection.portGateFee.toFixed(2)}` : '-') : '' },
  { key: 'truckingFee',       label: '拖车费',        getValue: (o, _d, isFirst) => isFirst ? (o.paymentCollection?.truckingFee != null ? `¥${o.paymentCollection.truckingFee.toFixed(2)}` : '-') : '' },
  { key: 'customsCertFee',    label: '报关证书费',    getValue: (o, _d, isFirst) => isFirst ? (o.paymentCollection?.customsCertFee != null ? `¥${o.paymentCollection.customsCertFee.toFixed(2)}` : '-') : '' },
  { key: 'thcOverstayFee',    label: 'THC超支/堆箱费', getValue: (o, _d, isFirst) => isFirst ? (o.paymentCollection?.thcOverstayFee != null ? `₱${o.paymentCollection.thcOverstayFee.toFixed(2)}` : '-') : '' },
  { key: 'voyageNumber',      label: '航次号',        getValue: (o, _d, isFirst) => isFirst ? (o.voyageNumber || '-') : '' },
  { key: 'originPort',        label: '起运港',        getValue: (o, _d, isFirst) => isFirst ? (o.originPort || '-') : '' },
  { key: 'destinationPort',   label: '目的港',        getValue: (o, _d, isFirst) => isFirst ? (o.destinationPort || '-') : '' },
  { key: 'billOfLading',      label: '提单号',        getValue: (o, _d, isFirst) => isFirst ? (o.billOfLading || '-') : '' },
  { key: 'containerNumber',   label: '柜号',          getValue: (o, _d, isFirst) => isFirst ? (o.containerNumber || '-') : '' },
  { key: 'bookingChannel',    label: '订舱渠道',      getValue: (o, _d, isFirst) => isFirst ? (o.bookingChannel || '-') : '' },
  { key: 'customsDeclarationChannel', label: '报关渠道', getValue: (o, _d, isFirst) => isFirst ? (o.customsDeclarationChannel || '-') : '' },
  { key: 'customsClearanceChannel',   label: '清关渠道', getValue: (o, _d, isFirst) => isFirst ? (o.customsClearanceChannel || '-') : '' },
  { key: 'totalShippingDays', label: '总计航运时间',  getValue: (o, _d, isFirst) => isFirst ? (o.totalShippingDays != null ? `${o.totalShippingDays}天` : '-') : '' },
  { key: 'loadingDate',       label: '装柜时间',      getValue: (o, _d, isFirst) => isFirst ? (o.loadingDate ? new Date(o.loadingDate).toLocaleDateString('zh-CN') : '-') : '' },
  { key: 'eta',               label: '预计到港时间',  getValue: (o, _d, isFirst) => isFirst ? (o.eta ? new Date(o.eta).toLocaleDateString('zh-CN') : '-') : '' },
  { key: 'receivedAt',        label: '入库时间',      getValue: (o, _d, isFirst) => isFirst ? (o.receivedAt ? new Date(o.receivedAt).toLocaleDateString('zh-CN') : '-') : '' },
  { key: 'overseasReceivedAt', label: '海外签收时间', getValue: (o, _d, isFirst) => isFirst ? (o.overseasReceivedAt ? new Date(o.overseasReceivedAt).toLocaleDateString('zh-CN') : '-') : '' },
  { key: 'note',              label: '备注',          getValue: (o, _d, isFirst) => isFirst ? (o.note || '-') : '' },
];

const searchTypeLabels: Record<SearchType, string> = {
  orderNumber: '订单号',
  trackingNumber: '快递单号',
  productName: '产品名称',
  warehouseNumber: '入仓单号',
};

const tabStatusMap: Record<TabKey, QuickOrderStatus | undefined> = {
  all: undefined,
  loading: 'LOADING',
  sailing: 'SAILING',
  arrived: 'ARRIVED',
  customs: 'CUSTOMS',
  dispatching: 'DISPATCHING',
};

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
    LOADING: '装柜',
    SAILING: '开船',
    ARRIVED: '靠港',
    CUSTOMS: '清关',
    DISPATCHING: '拆派',
  };
  return labels[status] || status;
};

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    LOADING: 'text-yellow-600 bg-yellow-50',
    SAILING: 'text-blue-600 bg-blue-50',
    ARRIVED: 'text-purple-600 bg-purple-50',
    CUSTOMS: 'text-orange-600 bg-orange-50',
    DISPATCHING: 'text-green-600 bg-green-50',
  };
  return colors[status] || 'text-gray-600 bg-gray-50';
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

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onClear: () => void;
}

function DateRangePicker({ startDate, endDate, onStartChange, onEndChange, onClear }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const applyPreset = (days: number | 'today' | 'week' | 'month') => {
    const end = today;
    let start = today;
    if (days === 'today') {
      start = today;
    } else if (days === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - d.getDay() + 1);
      start = d.toISOString().split('T')[0];
    } else if (days === 'month') {
      start = today.slice(0, 7) + '-01';
    } else {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1));
      start = d.toISOString().split('T')[0];
    }
    onStartChange(start);
    onEndChange(end);
    setOpen(false);
  };

  const hasValue = startDate || endDate;
  const label = hasValue
    ? `${startDate || '…'} ~ ${endDate || '…'}`
    : '下单时间';

  return (
    <div ref={ref} className="relative">
      <div className={`flex items-center gap-1.5 px-3 py-2 border rounded-md text-sm cursor-pointer transition-colors ${hasValue ? 'border-primary bg-primary/5 text-primary' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}
        onClick={() => setOpen(o => !o)}>
        <Calendar className="w-4 h-4 shrink-0" />
        <span className="whitespace-nowrap">{label}</span>
        {hasValue ? (
          <button
            onClick={(e) => { e.stopPropagation(); onStartChange(''); onEndChange(''); onClear(); }}
            className="ml-0.5 hover:text-red-500 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </div>

      {open && (
        <div className="absolute left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-72 p-3">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {([
              { label: '今天', value: 'today' as const },
              { label: '本周', value: 'week' as const },
              { label: '本月', value: 'month' as const },
              { label: '近7天', value: 7 },
              { label: '近30天', value: 30 },
              { label: '近90天', value: 90 },
            ] as { label: string; value: number | 'today' | 'week' | 'month' }[]).map(p => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.value)}
                className="px-2.5 py-1 text-xs rounded-md border border-gray-200 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              max={endDate || today}
              onChange={(e) => onStartChange(e.target.value)}
              onClick={(e) => { const el = e.currentTarget; if ('showPicker' in el) (el as HTMLInputElement).showPicker(); }}
              className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
            />
            <span className="text-gray-400 text-xs shrink-0">~</span>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              max={today}
              onChange={(e) => onEndChange(e.target.value)}
              onClick={(e) => { const el = e.currentTarget; if ('showPicker' in el) (el as HTMLInputElement).showPicker(); }}
              className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
            />
          </div>
          <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
            <button
              onClick={() => { onStartChange(''); onEndChange(''); onClear(); setOpen(false); }}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              清除
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 text-xs bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
            >
              确定
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
}

function TabButton({ active, onClick, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 text-sm font-medium transition-all whitespace-nowrap border-b-2 -mb-px ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-gray-600 hover:text-primary hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  );
}

export default function AdminOrderManagement() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<QuickOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [editingCollection, setEditingCollection] = useState<PaymentCollection | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSearchTypeDropdown, setShowSearchTypeDropdown] = useState(false);
  const searchTypeRef = useRef<HTMLDivElement>(null);

  const [searchType, setSearchType] = useState<SearchType>('orderNumber');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [markKeyword, setMarkKeyword] = useState('');
  const [orderTypeFilter, setOrderTypeFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const [counts, setCounts] = useState({
    all: 0, loading: 0, sailing: 0, arrived: 0, customs: 0, dispatching: 0,
  });

  const [editForm, setEditForm] = useState({ carPickupReceivable: 0, carPickupActual: 0, bookingFee: 0 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetStatus, setTargetStatus] = useState<string>('');
  const [batchUpdating, setBatchUpdating] = useState(false);
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportColumnKeys, setExportColumnKeys] = useState<Set<string>>(
    () => new Set(ALL_EXPORT_COLUMNS.map(c => c.key))
  );
  const [exportScope, setExportScope] = useState<'page' | 'all'>('page');
  const [exporting, setExporting] = useState(false);

  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (user.userRole !== 'ADMIN') {
    navigate('/');
    return null;
  }

  useEffect(() => {
    fetchCounts();
  }, []);

  useEffect(() => {
    loadOrders();
  }, [activeTab, pagination.page, pagination.limit]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchTypeRef.current && !searchTypeRef.current.contains(event.target as Node)) {
        setShowSearchTypeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchCounts = async () => {
    try {
      const response = await quickOrderApi.getCounts();
      setCounts(response.data);
    } catch {}
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
      };
      const tabStatus = tabStatusMap[activeTab];
      if (tabStatus) params.status = tabStatus;

      const response = await quickOrderApi.getList(params);
      setOrders(response.data.data || []);
      if (response.data.pagination) {
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination.total,
          totalPages: response.data.pagination.totalPages,
        }));
      }
      setSelectedIds(new Set());
    } catch {
      toast.error('加载订单失败');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params: any = { page: 1, limit: pagination.limit };
      if (markKeyword.trim()) params.mark = markKeyword.trim();
      if (searchKeyword.trim()) { params.searchType = searchType; params.keyword = searchKeyword.trim(); }
      if (orderTypeFilter) params.orderType = orderTypeFilter;
      if (warehouseFilter) params.warehouse = warehouseFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await quickOrderApi.getList(params);
      setOrders(response.data.data || []);
      if (response.data.pagination) {
        setPagination(prev => ({
          ...prev,
          page: 1,
          total: response.data.pagination.total,
          totalPages: response.data.pagination.totalPages,
        }));
      }
      setSelectedIds(new Set());
    } catch {
      toast.error('搜索失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    setShowExportModal(true);
  };

  const handleConfirmExport = async () => {
    if (exportColumnKeys.size === 0) {
      toast.error('请至少选择一列');
      return;
    }
    setExporting(true);
    try {
      let data: QuickOrder[];
      if (exportScope === 'all') {
        const params: Record<string, unknown> = { exportAll: true };
        const tabStatus = tabStatusMap[activeTab];
        if (tabStatus) params.status = tabStatus;
        if (markKeyword.trim()) params.mark = markKeyword.trim();
        if (searchKeyword.trim()) { params.searchType = searchType; params.keyword = searchKeyword.trim(); }
        if (orderTypeFilter) params.orderType = orderTypeFilter;
        if (warehouseFilter) params.warehouse = warehouseFilter;
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        const res = await quickOrderApi.getList(params as Parameters<typeof quickOrderApi.getList>[0]);
        data = res.data.data;
      } else {
        data = orders;
      }

      const selectedColumns = ALL_EXPORT_COLUMNS.filter(c => exportColumnKeys.has(c.key));
      const rows = data.flatMap(order => {
        const decls = (order.declarations ?? []) as (QuickOrderDeclaration & { id: string })[];
        if (decls.length === 0) {
          return [Object.fromEntries(selectedColumns.map(col => [col.label, col.getValue(order, null, true)]))];
        }
        return decls.map((decl, idx) =>
          Object.fromEntries(selectedColumns.map(col => [col.label, col.getValue(order, decl, idx === 0)]))
        );
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '订单列表');
      const filename = `订单列表_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.success(`已导出 ${data.length} 条记录`);
      setShowExportModal(false);
    } catch {
      toast.error('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  const toggleExportColumn = (key: string) => {
    setExportColumnKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleAllExportColumns = () => {
    if (exportColumnKeys.size === ALL_EXPORT_COLUMNS.length) {
      setExportColumnKeys(new Set());
    } else {
      setExportColumnKeys(new Set(ALL_EXPORT_COLUMNS.map(c => c.key)));
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }));
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map(o => o.orderId)));
    }
  };

  const toggleSelect = (orderId: string) => {
    const next = new Set(selectedIds);
    if (next.has(orderId)) { next.delete(orderId); } else { next.add(orderId); }
    setSelectedIds(next);
  };

  const handleBatchUpdate = async () => {
    if (!selectedIds.size || !targetStatus) return;
    setBatchUpdating(true);
    try {
      const result = await quickOrderApi.batchUpdateStatus([...selectedIds], targetStatus as any);
      toast.success(`已更新 ${result.data.updatedCount} 条订单状态`);
      setShowBatchConfirm(false);
      setTargetStatus('');
      await fetchCounts();
      await loadOrders();
    } catch {
      toast.error('批量更新失败');
    } finally {
      setBatchUpdating(false);
    }
  };

  const handleDeleteClick = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingOrderId(orderId);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingOrderId) return;
    try {
      await quickOrderApi.deleteOrder(deletingOrderId);
      toast.success('订单已删除');
      setShowDeleteConfirm(false);
      setDeletingOrderId(null);
      await fetchCounts();
      await loadOrders();
    } catch {
      toast.error('删除失败，请重试');
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
        bookingFee: editForm.bookingFee || undefined,
      });
      toast.success('收款信息已更新');
      setShowEditModal(false);
      loadOrders();
    } catch {
      toast.error('更新失败');
    }
  };

  const getTabCount = (tab: TabKey) => counts[tab] ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
              <h1 className="text-2xl font-bold text-gray-800 mb-4">订单列表（管理员专用）</h1>

          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <input
              type="text"
              placeholder="请输入唛头"
              value={markKeyword}
              onChange={(e) => setMarkKeyword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary w-36 text-sm"
            />

            <div className="relative flex items-center border border-gray-300 rounded-md bg-white">
              <input
                type="text"
                placeholder="请输入搜索关键词"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="px-3 py-2 border-0 focus:outline-none rounded-l-md w-52 text-sm"
              />
              <div className="h-8 w-px bg-gray-300" />
              <div ref={searchTypeRef} className="relative">
                <button
                  onClick={() => setShowSearchTypeDropdown(!showSearchTypeDropdown)}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors min-w-[90px]"
                >
                  <span className="text-sm text-gray-700">{searchTypeLabels[searchType]}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showSearchTypeDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showSearchTypeDropdown && (
                  <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                    {(Object.keys(searchTypeLabels) as SearchType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => { setSearchType(type); setShowSearchTypeDropdown(false); }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                          searchType === type ? 'bg-primary/10 text-primary font-medium' : 'text-gray-700'
                        }`}
                      >
                        {searchTypeLabels[type]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <select
              value={orderTypeFilter}
              onChange={(e) => setOrderTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">全部运输方式</option>
              <option value="SEA_FCL">海运整柜</option>
              <option value="SEA_LCL">海运拼柜</option>
              <option value="AIR">空运快递</option>
              <option value="LAND">陆运装车</option>
              <option value="PARCEL">拼邮快递</option>
            </select>

            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">全部渠道</option>
              <option value="yiwu">义乌</option>
              <option value="longyan">龙岩</option>
              <option value="guangzhou">广州</option>
            </select>

            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartChange={setStartDate}
              onEndChange={setEndDate}
              onClear={() => {}}
            />

            <button
              onClick={handleSearch}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-md hover:bg-primary-light transition-colors font-medium text-sm shadow-sm"
            >
              <Search className="w-4 h-4" />
              查询
            </button>

            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              导出Excel
            </button>
          </div>

          <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto">
            {(['all', 'loading', 'sailing', 'arrived', 'customs', 'dispatching'] as TabKey[]).map((tab) => {
              const labelMap: Record<TabKey, string> = {
                all: '全部', loading: '装柜', sailing: '开船',
                arrived: '靠港', customs: '清关', dispatching: '拆派',
              };
              return (
                <TabButton
                  key={tab}
                  active={activeTab === tab}
                  onClick={() => { setActiveTab(tab); setPagination(prev => ({ ...prev, page: 1 })); }}
                  label={`${labelMap[tab]}(${getTabCount(tab)})`}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-sm font-medium text-blue-700">已选 {selectedIds.size} 条</span>
            <select
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value)}
              className="px-3 py-1.5 text-sm border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">选择目标状态</option>
              <option value="LOADING">装柜</option>
              <option value="SAILING">开船</option>
              <option value="ARRIVED">靠港</option>
              <option value="CUSTOMS">清关</option>
              <option value="DISPATCHING">拆派</option>
            </select>
            <button
              onClick={() => { if (!targetStatus) { toast.error('请选择目标状态'); return; } setShowBatchConfirm(true); }}
              disabled={!targetStatus || batchUpdating}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              批量更新状态
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition"
            >
              取消选择
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64 bg-white rounded-lg shadow">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={orders.length > 0 && selectedIds.size === orders.length}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      </th>
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">下单时间</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="py-12 text-center">
                          <Package className="mx-auto h-12 w-12 text-gray-400" />
                          <h3 className="mt-2 text-sm font-medium text-gray-900">暂无数据</h3>
                          <p className="mt-1 text-sm text-gray-500">尝试调整搜索条件或筛选器</p>
                        </td>
                      </tr>
                    ) : (
                      orders.map((order) => (
                        <tr
                          key={order.orderId}
                          onClick={() => navigate(`/order/${order.orderId}`, { state: { from: '/admin/order-management' } })}
                          className={`hover:bg-gray-50 cursor-pointer ${selectedIds.has(order.orderId) ? 'bg-blue-50' : ''}`}
                        >
                          <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(order.orderId)}
                              onChange={() => toggleSelect(order.orderId)}
                              className="rounded border-gray-300 text-primary focus:ring-primary"
                            />
                          </td>
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
                            {(order.declarations?.filter(d => d.trackingNumber) ?? []).length > 0
                              ? `${(order.declarations?.filter(d => d.trackingNumber) ?? []).length}个`
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(order.createdAt).toLocaleString('zh-CN', {
                              year: 'numeric', month: '2-digit', day: '2-digit',
                              hour: '2-digit', minute: '2-digit', second: '2-digit',
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => handleDeleteClick(order.orderId, e)}
                              className="text-red-500 hover:text-red-700 transition-colors"
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {orders.length > 0 && (
              <div className="bg-white mt-4 px-6 py-4 flex items-center justify-between rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    共 <span className="font-semibold text-gray-900">{pagination.total}</span> 条
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">每页</span>
                    <select
                      value={pagination.limit}
                      onChange={(e) => handleLimitChange(Number(e.target.value))}
                      className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white cursor-pointer"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <span className="text-sm text-gray-600">条</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="inline-flex items-center justify-center w-9 h-9 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-md border border-gray-200">
                    <span className="text-sm text-gray-600">第</span>
                    <span className="text-sm font-semibold text-primary min-w-[20px] text-center">{pagination.page}</span>
                    <span className="text-sm text-gray-600">/</span>
                    <span className="text-sm text-gray-900">{pagination.totalPages}</span>
                    <span className="text-sm text-gray-600">页</span>
                  </div>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                    className="inline-flex items-center justify-center w-9 h-9 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">确认删除</h2>
            <p className="text-sm text-gray-600 mb-6">
              此操作将永久删除该订单及其所有相关数据（申报明细、收款记录、付款凭证等），<span className="font-semibold text-red-600">不可恢复</span>，确认继续？
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeletingOrderId(null); }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm"
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {showBatchConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">确认批量更新</h2>
            <p className="text-sm text-gray-600 mb-6">
              将 <span className="font-semibold text-gray-900">{selectedIds.size}</span> 条订单状态更新为
              {' '}<span className="font-semibold text-blue-600">{getStatusLabel(targetStatus)}</span>，此操作不可撤销，确认继续？
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowBatchConfirm(false)} disabled={batchUpdating}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                取消
              </button>
              <button onClick={handleBatchUpdate} disabled={batchUpdating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
                {batchUpdating ? '更新中...' : '确认更新'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">导出配置</h2>
              <button onClick={() => setShowExportModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">导出列</span>
                  <button
                    onClick={toggleAllExportColumns}
                    className="text-xs text-primary hover:underline"
                  >
                    {exportColumnKeys.size === ALL_EXPORT_COLUMNS.length ? '取消全选' : '全选'}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {ALL_EXPORT_COLUMNS.map(col => (
                    <label key={col.key} className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={exportColumnKeys.has(col.key)}
                        onChange={() => toggleExportColumn(col.key)}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-gray-700">{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700 block mb-3">导出范围</span>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="exportScope"
                      value="page"
                      checked={exportScope === 'page'}
                      onChange={() => setExportScope('page')}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-gray-700">当前页（{orders.length} 条）</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="exportScope"
                      value="all"
                      checked={exportScope === 'all'}
                      onChange={() => setExportScope('all')}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-gray-700">全部数据（{pagination.total} 条）</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowExportModal(false)}
                disabled={exporting}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm"
              >
                取消
              </button>
              <button
                onClick={handleConfirmExport}
                disabled={exporting || exportColumnKeys.size === 0}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition text-sm"
              >
                <Download className="w-4 h-4" />
                {exporting ? '导出中...' : '确认导出'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">编辑收款信息</h2>
              <button onClick={() => { setShowEditModal(false); setEditingCollection(null); }}
                className="p-2 hover:bg-gray-100 rounded-lg transition">
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
                    <input type="number" step="0.01" min="0" value={editForm.carPickupReceivable}
                      onChange={(e) => setEditForm({ ...editForm, carPickupReceivable: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">实收叫车费 (¥)</label>
                    <input type="number" step="0.01" min="0" value={editForm.carPickupActual}
                      onChange={(e) => setEditForm({ ...editForm, carPickupActual: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">订舱费用 (¥)</label>
                    <input type="number" step="0.01" min="0" value={editForm.bookingFee}
                      onChange={(e) => setEditForm({ ...editForm, bookingFee: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" />
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button onClick={() => { setShowEditModal(false); setEditingCollection(null); }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                取消
              </button>
              <button onClick={handleSave}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition">
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
