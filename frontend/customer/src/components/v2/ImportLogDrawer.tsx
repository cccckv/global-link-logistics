import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Copy,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

export interface ImportLogItem {
  id: string;
  importType: string;
  fileName: string | null;
  totalCount: number;
  successCount: number;
  failedCount: number;
  errors: Array<{ row: number; userMark: string; reason: string }>;
  successWaybills?: string[];
  operatorId?: string | null;
  operatorName?: string | null;
  createdAt: string;
}

interface ImportLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: string;
}

const TYPE_CONFIG: Record<string, { label: string; badgeColor: string }> = {
  ALL: { label: '全部类型', badgeColor: 'bg-slate-100 text-slate-700 border-slate-200' },
  SEA_LCL: { label: '海运散拼', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200' },
  SEA_FCL: { label: '海运整柜', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  AIR: { label: '空运专线', badgeColor: 'bg-sky-50 text-sky-700 border-sky-200' },
  CUSTOMER: { label: '客户档案', badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
};

export const ImportLogDrawer: React.FC<ImportLogDrawerProps> = ({
  isOpen,
  onClose,
  defaultType = 'ALL',
}) => {
  const [activeType, setActiveType] = useState<string>(defaultType);
  const [logs, setLogs] = useState<ImportLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [expandedWaybillsId, setExpandedWaybillsId] = useState<string | null>(null);

  const limit = 15;

  const fetchLogs = async (typeToFetch = activeType, pageToFetch = page) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('jwt_token') || localStorage.getItem('token');
      const url = `/api/v2/import/logs?type=${typeToFetch}&page=${pageToFetch}&limit=${limit}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLogs(data.data.logs || []);
        setTotal(data.data.total || 0);
      } else {
        toast.error(data.error || '获取导入日志失败');
      }
    } catch (err: any) {
      toast.error(err.message || '网络请求失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setActiveType(defaultType);
      setPage(1);
      fetchLogs(defaultType, 1);
    }
  }, [isOpen, defaultType]);

  const handleTypeChange = (type: string) => {
    setActiveType(type);
    setPage(1);
    fetchLogs(type, 1);
  };

  const handleCopyErrors = (errors: Array<{ row: number; userMark: string; reason: string }>) => {
    if (!errors || errors.length === 0) return;
    const text = errors
      .map((err) => `第 ${err.row} 行 | 唛头: ${err.userMark || '-'} | 原因: ${err.reason}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    toast.success('已复制异常明细');
  };

  if (!isOpen) return null;

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-fade-in">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out">
        {/* 抽屉头部 */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-800">批量导入历史日志</h3>
                <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                  共 {total} 次记录
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">追溯历史导入任务的入库统计与逐行跳过异常明细</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchLogs()}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="刷新日志"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="关闭"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 类型筛选 Tabs */}
        <div className="px-6 py-3 border-b border-slate-100 flex items-center space-x-2 overflow-x-auto bg-white">
          {Object.entries(TYPE_CONFIG).map(([typeKey, cfg]) => {
            const isActive = activeType === typeKey;
            return (
              <button
                key={typeKey}
                onClick={() => handleTypeChange(typeKey)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* 日志列表内容区 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/40">
          {loading && logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
              <p className="text-xs">正在加载导入日志...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <FileSpreadsheet className="w-12 h-12 text-slate-300 mb-3 stroke-[1.5]" />
              <p className="text-sm font-medium text-slate-600">暂无批量导入记录</p>
              <p className="text-xs text-slate-400 mt-1">上传并导入 Excel 后，将在此处自动沉淀记录与错误日志</p>
            </div>
          ) : (
            logs.map((log) => {
              const typeCfg = TYPE_CONFIG[log.importType] || {
                label: log.importType,
                badgeColor: 'bg-slate-100 text-slate-700',
              };
              const isErrorExpanded = expandedLogId === log.id;
              const isWaybillsExpanded = expandedWaybillsId === log.id;
              const formattedDate = new Date(log.createdAt).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              return (
                <div
                  key={log.id}
                  className="bg-white rounded-xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all overflow-hidden"
                >
                  {/* 卡片头部 */}
                  <div className="p-4 border-b border-slate-100/80">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${typeCfg.badgeColor}`}
                        >
                          {typeCfg.label}
                        </span>
                        <span className="text-xs font-medium text-slate-800 truncate max-w-xs" title={log.fileName || ''}>
                          {log.fileName || 'Excel 导入任务'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 text-slate-400 text-xs">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formattedDate}</span>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center space-x-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>操作人: {log.operatorName || '管理员'}</span>
                      </div>
                    </div>
                  </div>

                  {/* 统计指标卡片 */}
                  <div className="grid grid-cols-3 divide-x divide-slate-100 bg-slate-50/50 py-2.5 text-center">
                    <div>
                      <div className="text-[11px] text-slate-400">总处理</div>
                      <div className="text-sm font-bold text-slate-700 mt-0.5">{log.totalCount}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-emerald-600 font-medium">成功入库</div>
                      <div className="text-sm font-bold text-emerald-700 mt-0.5">{log.successCount}</div>
                    </div>
                    <div>
                      <div className={`text-[11px] font-medium ${log.failedCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                        异常跳过
                      </div>
                      <div
                        className={`text-sm font-bold mt-0.5 ${
                          log.failedCount > 0 ? 'text-amber-700' : 'text-slate-700'
                        }`}
                      >
                        {log.failedCount}
                      </div>
                    </div>
                  </div>

                  {/* 异常展开栏 */}
                  {log.failedCount > 0 && log.errors && log.errors.length > 0 && (
                    <div className="border-t border-amber-100 bg-amber-50/30">
                      <div
                        onClick={() => setExpandedLogId(isErrorExpanded ? null : log.id)}
                        className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-amber-100/40 select-none transition-colors"
                      >
                        <div className="flex items-center space-x-1.5 text-xs text-amber-900 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          <span>异常明细 ({log.errors.length} 条)</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyErrors(log.errors);
                            }}
                            className="text-[11px] text-amber-800 hover:text-amber-950 font-medium inline-flex items-center space-x-1 bg-white px-2 py-0.5 rounded border border-amber-300 transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                            <span>复制</span>
                          </button>
                          {isErrorExpanded ? (
                            <ChevronUp className="w-4 h-4 text-amber-600" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-amber-600" />
                          )}
                        </div>
                      </div>

                      {isErrorExpanded && (
                        <div className="max-h-56 overflow-y-auto px-4 pb-3">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-amber-200/80 text-amber-800">
                                <th className="py-1.5 pr-2 font-semibold w-16">Excel行号</th>
                                <th className="py-1.5 pr-2 font-semibold w-24">唛头</th>
                                <th className="py-1.5 font-semibold">跳过原因</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-100/80 bg-white/70">
                              {log.errors.map((err, idx) => (
                                <tr key={idx} className="hover:bg-amber-50/60">
                                  <td className="py-1.5 pr-2 font-mono font-medium text-slate-700">第 {err.row} 行</td>
                                  <td className="py-1.5 pr-2 text-slate-800 font-medium">{err.userMark || '-'}</td>
                                  <td className="py-1.5 text-amber-700">{err.reason}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 成功运单号展开栏 */}
                  {log.successWaybills && log.successWaybills.length > 0 && (
                    <div className="border-t border-slate-100 bg-slate-50/30">
                      <div
                        onClick={() => setExpandedWaybillsId(isWaybillsExpanded ? null : log.id)}
                        className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-100/60 select-none transition-colors"
                      >
                        <div className="flex items-center space-x-1.5 text-xs text-slate-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>已入库运单号 ({log.successWaybills.length} 票)</span>
                        </div>
                        {isWaybillsExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>

                      {isWaybillsExpanded && (
                        <div className="px-4 pb-3 flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                          {log.successWaybills.map((wNo, idx) => (
                            <span
                              key={idx}
                              className="text-[11px] font-mono font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded"
                            >
                              {wNo}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 分页控制栏 */}
        {total > limit && (
          <div className="px-6 py-3 border-t border-slate-100 bg-white flex items-center justify-between text-xs text-slate-500">
            <span>
              第 {page} / {totalPages} 页 · 共 {total} 条
            </span>
            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1 || loading}
                onClick={() => {
                  const newPage = page - 1;
                  setPage(newPage);
                  fetchLogs(activeType, newPage);
                }}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                上一页
              </button>
              <button
                disabled={page >= totalPages || loading}
                onClick={() => {
                  const newPage = page + 1;
                  setPage(newPage);
                  fetchLogs(activeType, newPage);
                }}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
