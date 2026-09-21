import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  CheckSquare,
  Square,
  Sparkles,
  Layers,
  FileSpreadsheet,
  AlertCircle,
  Loader2,
  Package,
  Ship,
  Calendar,
  DollarSign,
  MapPin,
  FileText,
} from 'lucide-react';
import { waybillV2Api } from '../../lib/v2-api';

export interface WaybillExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  currentFilters: {
    orderType?: string;
    status?: string;
    search?: string;
    originWarehouse?: string;
    destinationCountry?: string;
    destinationPort?: string;
    forwarderChannel?: string;
    customsType?: string;
    unassignedOnly?: boolean;
    containerNo?: string;
    overseasKeyword?: string;
    dateType?: string;
    startDate?: string;
    endDate?: string;
  };
  totalCount: number;
  onExportSuccess?: (count: number) => void;
}

interface ColumnItem {
  key: string;
  label: string;
}

interface ColumnGroup {
  id: string;
  title: string;
  icon: React.ReactNode;
  columns: ColumnItem[];
}

const COLUMN_GROUPS: ColumnGroup[] = [
  {
    id: 'core',
    title: '核心单号与状态',
    icon: <FileText className="w-4 h-4 text-blue-600" />,
    columns: [
      { key: 'waybillNo', label: '系统运单号' },
      { key: 'expressNo', label: '专线单号/运递号' },
      { key: 'userMark', label: '客户唛头' },
      { key: 'orderType', label: '运输方式' },
      { key: 'status', label: '运单状态' },
      { key: 'createdAt', label: '下单预报时间' },
      { key: 'airWaybillNo', label: '空运单号(AWB)' },
      { key: 'trackingNumber', label: '国内快递单号' },
    ],
  },
  {
    id: 'routing',
    title: '路线与渠道流向',
    icon: <MapPin className="w-4 h-4 text-emerald-600" />,
    columns: [
      { key: 'originWarehouse', label: '起运地(仓/港)' },
      { key: 'destinationCountry', label: '目的国家' },
      { key: 'destinationPort', label: '清关目的港/机场' },
      { key: 'forwarderChannel', label: '承运专线渠道' },
      { key: 'customsType', label: '报关申报通道' },
    ],
  },
  {
    id: 'cargo',
    title: '货物实测与规格 (明细拆行)',
    icon: <Package className="w-4 h-4 text-amber-600" />,
    columns: [
      { key: 'productName', label: '中文品名' },
      { key: 'itemIndex', label: '货品序号' },
      { key: 'quantity', label: '实收件数' },
      { key: 'dimensions', label: '实测长宽高(cm)' },
      { key: 'payableVolume', label: '实测方量(m³)' },
      { key: 'receivableVolume', label: '计费方量(m³)' },
      { key: 'unitWeight', label: '单件重量(kg)' },
      { key: 'totalWeight', label: '实测总重(kg)' },
    ],
  },
  {
    id: 'shipping',
    title: '集装箱与干线船务',
    icon: <Ship className="w-4 h-4 text-indigo-600" />,
    columns: [
      { key: 'containerNo', label: '装载集装箱柜号' },
      { key: 'blNumber', label: '海运主提单号' },
      { key: 'vesselVoyage', label: '船名/航次' },
    ],
  },
  {
    id: 'milestones',
    title: '全周期节点时间',
    icon: <Calendar className="w-4 h-4 text-purple-600" />,
    columns: [
      { key: 'inboundDate', label: '国内入库实测日' },
      { key: 'loadingDate', label: '装柜/起飞日' },
      { key: 'sailingDate', label: '船舶开航日' },
      { key: 'eta', label: '预计到港日(ETA)' },
      { key: 'clearanceDate', label: '清关放行日' },
      { key: 'signedDate', label: '海外客户签收日' },
    ],
  },
  {
    id: 'consignee_finance',
    title: '海外收件与财务结算',
    icon: <DollarSign className="w-4 h-4 text-rose-600" />,
    columns: [
      { key: 'overseasName', label: '海外收件人' },
      { key: 'overseasPhone', label: '海外联系电话' },
      { key: 'overseasCompany', label: '海外收货公司' },
      { key: 'overseasAddress', label: '海外详细地址' },
      { key: 'receivableAmount', label: '客户应收总额(¥)' },
      { key: 'payableAmount', label: '承运应付成本(¥)' },
      { key: 'profitAmount', label: '单票毛利(¥)' },
      { key: 'isFixedPrice', label: '结算协议模式' },
    ],
  },
];

