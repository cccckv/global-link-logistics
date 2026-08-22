import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { waybillV2Api, type Waybill, type WaybillStatus } from '../../lib/v2-api';
import {
  Package,
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Tag,
  User,
  Phone,
  Building,
  DollarSign,
  Image as ImageIcon,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';

const STATUS_CONFIG: Record<
  WaybillStatus,
  { label: string; bg: string; text: string; border: string; stepIndex: number }
> = {
  DRAFT: { label: '待入库', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', stepIndex: 0 },
  INBOUND: { label: '已入库', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', stepIndex: 1 },
  LOADED: { label: '已装柜/起飞', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', stepIndex: 2 },
  IN_TRANSIT: { label: '在途运输中', bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', stepIndex: 3 },
  CUSTOMS: { label: '目的港清关中', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', stepIndex: 4 },
  DISPATCHING: { label: '海外派送中', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', stepIndex: 5 },
  DELIVERED: { label: '已妥投签收', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', stepIndex: 6 },
  CANCELLED: { label: '已取消', bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', stepIndex: -1 },
};

const TIMELINE_STEPS = [
  { key: 'INBOUND', label: '仓库入库' },
  { key: 'LOADED', label: '装柜/起飞' },
  { key: 'IN_TRANSIT', label: '开船/在途' },
  { key: 'CUSTOMS', label: '目的港清关' },
  { key: 'DELIVERED', label: '海外签收' },
];

export default function CustomerWaybillDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [waybill, setWaybill] = useState<Waybill | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadDetail(id);
    }
  }, [id]);

  const loadDetail = async (wbId: string) => {
    setLoading(true);
    try {
      const res = await waybillV2Api.getById(wbId);
      if (res.data.success) {
        setWaybill(res.data.data);
      }
    } catch (err: any) {
      console.error('加载运单详情失败:', err);
      toast.error('无法加载该运单详情或您无权查看此运单');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('已复制到剪贴板');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Receivable fees calculation (customer fees)
  const receivableFees = useMemo(() => {
    return Array.isArray(waybill?.fees)
      ? waybill.fees.filter((f) => f.feeDirection === 'RECEIVABLE')
      : [];
  }, [waybill?.fees]);

  const totalReceivableCalculated = useMemo(() => {
    return receivableFees.reduce(
      (sum, f) => sum + (Number(f.amountInCny) || Number(f.amount) || 0),
      0
    );
  }, [receivableFees]);

  // 构建客户应付费用全景清单（基础运费 + 附加杂费）
  const billingItems = useMemo(() => {
    if (!waybill) return [];
    const items: Array<{ id: string; name: string; amount: number; currency: string; isBase?: boolean }> = [];

    // 1. 基础干线运费行
    const surchargesTotal = receivableFees.reduce(
      (sum, f) => sum + (Number(f.amountInCny) || Number(f.amount) || 0),
      0
    );

    let baseAmount = 0;
    if (waybill.isFixedPrice && waybill.fixedPriceAmount) {
      baseAmount = Number(waybill.fixedPriceAmount);
    } else if (waybill.baseReceivable !== undefined && waybill.baseReceivable !== null && Number(waybill.baseReceivable) > 0) {
      baseAmount = Number(waybill.baseReceivable);
    } else if (waybill.receivableAmount) {
      baseAmount = Math.max(0, Number(waybill.receivableAmount) - surchargesTotal);
    }

    if (baseAmount > 0) {
      let baseName = '基础干线运费';
      if (waybill.orderType === 'SEA_FCL') {
        baseName = waybill.isFixedPrice ? '海运整柜包干运费' : '海运整柜基本运费';
      } else if (waybill.orderType === 'SEA_LCL') {
        baseName = waybill.isFixedPrice
          ? '海运拼箱包干运费'
          : `海运拼箱运费 (${Number(waybill.totalReceivableCbm || 0).toFixed(3)} CBM)`;
      } else if (waybill.orderType === 'AIR') {
        baseName = `空运专线运费 (${Number(waybill.totalWeightKg || 0).toFixed(2)} kg)`;
      } else if (waybill.orderType === 'LAND') {
        baseName = '陆运专线运费';
      }

      items.push({
        id: 'base-freight',
        name: baseName,
        amount: baseAmount,
        currency: 'CNY',
        isBase: true,
      });
    }

    // 2. 附加杂费明细行
    receivableFees.forEach((fee, idx) => {
      items.push({
        id: fee.id || `fee-${idx}`,
        name: fee.feeName,
        amount: Number(fee.amount),
        currency: fee.currency || 'CNY',
      });
    });

    return items;
  }, [waybill, receivableFees]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mb-3"></div>
          <p className="text-sm text-gray-500">加载运单物流详情中...</p>
        </div>
      </div>
    );
  }

  if (!waybill) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-900 mb-1">运单未找到或无权访问</h2>
          <p className="text-xs text-gray-500 mb-6">
            该运单不存在，或者不属于您当前绑定的客户唛头范围。
          </p>
          <button
            onClick={() => navigate('/customer/waybills')}
            className="px-4 py-2 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary-dark transition"
          >
            返回我的运单
          </button>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[waybill.status] || STATUS_CONFIG.DRAFT;
  const currentStep = statusCfg.stepIndex;

  return (
    <div className="min-h-screen bg-gray-50/50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Navigation & Status Bar */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/customer/waybills')}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition"
                title="返回列表"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold font-mono text-gray-900">
                    {waybill.waybillNo}
                  </h1>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                  >
                    {statusCfg.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                  <span>创建时间：{new Date(waybill.createdAt).toLocaleString('zh-CN')}</span>
                  {waybill.expressNo && (
                    <>
                      <span>·</span>
                      <span className="font-mono">专线单号：{waybill.expressNo}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <Tag className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                客户唛头：{waybill.userMark}
              </span>
            </div>
          </div>

          {/* Timeline Process */}
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-4">
              物流节点进度
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {TIMELINE_STEPS.map((step, idx) => {
                const isPassed = currentStep >= idx + 1;

                let dateText: string | null = null;
                if (step.key === 'INBOUND' && waybill.inboundDate) dateText = new Date(waybill.inboundDate).toLocaleDateString('zh-CN');
                if (step.key === 'LOADED' && waybill.loadingDate) dateText = new Date(waybill.loadingDate).toLocaleDateString('zh-CN');
                if (step.key === 'IN_TRANSIT' && waybill.sailingDate) dateText = new Date(waybill.sailingDate).toLocaleDateString('zh-CN');
                if (step.key === 'CUSTOMS' && waybill.clearanceDate) dateText = new Date(waybill.clearanceDate).toLocaleDateString('zh-CN');
                if (step.key === 'DELIVERED' && waybill.signedDate) dateText = new Date(waybill.signedDate).toLocaleDateString('zh-CN');

                return (
                  <div
                    key={step.key}
                    className={`p-3 rounded-xl border text-left transition ${
                      isPassed
                        ? 'bg-blue-50/50 border-blue-200'
                        : 'bg-gray-50/50 border-gray-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      {isPassed ? (
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Clock className="w-4 h-4 text-gray-400" />
                      )}
                      <span className={isPassed ? 'text-blue-900' : 'text-gray-600'}>
                        {step.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 font-mono mt-1">
                      {dateText ? dateText : isPassed ? '已完成' : '待处理'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 2-Column Info: Cargo Details & Address Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cargo Package List (2-Columns) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  <h2 className="text-sm font-bold text-gray-900">包裹实测明细与体积</h2>
                </div>
                <div className="text-xs font-mono text-gray-600">
                  共 <span className="font-bold text-gray-900">{waybill.totalPieces || 0}</span> 件 ·{' '}
                  <span className="font-bold text-blue-600 font-mono">
                    {Number(waybill.totalReceivableCbm || 0).toFixed(3)} CBM
                  </span>
                  {waybill.totalWeightKg ? ` · ${Number(waybill.totalWeightKg).toFixed(2)} kg` : ''}
                </div>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2.5">#</th>
                      <th className="px-4 py-2.5">货物名称</th>
                      <th className="px-4 py-2.5">快递单号</th>
                      <th className="px-4 py-2.5 text-center">件数</th>
                      <th className="px-4 py-2.5 text-right">实测尺寸 (cm)</th>
                      <th className="px-4 py-2.5 text-right">实测体积 (CBM)</th>
                      <th className="px-4 py-2.5 text-right">重量 (kg)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-mono">
                    {waybill.items && waybill.items.length > 0 ? (
                      waybill.items.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-gray-50/60">
                          <td className="px-4 py-3 text-gray-400 font-normal">{idx + 1}</td>
                          <td className="px-4 py-3 font-sans font-medium text-gray-900">
                            {item.productName}
                          </td>
                          <td className="px-4 py-3 text-gray-500">{item.trackingNumber || '-'}</td>
                          <td className="px-4 py-3 text-center text-gray-900 font-bold">
                            {item.quantity || 1}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {item.length && item.width && item.height
                              ? `${item.length} × ${item.width} × ${item.height}`
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-blue-600">
                            {item.receivableVolume ? Number(item.receivableVolume).toFixed(4) : '-'}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {item.totalWeight
                              ? Number(item.totalWeight).toFixed(2)
                              : item.unitWeight
                              ? Number(item.unitWeight).toFixed(2)
                              : '-'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-gray-400">
                          暂无包裹行记录
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Attachments & Proofs */}
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-primary" />
                  <h2 className="text-sm font-bold text-gray-900">货物单证与凭证照片</h2>
                </div>
                <span className="text-xs text-gray-400">
                  {waybill.attachments ? waybill.attachments.length : 0} 份附件
                </span>
              </div>

              {waybill.attachments && waybill.attachments.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {waybill.attachments.map((att, idx) => (
                    <div
                      key={att.id || idx}
                      onClick={() => setPreviewImageUrl(att.fileUrl)}
                      className="group relative border border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition bg-gray-50 aspect-video flex flex-col items-center justify-center"
                    >
                      <img
                        src={att.fileUrl}
                        alt={att.fileName || '凭据图片'}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        onError={(e: any) => {
                          e.target.style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs gap-1 font-medium">
                        <ExternalLink className="w-3.5 h-3.5" />
                        查看大图
                      </div>
                      <div className="absolute bottom-0 inset-x-0 bg-white/90 backdrop-blur-xs px-2 py-1 text-[10px] text-gray-700 truncate font-medium border-t border-gray-100">
                        {att.fileName || `凭证 #${idx + 1}`}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-400 text-xs bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  暂未上传任何打卡图、水单或签收单凭据
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Address Cards & Billing Summary */}
          <div className="space-y-6">
            {/* Customer Payable Billing Card (ALL CLIENT PAYABLES: BASE FREIGHT + SURCHARGES) */}
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-sm font-bold text-gray-900">客户应付费用清单</h2>
                </div>
                <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  应付账单
                </span>
              </div>

              {billingItems.length > 0 ? (
                <div className="space-y-3 text-xs">
                  <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl p-2 bg-gray-50/50">
                    {billingItems.map((item) => (
                      <div
                        key={item.id}
                        className="py-2.5 px-1 flex items-center justify-between font-mono first:pt-1 last:pb-1"
                      >
                        <div className="font-sans text-gray-800 font-medium flex items-center gap-1.5">
                          {item.isBase && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          )}
                          <span>{item.name}</span>
                        </div>
                        <span className="font-bold text-gray-900">
                          {item.currency} {Number(item.amount).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-800">客户应付总计：</span>
                    <span className="text-lg font-extrabold font-mono text-emerald-600">
                      ¥ {Number(waybill.receivableAmount || totalReceivableCalculated).toFixed(2)} CNY
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  暂未录入费用数据
                </div>
              )}
            </div>

            {/* Consignee Address Card */}
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    海外收件人
                  </h3>
                </div>
                {waybill.overseasAddress && (
                  <button
                    onClick={() =>
                      handleCopy(
                        `${waybill.overseasName || ''} ${waybill.overseasPhone || ''} ${
                          waybill.overseasAddress || ''
                        }`,
                        'overseas'
                      )
                    }
                    className="p-1 text-gray-400 hover:text-primary transition rounded"
                    title="复制完整地址"
                  >
                    {copiedKey === 'overseas' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>

              <div className="p-3 bg-gray-50/70 rounded-xl space-y-1.5 text-xs">
                <div className="font-semibold text-gray-900 flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  <span>{waybill.overseasName || '(未填写姓名)'}</span>
                </div>
                <div className="text-gray-600 font-mono flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  <span>{waybill.overseasPhone || '-'}</span>
                </div>
                <div className="text-gray-700 pt-1 border-t border-gray-200/60 leading-relaxed">
                  {waybill.overseasAddress || '暂无详细收货地址'}
                  {waybill.overseasRegion ? ` (${waybill.overseasRegion})` : ''}
                </div>
              </div>
            </div>

            {/* Domestic Shipper Address Card */}
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-gray-500" />
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  国内寄件人 / 送仓网点
                </h3>
              </div>

              <div className="p-3 bg-gray-50/70 rounded-xl space-y-1.5 text-xs text-gray-600">
                <div className="font-semibold text-gray-900">
                  {waybill.recipientName || '自送仓库 / 快递发货'}
                </div>
                {waybill.recipientPhone && (
                  <div className="font-mono">{waybill.recipientPhone}</div>
                )}
                {waybill.originWarehouse && (
                  <div className="text-blue-700 font-medium pt-1">
                    起运集货仓：{waybill.originWarehouse}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Modal for Image Preview */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl">
            <img
              src={previewImageUrl}
              alt="凭据大图"
              className="w-full h-full object-contain max-h-[85vh] rounded-xl"
            />
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute top-3 right-3 px-3 py-1.5 bg-black/60 text-white rounded-lg text-xs font-medium hover:bg-black transition"
            >
              关闭预览
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
