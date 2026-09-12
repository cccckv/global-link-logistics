import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  RefreshCw,
  AlertCircle,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';

export type ImportType = 'CUSTOMER' | 'SEA_LCL' | 'AIR' | 'SEA_FCL' | 'LAND';

interface ImportErrorDetail {
  row: number;
  userMark: string;
  reason: string;
}

interface ImportResultData {
  total: number;
  successCount: number;
  skippedCount?: number;
  failedCount: number;
  successWaybillNos?: string[];
  errors: ImportErrorDetail[];
}

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  importType: ImportType;
  onSuccess?: () => void;
}

export const BatchImportModal: React.FC<BatchImportModalProps> = ({
  isOpen,
  onClose,
  importType,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [skipExisting, setSkipExisting] = useState(true);
  const [result, setResult] = useState<ImportResultData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [showErrorTable, setShowErrorTable] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const getTitleAndDesc = () => {
    switch (importType) {
      case 'CUSTOMER':
        return {
          title: '批量导入客户档案',
          desc: '上传标准客户档案 Excel，仅【客户唛头】必填，支持重复唛头自动跳过或覆盖更新。',
          badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        };
      case 'SEA_LCL':
        return {
          title: '海运散拼订单批量导入',
          desc: '上传散拼入库清单，系统将按分组自动聚合并通过实测尺寸精确核算应收与成本。',
          badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
        };
      case 'AIR':
        return {
          title: '空运专线订单批量导入',
          desc: '上传空运清单，系统按计费重量核算金额，支持内部车费及渠道杂费自动挂载。',
          badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
        };
      case 'SEA_FCL':
        return {
          title: '海运整柜订单批量导入',
          desc: '上传整柜进度与干线成本表，自动生成集装箱主数据及整柜协议包干单。',
          badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      case 'LAND':
        return {
          title: '陆运专线订单批量导入',
          desc: '上传陆运清单，系统按件数与体积/重量自动核算应收与成本。',
          badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
        };
    }
  };

  const config = getTitleAndDesc();

  // 下载官方标准模板
  const handleDownloadTemplate = () => {
    const url = `/api/v2/import/template?type=${importType === 'LAND' ? 'SEA_LCL' : importType}`;

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 处理文件拖拽与选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMessage('');
      setResult(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls')) {
        setFile(droppedFile);
        setErrorMessage('');
        setResult(null);
      } else {
        setErrorMessage('仅支持上传 .xlsx 或 .xls 格式的 Excel 文件');
      }
    }
  };

  // 执行上传与导入
  const handleExecuteImport = async () => {
    if (!file) {
      setErrorMessage('请先选择或拖入 Excel 文件');
      return;
    }

    setIsUploading(true);
    setUploadProgress(20);
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('jwt_token') || localStorage.getItem('token');
      if (!token) {
        throw new Error('未检测到有效登录凭证，请重新登录后再试');
      }

      let endpoint = '';
      if (importType === 'CUSTOMER') {
        endpoint = `/api/v2/import/customer?skipExisting=${skipExisting}`;
      } else {
        endpoint = `/api/v2/import/waybill?type=${importType}`;
      }

      setUploadProgress(50);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      setUploadProgress(85);

      const data = await response.json();
      setUploadProgress(100);

      if (!response.ok || !data.success) {
        throw new Error(data.error || '批量导入失败');
      }

      setResult(data.data);
      if (data.data.failedCount > 0) {
        setShowErrorTable(true);
      }

      // 差异化系统反馈提示，杜绝单一模糊提示
      if (data.data.failedCount === 0) {
        toast.success(`批量导入全部成功！已入库 ${data.data.successCount} 票`);
      } else if (data.data.successCount > 0) {
        toast.warning(
          `批量导入部分成功：成功 ${data.data.successCount} 票，异常跳过 ${data.data.failedCount} 票（请查看下方明细）`,
          {
            duration: 6000,
          }
        );
      } else {
        toast.error(`批量导入全部失败：共 ${data.data.failedCount} 票全部异常跳过，请查看失败原因`, {
          duration: 6000,
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || '网络请求失败，请稍后重试');
    } finally {
      setIsUploading(false);
    }
  };

  // 复制所有错误明细
  const handleCopyErrors = () => {
    if (!result?.errors || result.errors.length === 0) return;
    const text = result.errors
      .map((err) => `第 ${err.row} 行 | 唛头: ${err.userMark || '-'} | 原因: ${err.reason}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    toast.success('已复制异常明细到剪贴板');
  };

  // 用户点击完成并关闭
  const handleFinishAndClose = () => {
    if (onSuccess && result && result.successCount > 0) {
      onSuccess();
    }
    onClose();
  };

  // 重置状态
  const handleReset = () => {
    setFile(null);
    setResult(null);
    setErrorMessage('');
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* 头部 */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-slate-800">{config.title}</h3>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${config.badgeColor}`}>
                  {importType}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{config.desc}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Step 1: 模板下载卡片 */}
          <div className="bg-gradient-to-r from-blue-50/60 to-indigo-50/60 border border-blue-100/80 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600/10 text-blue-600 rounded-lg">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800">下载官方标准 Excel 模板</h4>
                <p className="text-xs text-slate-500 mt-0.5">预置规范字段表头、批注提示与示例数据</p>
              </div>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-blue-600 text-xs font-semibold rounded-lg border border-blue-200 shadow-sm transition-all hover:shadow"
            >
              <Download className="w-3.5 h-3.5" />
              <span>下载模板</span>
            </button>
          </div>

          {/* 客户导入专享选项：跳过/覆盖 */}
          {importType === 'CUSTOMER' && !result && (
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-medium text-slate-700">若遇到已存在的客户唛头：</span>
              </div>
              <div className="flex items-center space-x-4 text-xs">
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="skipStrategy"
                    checked={skipExisting}
                    onChange={() => setSkipExisting(true)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-600">自动跳过 (保留原档案)</span>
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="skipStrategy"
                    checked={!skipExisting}
                    onChange={() => setSkipExisting(false)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-600">覆盖更新 (刷新最新信息)</span>
                </label>
              </div>
            </div>
          )}

          {/* Step 2: 文件拖拽上传区域 */}
          {!result ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
                  file
                    ? 'border-blue-500 bg-blue-50/20'
                    : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/60'
                }`}
              >
                {file ? (
                  <div className="flex flex-col items-center">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl mb-3 shadow-inner">
                      <FileSpreadsheet className="w-8 h-8" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{file.name}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {(file.size / 1024).toFixed(1)} KB · 点击可重新选择文件
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="p-3 bg-slate-100 text-slate-500 rounded-2xl mb-3">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                      拖拽 Excel 文件至此处，或 <span className="text-blue-600 underline">点击上传</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">支持 .xlsx / .xls 格式文件（支持内嵌图片自动提取）</p>
                  </div>
                )}
              </div>

              {/* 上传进度条 */}
              {isUploading && (
                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-500 font-medium">
                    <span>正在解析表格并导入数据...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Step 3: 导入结果反馈卡片 */
            <div className="space-y-4 animate-fade-in">
              {/* 异常警示卡片 */}
              {result.failedCount > 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start justify-between">
                  <div className="flex items-start space-x-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h5 className="text-xs font-bold text-amber-900">
                        {result.successCount > 0 ? '部分数据导入成功，部分数据已异常跳过' : '全部数据导入失败'}
                      </h5>
                      <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                        系统已将不符合校验规范的行摘出，请核对下方异常行号与具体跳过原因，修改 Excel 后可再次补录。
                      </p>
                    </div>
                  </div>
                  {result.errors && result.errors.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCopyErrors}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-medium shadow-xs transition-colors flex-shrink-0 ml-3"
                    >
                      <Copy className="w-3 h-3" />
                      <span>复制原因</span>
                    </button>
                  )}
                </div>
              )}

              {/* 汇总统计徽标卡片 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <div className="text-xs text-slate-500 font-medium">处理总行/单数</div>
                  <div className="text-xl font-bold text-slate-800 mt-1">{result.total}</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <div className="text-xs text-emerald-600 font-medium flex items-center justify-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>成功入库</span>
                  </div>
                  <div className="text-xl font-bold text-emerald-700 mt-1">{result.successCount}</div>
                </div>
                <div className={`p-3 rounded-xl border text-center ${
                  result.failedCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className={`text-xs font-medium flex items-center justify-center space-x-1 ${
                    result.failedCount > 0 ? 'text-amber-600' : 'text-slate-500'
                  }`}>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>异常跳过</span>
                  </div>
                  <div className={`text-xl font-bold mt-1 ${
                    result.failedCount > 0 ? 'text-amber-700' : 'text-slate-800'
                  }`}>
                    {result.failedCount}
                  </div>
                </div>
              </div>

              {/* 异常行折叠明细表格 */}
              {result.errors && result.errors.length > 0 && (
                <div className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50/30">
                  <div className="px-4 py-2.5 bg-amber-100/60 flex items-center justify-between select-none">
                    <div
                      onClick={() => setShowErrorTable(!showErrorTable)}
                      className="flex items-center space-x-2 text-xs font-semibold text-amber-900 cursor-pointer"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>异常跳过明细 ({result.errors.length} 条)</span>
                      <span className="text-xs text-amber-700 font-normal ml-2">{showErrorTable ? '(点击收起)' : '(点击展开)'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyErrors}
                      className="text-xs text-amber-800 hover:text-amber-950 font-medium inline-flex items-center space-x-1 bg-white/80 hover:bg-white px-2 py-0.5 rounded border border-amber-300 transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      <span>复制清单</span>
                    </button>
                  </div>

                  {showErrorTable && (
                    <div className="max-h-48 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-amber-200 bg-amber-50/80 text-amber-800">
                            <th className="py-2 px-3 font-semibold w-16">Excel行号</th>
                            <th className="py-2 px-3 font-semibold w-28">客户唛头</th>
                            <th className="py-2 px-3 font-semibold">跳过原因</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100 bg-white">
                          {result.errors.map((err, idx) => (
                            <tr key={idx} className="hover:bg-amber-50/40">
                              <td className="py-2 px-3 font-mono font-medium text-slate-700">第 {err.row} 行</td>
                              <td className="py-2 px-3 text-slate-800 font-medium">{err.userMark || '-'}</td>
                              <td className="py-2 px-3 text-amber-700">{err.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 顶层错误提示 */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-rose-700 text-xs">
              <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            {result && (
              <button
                onClick={handleReset}
                className="inline-flex items-center space-x-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>导入其他文件</span>
              </button>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {result ? (
              <button
                onClick={handleFinishAndClose}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 rounded-xl transition-all"
              >
                {result.successCount > 0 ? '完成并刷新数据' : '关闭'}
              </button>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
                >
                  取消
                </button>

                <button
                  disabled={!file || isUploading}
                  onClick={handleExecuteImport}
                  className={`inline-flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-semibold shadow-md transition-all ${
                    !file || isUploading
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 hover:shadow-blue-500/35'
                  }`}
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>正在导入...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>开始批量导入</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