const ALL_COLUMN_KEYS = COLUMN_GROUPS.flatMap((g) => g.columns.map((c) => c.key));

// 常用场景化预设
const PRESETS: Record<string, { label: string; icon: string; keys: string[] }> = {
  default: {
    label: '默认调度',
    icon: '⭐',
    keys: [
      'waybillNo',
      'expressNo',
      'userMark',
      'orderType',
      'status',
      'originWarehouse',
      'destinationCountry',
      'destinationPort',
      'productName',
      'quantity',
      'receivableVolume',
      'totalWeight',
      'containerNo',
      'createdAt',
    ],
  },
  stuffing: {
    label: '现场装箱',
    icon: '📦',
    keys: [
      'waybillNo',
      'userMark',
      'orderType',
      'originWarehouse',
      'destinationPort',
      'containerNo',
      'blNumber',
      'productName',
      'quantity',
      'dimensions',
      'payableVolume',
      'totalWeight',
      'loadingDate',
    ],
  },
  customs: {
    label: '报关清关',
    icon: '🚢',
    keys: [
      'waybillNo',
      'expressNo',
      'userMark',
      'destinationCountry',
      'destinationPort',
      'customsType',
      'forwarderChannel',
      'productName',
      'quantity',
      'dimensions',
      'receivableVolume',
      'totalWeight',
      'overseasName',
      'overseasPhone',
      'overseasAddress',
      'blNumber',
      'containerNo',
    ],
  },
  finance: {
    label: '财务核算',
    icon: '💰',
    keys: [
      'waybillNo',
      'userMark',
      'orderType',
      'status',
      'productName',
      'quantity',
      'receivableVolume',
      'totalWeight',
      'receivableAmount',
      'payableAmount',
      'profitAmount',
      'isFixedPrice',
      'createdAt',
      'inboundDate',
    ],
  },
};

const STORAGE_KEY = 'v2_waybill_export_columns';

export const WaybillExportModal: React.FC<WaybillExportModalProps> = ({
  isOpen,
  onClose,
  selectedIds,
  currentFilters,
  totalCount,
  onExportSuccess,
}) => {
  const [exportScope, setExportScope] = useState<'selected' | 'filtered'>('selected');
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return new Set(parsed);
        }
      }
    } catch {
      // Ignore JSON error
    }
    return new Set(PRESETS.default.keys);
  });

  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 当打开弹窗时，如果未勾选任何单据，自动切换为“导出当前筛选”
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      if (selectedIds.length === 0) {
        setExportScope('filtered');
      } else {
        setExportScope('selected');
      }
    }
  }, [isOpen, selectedIds]);

  if (!isOpen) return null;

  const toggleColumn = (key: string) => {
    const next = new Set(selectedColumns);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedColumns(next);
  };

  const selectAll = () => {
    setSelectedColumns(new Set(ALL_COLUMN_KEYS));
  };

  const clearAll = () => {
    setSelectedColumns(new Set());
  };

  const applyPreset = (presetKey: string) => {
    const preset = PRESETS[presetKey];
    if (preset) {
      setSelectedColumns(new Set(preset.keys));
    }
  };

  const handleExport = async () => {
    if (selectedColumns.size === 0) {
      setErrorMessage('请至少勾选一个导出列');
      return;
    }

    if (exportScope === 'selected' && selectedIds.length === 0) {
      setErrorMessage('您尚未勾选任何运单，请先在表格中勾选或选择“导出当前筛选结果”');
      return;
    }

    if (exportScope === 'filtered' && totalCount === 0) {
      setErrorMessage('当前筛选条件下没有可导出的运单数据');
      return;
    }

    if (exportScope === 'filtered' && totalCount > 5000) {
      setErrorMessage(`当前筛选共 ${totalCount} 票运单，超过了单次导出 5,000 条的安全上限。请先通过日期或起运仓缩小范围。`);
      return;
    }

    setIsExporting(true);
    setErrorMessage(null);

    try {
      const columnsArray = Array.from(selectedColumns);
      // 保存至 localStorage 记忆用户偏好
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(columnsArray));
      } catch {
        // Ignore storage error
      }

      await waybillV2Api.exportWaybills({
        scope: exportScope,
        ids: exportScope === 'selected' ? selectedIds : undefined,
        columns: columnsArray,
        ...(exportScope === 'filtered' ? currentFilters : {}),
      });

      if (onExportSuccess) {
        onExportSuccess(exportScope === 'selected' ? selectedIds.length : totalCount);
      }
      onClose();
    } catch (err: any) {
      console.error('Export error:', err);
      setErrorMessage(err.message || '导出 Excel 失败，请检查网络后重试');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                自定义导出运单 Excel
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  明细拆行模式 (1件1行)
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                支持自由勾选输出字段，多件货物自动拆行展开，适配装柜、报关及对账
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-xs font-medium leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* 1. 导出范围选择 */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-600" />
              1. 选择导出数据范围
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 选中导出 */}
              <label
                className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  exportScope === 'selected'
                    ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-sm'
                    : 'border-slate-200 hover:bg-slate-50'
                } ${selectedIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="exportScope"
                    value="selected"
                    checked={exportScope === 'selected'}
                    disabled={selectedIds.length === 0}
                    onChange={() => setExportScope('selected')}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-bold text-slate-900">导出当前选中项</div>
                    <div className="text-[11px] text-slate-500">
                      已在列表勾选 <span className="font-bold text-blue-600">{selectedIds.length}</span> 票运单
                    </div>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                  {selectedIds.length} 票
                </span>
              </label>

              {/* 筛选全量导出 */}
              <label
                className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  exportScope === 'filtered'
                    ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-sm'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="exportScope"
                    value="filtered"
                    checked={exportScope === 'filtered'}
                    onChange={() => setExportScope('filtered')}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-bold text-slate-900">导出当前筛选结果</div>
                    <div className="text-[11px] text-slate-500">
                      符合当前所有筛选条件的运单全集
                    </div>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                  共 {totalCount} 票
                </span>
              </label>
            </div>
          </div>

          {/* 2. 预设场景快捷键 */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                2. 常用场景化一键预设
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  全选 ({ALL_COLUMN_KEYS.length})
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                >
                  清空
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {Object.entries(PRESETS).map(([key, p]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyPreset(key)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shadow-xs"
                >
                  <span>{p.icon}</span>
                  <span>{p.label}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({p.keys.length})</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. 全字段自由勾选区域 */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                3. 自定义勾选导出列
              </label>
              <span className="text-[11px] text-slate-500">
                已选中 <span className="font-bold text-blue-600">{selectedColumns.size}</span> / {ALL_COLUMN_KEYS.length} 列
              </span>
            </div>

            <div className="space-y-3.5">
              {COLUMN_GROUPS.map((group) => {
                const groupKeys = group.columns.map((c) => c.key);
                const allChecked = groupKeys.every((k) => selectedColumns.has(k));

                const toggleGroup = () => {
                  const next = new Set(selectedColumns);
                  if (allChecked) {
                    groupKeys.forEach((k) => next.delete(k));
                  } else {
                    groupKeys.forEach((k) => next.add(k));
                  }
                  setSelectedColumns(next);
                };

                return (
                  <div
                    key={group.id}
                    className="p-3.5 bg-slate-50/60 border border-slate-200/80 rounded-xl space-y-2.5"
                  >
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                      <div className="flex items-center gap-2 font-bold text-slate-800 text-[11px]">
                        {group.icon}
                        <span>{group.title}</span>
                      </div>
                      <button
                        type="button"
                        onClick={toggleGroup}
                        className="text-[11px] text-slate-500 hover:text-blue-600 font-medium"
                      >
                        {allChecked ? '取消组内全选' : '组内全选'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {group.columns.map((col) => {
                        const checked = selectedColumns.has(col.key);
                        return (
                          <label
                            key={col.key}
                            onClick={() => toggleColumn(col.key)}
                            className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-2 cursor-pointer transition-all select-none ${
                              checked
                                ? 'bg-white border-blue-500 text-blue-900 shadow-xs ring-1 ring-blue-500/20 font-medium'
                                : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                            }`}
                          >
                            {checked ? (
                              <CheckSquare className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}
                            <span className="truncate">{col.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            已自动开启本地列记忆 (下次打开保持勾选)
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || selectedColumns.size === 0}
              className={`px-5 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-sm transition-all ${
                isExporting || selectedColumns.size === 0
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 active:scale-98'
              }`}
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  正在生成 Excel...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  确认导出 (
                  {exportScope === 'selected' ? `${selectedIds.length} 票` : `${totalCount} 票`}
                  )
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
