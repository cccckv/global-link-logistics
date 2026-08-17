import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Truck,
  Ship,
  FileText,
  DollarSign,
  Paperclip,
  Upload,
  ExternalLink,
  Trash2,
  Edit3,
  Calendar,
  AlertCircle,
  Plus,
  Layers,
  Container as ContainerIcon,
  ChevronRight,
  ShieldCheck,
  RotateCcw,
  Save,
  UserCheck,
  Package,
  Copy,
} from 'lucide-react';
import {
  waybillV2Api,
  containerV2Api,
  financeV2Api,
  channelV2Api,
  type Waybill,
  type ContainerMaster,
  type WaybillStatus,
  type AttachmentType,
  type CurrencyType,
  type ChannelMapping,
} from '../../lib/v2-api';
import {
  DESTINATION_COUNTRIES,
  getPortsByCountry,
  getDefaultPortByCountry,
  ORIGIN_WAREHOUSES,
} from '../../lib/logistics-dictionary';
import { LocalFileUpload } from '../../components/v2/LocalFileUpload';

interface StageMeta {
  key: WaybillStatus;
  stageNum: number;
  label: string;
  desc: string;
  actionText?: string;
}

const STAGES: StageMeta[] = [
  {
    key: 'DRAFT',
    stageNum: 1,
    label: '1. 客户预报',
    desc: '客户提交品名、件数、单号',
    actionText: '📦 包裹到仓 ➔ 阶段2实测核量',
  },
  {
    key: 'INBOUND',
    stageNum: 2,
    label: '2. 到仓实测',
    desc: '实测长宽高、单重、算方计费',
    actionText: '🚢 安排装柜 ➔ 阶段3装箱配载',
  },
  {
    key: 'LOADED',
    stageNum: 3,
    label: '3. 装柜配载',
    desc: '绑定集装箱柜号与装箱日期',
    actionText: '🌊 船舶启运 ➔ 阶段4干线在途',
  },
  {
    key: 'IN_TRANSIT',
    stageNum: 4,
    label: '4. 干线在途',
    desc: '开船航运中，记录船期与订舱成本',
    actionText: '🛃 抵港清关 ➔ 阶段5海关放行',
  },
  {
    key: 'DISPATCHING', // Note: DISPATCHING/CUSTOMS
    stageNum: 5,
    label: '5. 清关放行',
    desc: '目的港清关，上传税单与THC',
    actionText: '🚚 海外派送 ➔ 阶段6送达签收',
  },
  {
    key: 'DELIVERED',
    stageNum: 6,
    label: '6. 签收完结',
    desc: '回传签收单照片，锁定纯毛利',
  },
];

export default function WaybillDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [waybill, setWaybill] = useState<Waybill | null>(null);
  const [loading, setLoading] = useState(true);
  const [containers, setContainers] = useState<ContainerMaster[]>([]);

  // Stage Modal States
  const [activeStageModal, setActiveStageModal] = useState<number | null>(null);

  // Stage 1 (预报修改) State
  const [userMark, setUserMark] = useState('');
  const [originWarehouse, setOriginWarehouse] = useState('');
  const [destinationCountry, setDestinationCountry] = useState('');
  const [destinationPort, setDestinationPort] = useState('');
  const [customsType, setCustomsType] = useState('');
  const [forwarderChannel, setForwarderChannel] = useState('');
  const [channelMappings, setChannelMappings] = useState<ChannelMapping[]>([]);
  const [note, setNote] = useState('');

  // Stage 2 (实测尺寸) State
  const [inboundDate, setInboundDate] = useState('');
  const [expressNo, setExpressNo] = useState('');
  const [editableItems, setEditableItems] = useState<any[]>([]);

  // Stage 3 (装柜配载) State
  const [selectedContainerId, setSelectedContainerId] = useState('');
  const [newContainerNo, setNewContainerNo] = useState('');
  const [newBlNumber, setNewBlNumber] = useState('');
  const [loadingDate, setLoadingDate] = useState('');

  // Stage 4 (干线启运) State
  const [sailingDate, setSailingDate] = useState('');
  const [etaDate, setEtaDate] = useState('');
  const [vesselVoyage, setVesselVoyage] = useState('');
  const [blNumber, setBlNumber] = useState('');

  // Stage 5 (清关放行) State
  const [clearanceDate, setClearanceDate] = useState('');
  const [inspectStatus, setInspectStatus] = useState('');
  const [customsSlipUrl, setCustomsSlipUrl] = useState('');

  // Stage 6 (客户签收) State
  const [signedDate, setSignedDate] = useState('');
  const [signImageUrl, setSignImageUrl] = useState('');

  // Dual-track Items State
  const [stage1Items, setStage1Items] = useState<WaybillItem[]>([]);

  // General Fee Modal
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [feeName, setFeeName] = useState('');
  const [feeDirection, setFeeDirection] = useState<'RECEIVABLE' | 'PAYABLE'>('RECEIVABLE');
  const [feeAmount, setFeeAmount] = useState<number>(0);
  const [feeCurrency, setFeeCurrency] = useState<CurrencyType>('CNY');
  const [feeNote, setFeeNote] = useState('');

  // General Attachment Modal
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [attachmentType, setAttachmentType] = useState<AttachmentType>('WAREHOUSE_IMAGE');
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [wbRes, contRes, chanRes] = await Promise.all([
        waybillV2Api.getById(id),
        containerV2Api.list({ limit: 100 }),
        channelV2Api.list(),
      ]);

      if (chanRes.data.success && chanRes.data.data) {
        setChannelMappings(chanRes.data.data);
      }

      if (wbRes.data.success) {
        const wb = wbRes.data.data;
        setWaybill(wb);
        setUserMark(wb.userMark || '');
        setOriginWarehouse(wb.originWarehouse || '');
        setDestinationCountry(wb.destinationCountry || '');
        setDestinationPort(wb.destinationPort || '');
        setCustomsType(wb.customsType || '');
        setForwarderChannel(wb.forwarderChannel || '');
        setNote(wb.note || '');
        setExpressNo(wb.expressNo || '');
        const rawItems = wb.items || [];
        const normalizedItems = rawItems.map((it: any) => ({
          ...it,
          estimatedQuantity: it.estimatedQuantity !== null && it.estimatedQuantity !== undefined ? it.estimatedQuantity : it.quantity,
          estimatedLength: it.estimatedLength !== null && it.estimatedLength !== undefined ? it.estimatedLength : it.length,
          estimatedWidth: it.estimatedWidth !== null && it.estimatedWidth !== undefined ? it.estimatedWidth : it.width,
          estimatedHeight: it.estimatedHeight !== null && it.estimatedHeight !== undefined ? it.estimatedHeight : it.height,
          estimatedWeight: it.estimatedWeight !== null && it.estimatedWeight !== undefined ? it.estimatedWeight : it.unitWeight,
          estimatedVolume: it.estimatedVolume !== null && it.estimatedVolume !== undefined ? it.estimatedVolume : it.payableVolume,
        }));
        setEditableItems(JSON.parse(JSON.stringify(normalizedItems)));
        setStage1Items(JSON.parse(JSON.stringify(normalizedItems)));
        setSelectedContainerId(wb.containerId || '');
        setVesselVoyage(wb.containerMaster?.vesselVoyage || wb.voyageNumber || '');
        setInboundDate(wb.inboundDate ? new Date(wb.inboundDate).toISOString().slice(0, 10) : '');
        setSignedDate(wb.signedDate ? new Date(wb.signedDate).toISOString().slice(0, 10) : '');
        setClearanceDate(wb.clearanceDate ? new Date(wb.clearanceDate).toISOString().slice(0, 10) : '');
        setInspectStatus(wb.inspectStatus || '正常放行');
        setLoadingDate(
          wb.loadingDate
            ? new Date(wb.loadingDate).toISOString().slice(0, 10)
            : wb.containerMaster?.loadingDate
              ? new Date(wb.containerMaster.loadingDate).toISOString().slice(0, 10)
              : ''
        );
        setSailingDate(
          wb.containerMaster?.sailingDate
            ? new Date(wb.containerMaster.sailingDate).toISOString().slice(0, 10)
            : ''
        );
        setEtaDate(
          wb.containerMaster?.eta
            ? new Date(wb.containerMaster.eta).toISOString().slice(0, 10)
            : ''
        );
        setBlNumber(wb.containerMaster?.blNumber || '');
      }
      if (contRes.data.success) {
        setContainers(contRes.data.data || []);
      }
    } catch (err: any) {
      toast.error('加载运单详情失败');
    } finally {
      setLoading(false);
    }
  };

  // Helper operations for Stage 1 pre-declaration cargo items
  const addStage1Item = () => {
    setStage1Items([
      ...stage1Items,
      {
        id: `temp_${Date.now()}`,
        productName: '',
        trackingNumber: '',
        quantity: 1,
        estimatedQuantity: 1,
        estimatedLength: undefined,
        estimatedWidth: undefined,
        estimatedHeight: undefined,
        estimatedWeight: undefined,
        receivableCurrency: 'CNY',
        receivableUnitPrice: undefined,
        payableCurrency: 'CNY',
        payableUnitPrice: undefined,
      },
    ]);
  };

  const removeStage1Item = (idx: number) => {
    if (stage1Items.length <= 1) return;
    setStage1Items(stage1Items.filter((_, i) => i !== idx));
  };

  const updateStage1Item = (idx: number, field: keyof WaybillItem, val: any) => {
    setStage1Items((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [field]: val } : it))
    );
  };

  // Helper for Stage 2: One-click copy estimated to actual
  const handleCopyEstimatedToActual = () => {
    setEditableItems((prev) =>
      prev.map((it) => {
        const estQty = it.estimatedQuantity !== undefined && it.estimatedQuantity !== null ? it.estimatedQuantity : it.quantity;
        const estL = it.estimatedLength !== undefined && it.estimatedLength !== null ? it.estimatedLength : it.length;
        const estW = it.estimatedWidth !== undefined && it.estimatedWidth !== null ? it.estimatedWidth : it.width;
        const estH = it.estimatedHeight !== undefined && it.estimatedHeight !== null ? it.estimatedHeight : it.height;
        const estWt = it.estimatedWeight !== undefined && it.estimatedWeight !== null ? it.estimatedWeight : it.unitWeight;
        return {
          ...it,
          quantity: estQty,
          length: estL,
          width: estW,
          height: estH,
          unitWeight: estWt,
        };
      })
    );
    toast.success('已一键带入客户预报尺寸、重量与件数！');
  };

  const handleCustomsTypeChange = (newType: string) => {
    setCustomsType(newType);
    const valid = channelMappings
      .filter((m) => m.customsType === newType)
      .map((m) => m.forwarderChannel);
    const allowed = valid.length > 0
      ? valid
      : newType === '退税报关'
        ? ['中外运', '万海自营专线']
        : newType === '敏感特货'
          ? ['菲通货运', '万海特货通道']
          : ['万海自营专线', '中外运', '天帆东南亚', '同行外发分拨'];

    if (!allowed.includes(forwarderChannel)) {
      setForwarderChannel(allowed[0] || '万海自营专线');
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center text-slate-400">
        运单数据加载中...
      </div>
    );
  }

  if (!waybill) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center space-y-4">
        <p className="text-slate-500">未找到该运单记录</p>
        <button
          onClick={() => navigate('/v2/waybills')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs"
        >
          返回运单看板
        </button>
      </div>
    );
  }

  // Calculate current stage index
  // Map CUSTOMS to index 4 (same as DISPATCHING)
  let currentStageIdx = STAGES.findIndex((s) => s.key === waybill.status);
  if (currentStageIdx === -1) {
    if (waybill.status === 'CUSTOMS') currentStageIdx = 4;
    else currentStageIdx = 0;
  }
  const currentStage = STAGES[currentStageIdx] || STAGES[0];

  // Rollback Stage Handler
  const handleRollback = async (targetStageIdx: number) => {
    const targetStage = STAGES[targetStageIdx];
    if (!targetStage) return;

    if (!confirm(`确认将运单状态回退至【${targetStage.label}】？\n已录入的尺寸、货柜或费用信息将予以保留。`)) {
      return;
    }

    try {
      await waybillV2Api.update(waybill.id, {
        status: targetStage.key,
      });
      toast.success(`运单已成功回退至【${targetStage.label}】！`);
      setActiveStageModal(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || '状态回退失败');
    }
  };

  // Stage 1 Save (修改预报信息与货物快照)
  const handleStage1Save = async () => {
    try {
      const isInitialStage = waybill.status === 'PRE_DECLARED' || waybill.status === 'DRAFT';
      await waybillV2Api.update(waybill.id, {
        userMark: userMark.trim(),
        originWarehouse,
        destinationCountry,
        destinationPort: destinationPort.trim() || undefined,
        customsType,
        forwarderChannel: forwarderChannel.trim() || undefined,
        note: note.trim() || undefined,
        items: stage1Items.map((it, idx) => {
          const orig = waybill.items?.find((i) => i.id === it.id) || (waybill.items ? waybill.items[idx] : undefined);
          const estQty = it.estimatedQuantity !== undefined && it.estimatedQuantity !== null && String(it.estimatedQuantity).trim() !== ''
            ? Number(it.estimatedQuantity)
            : (orig?.estimatedQuantity !== undefined && orig?.estimatedQuantity !== null ? Number(orig.estimatedQuantity) : (orig?.quantity ? Number(orig.quantity) : 1));

          const estL = it.estimatedLength !== undefined && it.estimatedLength !== null && String(it.estimatedLength).trim() !== ''
            ? Number(it.estimatedLength)
            : (orig?.estimatedLength !== undefined && orig?.estimatedLength !== null ? Number(orig.estimatedLength) : (orig?.length ? Number(orig.length) : undefined));

          const estW = it.estimatedWidth !== undefined && it.estimatedWidth !== null && String(it.estimatedWidth).trim() !== ''
            ? Number(it.estimatedWidth)
            : (orig?.estimatedWidth !== undefined && orig?.estimatedWidth !== null ? Number(orig.estimatedWidth) : (orig?.width ? Number(orig.width) : undefined));

          const estH = it.estimatedHeight !== undefined && it.estimatedHeight !== null && String(it.estimatedHeight).trim() !== ''
            ? Number(it.estimatedHeight)
            : (orig?.estimatedHeight !== undefined && orig?.estimatedHeight !== null ? Number(orig.estimatedHeight) : (orig?.height ? Number(orig.height) : undefined));

          const estWt = it.estimatedWeight !== undefined && it.estimatedWeight !== null && String(it.estimatedWeight).trim() !== ''
            ? Number(it.estimatedWeight)
            : (orig?.estimatedWeight !== undefined && orig?.estimatedWeight !== null ? Number(orig.estimatedWeight) : (orig?.unitWeight ? Number(orig.unitWeight) : undefined));

          const estVol = estL && estW && estH
            ? (estL * estW * estH * estQty) / 1_000_000
            : (it.estimatedVolume ? Number(it.estimatedVolume) : undefined);

          return {
            id: it.id?.startsWith('temp_') ? undefined : it.id,
            trackingNumber: it.trackingNumber?.trim() || undefined,
            productName: it.productName.trim() || '通用货物',
            estimatedQuantity: estQty,
            estimatedLength: estL,
            estimatedWidth: estW,
            estimatedHeight: estH,
            estimatedWeight: estWt,
            estimatedVolume: estVol,
            // If in initial stage (not yet warehouse measured), also sync the actual measurements to match new pre-declaration
            quantity: isInitialStage ? estQty : (orig?.quantity ? Number(orig.quantity) : estQty),
            length: isInitialStage ? estL : (orig?.length ? Number(orig.length) : (estL || undefined)),
            width: isInitialStage ? estW : (orig?.width ? Number(orig.width) : (estW || undefined)),
            height: isInitialStage ? estH : (orig?.height ? Number(orig.height) : (estH || undefined)),
            unitWeight: isInitialStage ? estWt : (orig?.unitWeight ? Number(orig.unitWeight) : (estWt || undefined)),
            receivableCurrency: it.receivableCurrency || 'CNY',
            receivableUnitPrice: it.receivableUnitPrice !== undefined && it.receivableUnitPrice !== null && String(it.receivableUnitPrice).trim() !== ''
              ? Number(it.receivableUnitPrice)
              : (orig?.receivableUnitPrice ? Number(orig.receivableUnitPrice) : undefined),
            payableCurrency: it.payableCurrency || 'CNY',
            payableUnitPrice: it.payableUnitPrice !== undefined && it.payableUnitPrice !== null && String(it.payableUnitPrice).trim() !== ''
              ? Number(it.payableUnitPrice)
              : (orig?.payableUnitPrice ? Number(orig.payableUnitPrice) : undefined),
          };
        }),
      });
      toast.success('阶段 1 客户预报信息与货物快照已成功更新！');
      setActiveStageModal(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || '阶段 1 保存失败');
    }
  };

  // Stage 2 Save & Advance: 到仓实测尺寸与入库
  const handleStage2Submit = async (advanceStatus: boolean = true) => {
    try {
      const payload: any = {
        inboundDate,
        expressNo: expressNo.trim() || undefined,
        items: editableItems.map((item, idx) => {
          const orig = waybill.items?.find((i) => i.id === item.id) || (waybill.items ? waybill.items[idx] : undefined);
          return {
            id: item.id?.startsWith('temp_') ? undefined : item.id,
            productName: item.productName,
            trackingNumber: item.trackingNumber,
            quantity: Number(item.quantity) || 1,
            // Preserve estimated snapshot
            estimatedQuantity: orig?.estimatedQuantity !== undefined && orig?.estimatedQuantity !== null ? Number(orig.estimatedQuantity) : undefined,
            estimatedLength: orig?.estimatedLength !== undefined && orig?.estimatedLength !== null ? Number(orig.estimatedLength) : undefined,
            estimatedWidth: orig?.estimatedWidth !== undefined && orig?.estimatedWidth !== null ? Number(orig.estimatedWidth) : undefined,
            estimatedHeight: orig?.estimatedHeight !== undefined && orig?.estimatedHeight !== null ? Number(orig.estimatedHeight) : undefined,
            estimatedWeight: orig?.estimatedWeight !== undefined && orig?.estimatedWeight !== null ? Number(orig.estimatedWeight) : undefined,
            estimatedVolume: orig?.estimatedVolume !== undefined && orig?.estimatedVolume !== null ? Number(orig.estimatedVolume) : undefined,
            length: item.length !== undefined && item.length !== null && String(item.length).trim() !== '' ? Number(item.length) : undefined,
            width: item.width !== undefined && item.width !== null && String(item.width).trim() !== '' ? Number(item.width) : undefined,
            height: item.height !== undefined && item.height !== null && String(item.height).trim() !== '' ? Number(item.height) : undefined,
            unitWeight: item.unitWeight !== undefined && item.unitWeight !== null && String(item.unitWeight).trim() !== '' ? Number(item.unitWeight) : undefined,
            receivableCurrency: item.receivableCurrency || 'CNY',
            receivableUnitPrice: item.receivableUnitPrice !== undefined && item.receivableUnitPrice !== null ? Number(item.receivableUnitPrice) : undefined,
            payableCurrency: item.payableCurrency || 'CNY',
            payableUnitPrice: item.payableUnitPrice !== undefined && item.payableUnitPrice !== null ? Number(item.payableUnitPrice) : undefined,
          };
        }),
      };

      if (advanceStatus) {
        payload.status = 'INBOUND';
      }

      await waybillV2Api.update(waybill.id, payload);
      toast.success(advanceStatus ? '阶段 2 实测核量已保存，运单流转至【已入库】！' : '阶段 2 实测尺寸与件数数据已成功更新！');
      setActiveStageModal(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || '阶段 2 保存失败');
    }
  };

  // Stage 3 Save & Advance: 人工排柜
  const handleStage3Submit = async (advanceStatus: boolean = true) => {
    try {
      let targetContainerId = selectedContainerId;

      if (!targetContainerId && newContainerNo.trim()) {
        const createCRes = await containerV2Api.create({
          containerNo: newContainerNo.trim(),
          blNumber: newBlNumber.trim() || undefined,
          loadingDate,
          status: 'LOADING',
          originPort: waybill.originWarehouse === '广州' ? '南沙港' : '厦门港',
          destinationPort: waybill.destinationPort || '马尼拉南港',
        });
        targetContainerId = createCRes.data.data.id;
      }

      if (!targetContainerId) {
        toast.error('请选择已有集装箱或输入新集装箱柜号');
        return;
      }

      await waybillV2Api.batchAssignContainer({
        waybillIds: [waybill.id],
        containerId: targetContainerId,
        loadingDate,
      });

      if (!advanceStatus && waybill.status !== 'LOADED') {
        // preserve current status
        await waybillV2Api.update(waybill.id, { status: waybill.status });
      }

      toast.success(advanceStatus ? '阶段 3 装柜配载成功，运单流转至【已装柜】！' : '装载集装箱已重新指定！');
      setActiveStageModal(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || '阶段 3 装柜失败');
    }
  };

  // Stage 4 Save & Advance: 干线启运在途
  const handleStage4Submit = async (advanceStatus: boolean = true) => {
    if (!vesselVoyage.trim()) {
      toast.error('请填写船名/航次 (Vessel/Voyage)，该字段为必填项！');
      return;
    }
    if (!sailingDate) {
      toast.error('请选择实际开船日 (ETD)！');
      return;
    }

    try {
      const payload: any = {
        voyageNumber: vesselVoyage.trim(),
      };
      if (advanceStatus) {
        payload.status = 'IN_TRANSIT';
      }

      await waybillV2Api.update(waybill.id, payload);

      if (waybill.containerId) {
        await containerV2Api.update(waybill.containerId, {
          status: advanceStatus ? 'SAILING' : undefined,
          sailingDate,
          eta: etaDate || undefined,
          vesselVoyage: vesselVoyage.trim(),
          blNumber: blNumber.trim() || undefined,
        });
      }

      toast.success(advanceStatus ? '阶段 4 启运节点已记录，运单流转至【在途中】！' : '船期航次信息已更新！');
      setActiveStageModal(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || '阶段 4 更新失败');
    }
  };

  // Stage 5 Save & Advance: 清关放行
  const handleStage5Submit = async (advanceStatus: boolean = true) => {
    try {
      if (advanceStatus) {
        await waybillV2Api.update(waybill.id, {
          status: 'DISPATCHING' as any,
        });
      }

      if (customsSlipUrl.trim()) {
        await financeV2Api.addWaybillAttachment(waybill.id, {
          attachmentType: 'CUSTOMS_SLIP',
          fileUrl: customsSlipUrl.trim(),
          fileName: '海关缴税放行水单',
        });
      }

      if (waybill.containerId) {
        await containerV2Api.update(waybill.containerId, {
          status: advanceStatus ? 'DISPATCHING' : undefined,
          clearanceDate,
          inspectStatus,
        });
      }

      toast.success(advanceStatus ? '阶段 5 清关放行已记录，运单流转至【海外拆派中】！' : '清关水单信息已更新！');
      setActiveStageModal(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || '阶段 5 清关更新失败');
    }
  };

  // Stage 6 Save & Advance: 签收完结
  const handleStage6Submit = async () => {
    if (!signedDate) {
      toast.error('请填写客户签收日期！');
      return;
    }

    try {
      await waybillV2Api.update(waybill.id, {
        status: 'DELIVERED',
        signedDate,
      });

      if (signImageUrl.trim()) {
        await financeV2Api.addWaybillAttachment(waybill.id, {
          attachmentType: 'SIGN_IMAGE',
          fileUrl: signImageUrl.trim(),
          fileName: '客户签字盖章签收回执',
        });
      }

      toast.success('🎉 阶段 6 已签收完结！运单全生命周期流转圆满结束，财务锁定！');
      setActiveStageModal(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || '阶段 6 签收失败');
    }
  };

  // Add Fee
  const handleAddFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feeAmount || feeAmount <= 0) {
      toast.error('请输入有效金额');
      return;
    }
    try {
      await financeV2Api.addWaybillFee(waybill.id, {
        feeName,
        feeDirection,
        amount: Number(feeAmount),
        currency: feeCurrency,
        note: feeNote.trim() || undefined,
      });
      toast.success('附加杂费添加成功');
      setShowFeeModal(false);
      loadData();
    } catch (err: any) {
      toast.error('添加费用失败');
    }
  };

  // Delete Fee
  const handleDeleteFee = async (feeId: string) => {
    if (!confirm('确认删除该项杂费？')) return;
    try {
      await financeV2Api.deleteWaybillFee(feeId);
      toast.success('杂费已删除');
      loadData();
    } catch (err: any) {
      toast.error('删除费用失败');
    }
  };

  // Add Attachment
  const handleAddAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileUrl.trim()) {
      toast.error('请输入或上传附件链接');
      return;
    }
    try {
      await financeV2Api.addWaybillAttachment(waybill.id, {
        attachmentType,
        fileUrl: fileUrl.trim(),
        fileName: fileName.trim() || '单证图片',
      });
      toast.success('附件凭证已追加');
      setShowAttachModal(false);
      setFileUrl('');
      setFileName('');
      loadData();
    } catch (err: any) {
      toast.error('上传附件失败');
    }
  };

  // Delete Attachment
  const handleDeleteAttachment = async (attId: string) => {
    if (!confirm('确认删除该单证附件？')) return;
    try {
      await financeV2Api.deleteWaybillAttachment(attId);
      toast.success('附件已删除');
      loadData();
    } catch (err: any) {
      toast.error('删除附件失败');
    }
  };

  // Handle clicking on a stage card
  const handleStageCardClick = (targetStageNum: number, targetIdx: number) => {
    // Check if target is a future locked stage (beyond current + 1)
    if (targetIdx > currentStageIdx + 1) {
      toast.warning(
        `流程不可跨越！当前处于【${currentStage.label}】，请先按顺序推进至【${STAGES[currentStageIdx + 1]?.label}】。`
      );
      return;
    }
    setActiveStageModal(targetStageNum);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/v2/waybills')}
            className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-sm transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-mono text-slate-900">
                {waybill.waybillNo}
              </h1>
              <span className="px-3 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-bold font-mono">
                {waybill.orderType}
              </span>
              <span className="px-3 py-0.5 bg-slate-900 text-white rounded-full text-xs font-bold font-mono">
                唛头: {waybill.userMark}
              </span>
              {waybill.expressNo && (
                <span className="px-3 py-0.5 bg-indigo-100 text-indigo-900 rounded-full text-xs font-bold font-mono">
                  运递单号: {waybill.expressNo}
                </span>
              )}
              {waybill.customsType && (
                <span className="px-3 py-0.5 bg-amber-100 text-amber-900 rounded-full text-xs font-bold font-mono">
                  通道: {waybill.customsType}
                </span>
              )}
              {waybill.forwarderChannel && (
                <span className="px-3 py-0.5 bg-purple-100 text-purple-900 rounded-full text-xs font-bold font-mono">
                  渠道: {waybill.forwarderChannel}
                </span>
              )}
            </div>
            <p className="text-slate-500 text-xs mt-1">
              路线: {waybill.originWarehouse || '广州'} ➔ {waybill.destinationCountry} ({waybill.destinationPort || '港口待定'})
            </p>
          </div>
        </div>

        {/* Action quick buttons */}
        <div className="flex items-center gap-3">
          {/* Rollback button (active if not stage 1) */}
          {currentStageIdx > 0 && (
            <button
              onClick={() => handleRollback(currentStageIdx - 1)}
              className="px-3.5 py-2.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
              title="回退到前一个阶段状态"
            >
              <RotateCcw className="w-4 h-4" />
              回退至【{STAGES[currentStageIdx - 1]?.label}】
            </button>
          )}

          <button
            onClick={() => setShowAttachModal(true)}
            className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
          >
            <Paperclip className="w-4 h-4 text-blue-600" />
            追加凭证
          </button>
          <button
            onClick={() => setShowFeeModal(true)}
            className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
          >
            <DollarSign className="w-4 h-4 text-emerald-600" />
            录入杂费
          </button>
        </div>
      </div>

      {/* 6-Stage Progressive Stepper Visualizer with Lock Protection & Backward Edit */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              全生命周期 6 阶段严格流转管控
            </h2>
            <span className="text-[11px] text-slate-400">
              (绿色已完成可点击修改历史数据 / 灰色锁定不可越级跳步)
            </span>
          </div>
          <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            当前处于：{currentStage.label}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {STAGES.map((st, idx) => {
            const isCompleted = currentStageIdx > idx || waybill.status === 'DELIVERED';
            const isCurrent = currentStageIdx === idx && waybill.status !== 'DELIVERED';
            const isNext = currentStageIdx + 1 === idx && waybill.status !== 'DELIVERED';
            const isLocked = idx > currentStageIdx + 1;

            return (
              <div
                key={st.key}
                onClick={() => handleStageCardClick(st.stageNum, idx)}
                className={`p-4 rounded-xl border transition-all cursor-pointer relative group ${isCurrent
                    ? 'bg-blue-50/90 border-blue-500 shadow-md ring-2 ring-blue-500/20'
                    : isNext
                      ? 'bg-cyan-50/70 border-cyan-400 text-slate-800 hover:border-cyan-600 hover:shadow-sm'
                      : isCompleted
                        ? 'bg-emerald-50/60 border-emerald-300 text-slate-800 hover:border-emerald-500'
                        : 'bg-slate-50 border-slate-200 text-slate-400 opacity-50 cursor-not-allowed'
                  }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-bold ${isCurrent
                      ? 'text-blue-900'
                      : isNext
                        ? 'text-cyan-900 font-semibold'
                        : isCompleted
                          ? 'text-emerald-900'
                          : 'text-slate-400'
                    }`}>
                    {st.label}
                  </span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : isCurrent ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                  ) : isNext ? (
                    <ChevronRight className="w-4 h-4 text-cyan-600 animate-bounce" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  {st.desc}
                </p>

                {/* Subtext actions */}
                {isCompleted && (
                  <span className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 group-hover:underline">
                    <Edit3 className="w-3 h-3" /> 点击查看/修改
                  </span>
                )}
                {isCurrent && (
                  <span className="mt-2.5 inline-block text-[10px] font-bold text-blue-700 underline">
                    进行中 / 编辑 ➔
                  </span>
                )}
                {isNext && (
                  <span className="mt-2.5 inline-block text-[10px] font-bold text-cyan-700 underline">
                    点击推进本阶段 ➔
                  </span>
                )}
                {isLocked && (
                  <span className="mt-2.5 inline-block text-[10px] text-slate-400">
                    🔒 前置阶段未完成
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Next Step Stage Callout Banner */}
      {currentStageIdx < 5 && (
        <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] text-blue-300 uppercase tracking-wider font-semibold">
                按流程顺序推进下一阶段
              </span>
              <h3 className="text-sm font-bold text-white mt-0.5">
                {STAGES[currentStageIdx + 1]?.label}：{STAGES[currentStageIdx + 1]?.desc}
              </h3>
            </div>
          </div>

          <button
            onClick={() => setActiveStageModal(currentStageIdx + 2)}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/30 flex items-center gap-2 transition-all shrink-0"
          >
            {STAGES[currentStageIdx]?.actionText || '推进至下一阶段'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stage Data Details & Current Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 实测明细 + 绑定货柜 + 凭证池 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cargo items: 双轨对比展示 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-indigo-600" />
                  货物实测明细与双轨数据对比
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  对照 <span className="font-semibold text-slate-700">阶段 1 客户初始预报快照</span> 与 <span className="font-semibold text-indigo-700">阶段 2 仓库实测核量</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveStageModal(1)}
                  className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  修改阶段1预报
                </button>
                <button
                  onClick={() => setActiveStageModal(2)}
                  className="px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {waybill.orderType === 'SEA_FCL' ? '修改阶段2实测' : '修改阶段2实测与单价'}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">送仓快递单号</th>
                    <th className="py-2.5 px-3">品名</th>
                    <th className="py-2.5 px-3 text-center">
                      <div className="flex flex-col items-center">
                        <span>件数对比</span>
                        <span className="text-[10px] text-slate-400 font-normal">预报 ➔ 实测</span>
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-center">
                      <div className="flex flex-col items-center">
                        <span>尺寸 (L×W×H cm)</span>
                        <span className="text-[10px] text-slate-400 font-normal">预报 ➔ 实测</span>
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-right">
                      <div className="flex flex-col items-end">
                        <span>核算体积 (m³)</span>
                        <span className="text-[10px] text-slate-400 font-normal">预报 ➔ 实测 (偏差)</span>
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-right">
                      <div className="flex flex-col items-end">
                        <span>单件重量 (kg)</span>
                        <span className="text-[10px] text-slate-400 font-normal">预报 ➔ 实测</span>
                      </div>
                    </th>
                    {waybill.orderType !== 'SEA_FCL' && (
                      <>
                        <th className="py-2.5 px-3 text-right">应收单价</th>
                        <th className="py-2.5 px-3 text-right">成本单价</th>
                      </>
                    )}
                    <th className="py-2.5 px-3 text-center">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(waybill.items || []).map((item, idx) => {
                    const estQty = item.estimatedQuantity !== null && item.estimatedQuantity !== undefined ? Number(item.estimatedQuantity) : Number(item.quantity);
                    const actQty = Number(item.quantity);
                    const isQtyMismatch = item.estimatedQuantity !== null && item.estimatedQuantity !== undefined && Number(item.estimatedQuantity) !== Number(item.quantity);

                    const estL = item.estimatedLength !== null && item.estimatedLength !== undefined ? item.estimatedLength : item.length;
                    const estW = item.estimatedWidth !== null && item.estimatedWidth !== undefined ? item.estimatedWidth : item.width;
                    const estH = item.estimatedHeight !== null && item.estimatedHeight !== undefined ? item.estimatedHeight : item.height;
                    const hasEstDim = estL && estW && estH;

                    const actL = item.length;
                    const actW = item.width;
                    const actH = item.height;
                    const hasActDim = actL && actW && actH;

                    const estVol = item.estimatedVolume ? Number(item.estimatedVolume) : (hasEstDim ? (Number(estL) * Number(estW) * Number(estH) * Number(estQty)) / 1_000_000 : (item.payableVolume ? Number(item.payableVolume) : null));
                    const actVol = item.payableVolume ? Number(item.payableVolume) : (hasActDim ? (Number(actL) * Number(actW) * Number(actH) * Number(actQty)) / 1_000_000 : null);

                    const volDiff = estVol !== null && actVol !== null ? actVol - estVol : null;
                    const volDiffPct = estVol !== null && actVol !== null && estVol > 0 ? ((actVol - estVol) / estVol) * 100 : null;

                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">{item.trackingNumber || '-'}</td>
                        <td className="py-3 px-3 font-bold text-slate-900">{item.productName}</td>

                        {/* 件数对比 */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1 font-mono">
                            <span className="text-slate-400 text-xs">{estQty}</span>
                            <span className="text-slate-300">➔</span>
                            <span className={`font-bold ${isQtyMismatch ? 'text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200' : 'text-slate-900'}`}>
                              {actQty} 件
                            </span>
                          </div>
                        </td>

                        {/* 尺寸对比 */}
                        <td className="py-3 px-3 text-center font-mono">
                          <div className="text-slate-400 text-[11px]">
                            预: {hasEstDim ? `${estL}×${estW}×${estH}` : '-'}
                          </div>
                          <div className="text-slate-900 font-bold text-xs mt-0.5">
                            实: {hasActDim ? `${actL}×${actW}×${actH}` : <span className="text-slate-400 font-normal italic">待实测</span>}
                          </div>
                        </td>

                        {/* 体积对比 */}
                        <td className="py-3 px-3 text-right font-mono">
                          <div className="text-slate-400 text-[11px]">
                            {estVol ? `${estVol.toFixed(4)} m³` : '-'}
                          </div>
                          <div className="text-indigo-700 font-bold text-xs mt-0.5">
                            {actVol ? `${actVol.toFixed(4)} m³` : <span className="text-slate-400 font-normal italic">待实测</span>}
                          </div>
                          {volDiff !== null && Math.abs(volDiff) > 0.0001 && (
                            <div className={`text-[10px] font-semibold mt-0.5 ${volDiff > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {volDiff > 0 ? `+${volDiff.toFixed(3)}` : volDiff.toFixed(3)} m³ ({volDiffPct !== null && volDiffPct > 0 ? `+${volDiffPct.toFixed(1)}%` : `${volDiffPct?.toFixed(1)}%`})
                            </div>
                          )}
                        </td>

                        {/* 重量对比 */}
                        <td className="py-3 px-3 text-right font-mono">
                          <div className="text-slate-400 text-[11px]">
                            {item.estimatedWeight !== null && item.estimatedWeight !== undefined ? `${Number(item.estimatedWeight).toFixed(1)} kg` : (item.unitWeight ? `${Number(item.unitWeight).toFixed(1)} kg` : '-')}
                          </div>
                          <div className="text-slate-800 font-semibold text-xs mt-0.5">
                            {item.unitWeight ? `${Number(item.unitWeight).toFixed(1)} kg` : <span className="text-slate-400 font-normal italic">-</span>}
                          </div>
                        </td>

                        {waybill.orderType !== 'SEA_FCL' && (
                          <>
                            <td className="py-3 px-3 text-right font-mono font-medium">
                              ¥ {Number(item.receivableUnitPrice || 0).toFixed(2)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-slate-500">
                              ¥ {Number(item.payableUnitPrice || 0).toFixed(2)}
                            </td>
                          </>
                        )}

                        {/* 状态标签 */}
                        <td className="py-3 px-3 text-center">
                          {isQtyMismatch ? (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[10px] font-bold">
                              件数差异 ({estQty}➔{actQty})
                            </span>
                          ) : volDiffPct !== null && volDiffPct > 15 ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold">
                              体积超标 +{volDiffPct.toFixed(0)}%
                            </span>
                          ) : actVol ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-medium">
                              实测正常
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px]">
                              待到仓实测
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Container & Vessel Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Ship className="w-5 h-5 text-blue-600" />
                集装箱与干线航运数据
              </h2>
              <button
                onClick={() => setActiveStageModal(3)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                {waybill.containerMaster ? '修改配载货柜' : '进行装柜配载'}
              </button>
            </div>

            {waybill.containerMaster ? (
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ContainerIcon className="w-6 h-6 text-indigo-700" />
                    <div>
                      <h3 className="text-base font-bold font-mono text-indigo-950">
                        {waybill.containerMaster.containerNo}
                      </h3>
                      <p className="text-xs text-indigo-700">
                        类型: {waybill.containerMaster.containerType || '40HQ'} | 状态: {waybill.containerMaster.status}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      navigate(
                        `/v2/containers?search=${encodeURIComponent(waybill.containerMaster.containerNo)}`
                      )
                    }
                    className="text-xs text-indigo-800 font-semibold hover:underline"
                  >
                    在集装箱看板中查看整柜 ➔
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-indigo-200/60">
                  <div>
                    <span className="text-indigo-500">起运/目的港</span>
                    <p className="font-semibold text-indigo-900">
                      {waybill.containerMaster.originPort || '-'} ➔ {waybill.containerMaster.destinationPort || '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-indigo-500">海运提单号 (B/L)</span>
                    <p className="font-mono font-bold text-indigo-950">
                      {waybill.containerMaster.blNumber || <span className="text-slate-400 font-normal italic">开船后出具</span>}
                    </p>
                  </div>
                  <div>
                    <span className="text-indigo-500">船司/航次</span>
                    <p className="font-semibold text-indigo-900">
                      {waybill.containerMaster.carrier || '-'} / {waybill.containerMaster.vesselVoyage || waybill.voyageNumber || '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-indigo-500">开船日 / ETA</span>
                    <p className="font-semibold text-indigo-900">
                      {waybill.containerMaster.sailingDate ? new Date(waybill.containerMaster.sailingDate).toISOString().slice(0, 10) : '待启运'}
                      {waybill.containerMaster.eta ? ` ➔ ${new Date(waybill.containerMaster.eta).toISOString().slice(0, 10)}` : ''}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center space-y-2">
                <p className="text-xs text-slate-500">
                  该运单暂未分配集装箱柜号。等仓库现场装箱后即可在此绑定货柜。
                </p>
                {currentStageIdx >= 1 && (
                  <button
                    onClick={() => setActiveStageModal(3)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
                  >
                    立即安排装柜 (阶段 3)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Unified Attachment Pool */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Paperclip className="w-5 h-5 text-blue-600" />
                统一单证与凭证池 ({(waybill.attachments || []).length})
              </h2>
              <button
                onClick={() => setShowAttachModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold"
              >
                <Upload className="w-3.5 h-3.5" />
                上传单据
              </button>
            </div>

            {(!waybill.attachments || waybill.attachments.length === 0) ? (
              <p className="text-xs text-slate-400 py-6 text-center border border-dashed border-slate-200 rounded-xl">
                暂无附件凭证。支持随时追加送仓叫车单、海关税单、签收单照片。
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(waybill.attachments || []).map((att) => (
                  <div
                    key={att.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl relative group hover:border-blue-300 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-semibold">
                        {att.attachmentType}
                      </span>
                      <p className="text-xs font-bold text-slate-800 mt-2 truncate" title={att.fileName || ''}>
                        {att.fileName || '单证图片'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-200/60 mt-3">
                      <a
                        href={att.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-medium"
                      >
                        <ExternalLink className="w-3 h-3" />
                        查看预览
                      </a>
                      <button
                        onClick={() => handleDeleteAttachment(att.id)}
                        className="text-slate-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: 财务收支看板 */}
        <div className="space-y-6">
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl space-y-5">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              财务收支与毛利看板
            </h2>

            <div className="space-y-3 font-mono">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>总应收金额 (Receivable):</span>
                <span className="text-base font-bold text-emerald-400">
                  ¥ {Number(waybill.receivableAmount || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>总应付成本 (Payable):</span>
                <span className="text-base font-bold text-rose-400">
                  ¥ {Number(waybill.payableAmount || 0).toFixed(2)}
                </span>
              </div>
              {waybill.orderType === 'SEA_FCL' && currentStageIdx < 3 && Number(waybill.payableAmount || 0) === 0 && (
                <p className="text-[10px] text-slate-400 font-sans italic bg-slate-800/60 p-1.5 rounded">
                  💡 整柜干线硬成本（订舱海运费、国内拖车、THC堆存）将在阶段4开船与阶段5清关时录入
                </p>
              )}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-sm">
                <span className="text-slate-300 font-bold">单票纯利润:</span>
                <span className="text-xl font-bold text-amber-400">
                  ¥ {Number(waybill.profitAmount || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Fee Items List */}
            <div className="pt-4 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold">附加杂费清单</span>
                <button
                  onClick={() => setShowFeeModal(true)}
                  className="text-cyan-400 hover:text-cyan-300 text-[11px]"
                >
                  + 添加杂费
                </button>
              </div>

              {(!waybill.fees || waybill.fees.length === 0) ? (
                <p className="text-[11px] text-slate-500 italic">无额外杂费</p>
              ) : (
                (waybill.fees || []).map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between p-2 bg-slate-800/80 rounded-lg text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-200">{f.feeName}</span>
                      <span className="text-[10px] text-slate-400 ml-1.5">
                        ({f.feeDirection === 'RECEIVABLE' ? '应收' : '应付'})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className={f.feeDirection === 'RECEIVABLE' ? 'text-emerald-400' : 'text-rose-400'}>
                        ¥ {Number(f.amountInCny || f.amount).toFixed(2)}
                      </span>
                      <button
                        onClick={() => f.id && handleDeleteFee(f.id)}
                        className="text-slate-500 hover:text-red-400"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 阶段 1 模态框：客户预报基本信息与原始货物清单快照修改 */}
      {/* ========================================================= */}
      {activeStageModal === 1 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-bold">
                  阶段 1 维护
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-1">
                  修改客户预报与原始货物清单快照
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  用于纠正业务员或客户初次下单时的录入错误，修改后将更新预报快照基准，不会破坏已有的实测数据。
                </p>
              </div>
              <button
                onClick={() => setActiveStageModal(null)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5">
              {/* 基本属性 */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  运单基本属性与航线通道
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      客户唛头 / 编码 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={userMark}
                      onChange={(e) => setUserMark(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-blue-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      始发仓
                    </label>
                    <select
                      value={originWarehouse}
                      onChange={(e) => setOriginWarehouse(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                    >
                      <option value="">-- 请选择起运仓 --</option>
                      {ORIGIN_WAREHOUSES.map((w) => (
                        <option key={w.value} value={w.value}>
                          {w.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      目的国与港口
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        value={destinationCountry}
                        onChange={(e) => {
                          const country = e.target.value;
                          setDestinationCountry(country);
                          setDestinationPort(getDefaultPortByCountry(country));
                        }}
                        className="w-full px-2 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                      >
                        <option value="">- 目的国 -</option>
                        {DESTINATION_COUNTRIES.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={destinationPort}
                        onChange={(e) => setDestinationPort(e.target.value)}
                        className="w-full px-2 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                      >
                        <option value="">- 目的港 -</option>
                        {getPortsByCountry(destinationCountry).map((port) => (
                          <option key={port} value={port}>
                            {port}
                          </option>
                        ))}
                        {destinationPort && !getPortsByCountry(destinationCountry).includes(destinationPort) && (
                          <option value={destinationPort}>
                            {destinationPort}
                          </option>
                        )}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      报关通道 / 货品属性
                    </label>
                    <select
                      value={customsType}
                      onChange={(e) => handleCustomsTypeChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                    >
                      <option value="">-- 请选择报关通道 --</option>
                      <option value="普货双清">普货双清 (常规拼箱/包税)</option>
                      <option value="退税报关">退税报关 (化妆退税/大宗退税)</option>
                      <option value="敏感特货">敏感特货 (带电/带磁/液体)</option>
                      <option value="一般贸易买单">一般贸易买单报关</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      承运渠道 / 服务商
                    </label>
                    <select
                      value={forwarderChannel}
                      onChange={(e) => setForwarderChannel(e.target.value)}
                      className="w-full px-3 py-2 bg-blue-50/40 border border-blue-300 rounded-lg text-xs font-bold text-slate-900 focus:bg-white"
                    >
                      <option value="">-- 请选择承运渠道 --</option>
                      {(() => {
                        if (!customsType) return null;
                        const valid = channelMappings
                          .filter((m) => m.customsType === customsType)
                          .map((m) => m.forwarderChannel);

                        const list = valid.length > 0
                          ? valid
                          : customsType === '退税报关'
                            ? ['中外运', '万海自营专线']
                            : customsType === '敏感特货'
                              ? ['菲通货运', '万海特货通道']
                              : ['万海自营专线', '中外运', '天帆东南亚', '同行外发分拨'];

                        return list.map((ch) => (
                          <option key={ch} value={ch}>
                            {ch}
                          </option>
                        ));
                      })()}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      预报备注说明
                    </label>
                    <input
                      type="text"
                      placeholder="如 优先配载、易碎品"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* 货物预报清单编辑 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      客户初始预报货物明细清单
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={addStage1Item}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    添加预报货物行
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold">
                        <th className="py-2 px-3 w-10">#</th>
                        <th className="py-2 px-3 w-36">国内快递单号</th>
                        <th className="py-2 px-3 min-w-[130px]">中文品名</th>
                        <th className="py-2 px-2 w-16 text-center">预报件数</th>
                        <th className="py-2 px-2 w-18 text-center">预报长(cm)</th>
                        <th className="py-2 px-2 w-18 text-center">预报宽(cm)</th>
                        <th className="py-2 px-2 w-18 text-center">预报高(cm)</th>
                        <th className="py-2 px-2 w-20 text-center">预报单重(kg)</th>
                        <th className="py-2 px-3 w-24 text-right bg-blue-50/50">预估体积</th>
                        {waybill.orderType !== 'SEA_FCL' && (
                          <>
                            <th className="py-2 px-2 w-24">应收单价(¥)</th>
                            <th className="py-2 px-2 w-24">成本单价(¥)</th>
                          </>
                        )}
                        <th className="py-2 px-2 w-10 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stage1Items.map((item, idx) => {
                        const qty = Number(item.estimatedQuantity) || Number(item.quantity) || 1;
                        const l = Number(item.estimatedLength) || 0;
                        const w = Number(item.estimatedWidth) || 0;
                        const h = Number(item.estimatedHeight) || 0;
                        const vol = l && w && h ? (l * w * h * qty) / 1_000_000 : 0;

                        return (
                          <tr key={item.id || idx}>
                            <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-2 px-2">
                              <input
                                type="text"
                                placeholder="快递单号"
                                value={item.trackingNumber || ''}
                                onChange={(e) => updateStage1Item(idx, 'trackingNumber', e.target.value)}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="text"
                                placeholder="如 实业配件"
                                value={item.productName}
                                onChange={(e) => updateStage1Item(idx, 'productName', e.target.value)}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="number"
                                min="1"
                                value={item.estimatedQuantity || item.quantity}
                                onChange={(e) => updateStage1Item(idx, 'estimatedQuantity', Number(e.target.value))}
                                className="w-full px-1.5 py-1 bg-white border border-slate-300 rounded text-center text-xs"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="number"
                                step="0.1"
                                placeholder="长"
                                value={item.estimatedLength !== undefined && item.estimatedLength !== null ? item.estimatedLength : ''}
                                onChange={(e) => updateStage1Item(idx, 'estimatedLength', e.target.value ? Number(e.target.value) : undefined)}
                                className="w-full px-1.5 py-1 bg-white border border-slate-300 rounded text-center text-xs"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="number"
                                step="0.1"
                                placeholder="宽"
                                value={item.estimatedWidth !== undefined && item.estimatedWidth !== null ? item.estimatedWidth : ''}
                                onChange={(e) => updateStage1Item(idx, 'estimatedWidth', e.target.value ? Number(e.target.value) : undefined)}
                                className="w-full px-1.5 py-1 bg-white border border-slate-300 rounded text-center text-xs"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="number"
                                step="0.1"
                                placeholder="高"
                                value={item.estimatedHeight !== undefined && item.estimatedHeight !== null ? item.estimatedHeight : ''}
                                onChange={(e) => updateStage1Item(idx, 'estimatedHeight', e.target.value ? Number(e.target.value) : undefined)}
                                className="w-full px-1.5 py-1 bg-white border border-slate-300 rounded text-center text-xs"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="number"
                                step="0.1"
                                placeholder="kg"
                                value={item.estimatedWeight !== undefined && item.estimatedWeight !== null ? item.estimatedWeight : ''}
                                onChange={(e) => updateStage1Item(idx, 'estimatedWeight', e.target.value ? Number(e.target.value) : undefined)}
                                className="w-full px-1.5 py-1 bg-white border border-slate-300 rounded text-center text-xs"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-blue-700 bg-blue-50/40">
                              {vol > 0 ? `${vol.toFixed(4)} m³` : '-'}
                            </td>
                            {waybill.orderType !== 'SEA_FCL' && (
                              <>
                                <td className="py-2 px-2">
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="应收"
                                    value={item.receivableUnitPrice !== undefined && item.receivableUnitPrice !== null ? item.receivableUnitPrice : ''}
                                    onChange={(e) => updateStage1Item(idx, 'receivableUnitPrice', e.target.value ? Number(e.target.value) : undefined)}
                                    className="w-full px-1.5 py-1 bg-white border border-slate-300 rounded text-xs"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="成本"
                                    value={item.payableUnitPrice !== undefined && item.payableUnitPrice !== null ? item.payableUnitPrice : ''}
                                    onChange={(e) => updateStage1Item(idx, 'payableUnitPrice', e.target.value ? Number(e.target.value) : undefined)}
                                    className="w-full px-1.5 py-1 bg-white border border-slate-300 rounded text-xs"
                                  />
                                </td>
                              </>
                            )}
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeStage1Item(idx)}
                                disabled={stage1Items.length <= 1}
                                className="text-slate-400 hover:text-red-600 disabled:opacity-30 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              {currentStageIdx > 0 ? (
                <button
                  type="button"
                  onClick={() => handleRollback(0)}
                  className="px-3.5 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  回退状态至【待入库】
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveStageModal(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleStage1Save}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  保存预报快照修改
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 阶段 2 模态框：到仓实测核量与计费 */}
      {/* ========================================================= */}
      {activeStageModal === 2 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded text-xs font-bold">
                  阶段 2 操作
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-1">
                  包裹到仓：实测长宽高、单重与核算计费
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  输入仓库现场实测数据。支持参考客户初始预报值，若无偏差可点击右上角一键快速带入。
                </p>
              </div>
              <button
                onClick={() => setActiveStageModal(null)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    实测入库日期
                  </label>
                  <input
                    type="date"
                    value={inboundDate}
                    onChange={(e) => setInboundDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    运递单号 / 仓库运单号 (仓库收货提供)
                  </label>
                  <input
                    type="text"
                    placeholder="如 FLY100002162 或 AWB91041985"
                    value={expressNo}
                    onChange={(e) => setExpressNo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-blue-900 focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    {waybill.orderType === 'SEA_FCL'
                      ? '各包裹实测尺寸与件数录入 (长/宽/高 单位: cm)'
                      : '各包裹实测尺寸与单价录入 (长/宽/高 单位: cm)'}
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyEstimatedToActual}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    📋 一键带入客户预报值
                  </button>
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 border-b">
                        <th className="py-2.5 px-3">品名与预报基准</th>
                        <th className="py-2.5 px-2 w-20 text-center">实收件数</th>
                        <th className="py-2.5 px-2 w-20 text-center">实测长(cm)</th>
                        <th className="py-2.5 px-2 w-20 text-center">实测宽(cm)</th>
                        <th className="py-2.5 px-2 w-20 text-center">实测高(cm)</th>
                        <th className="py-2.5 px-2 w-20 text-center">实测单重(kg)</th>
                        <th className="py-2.5 px-3 w-28 text-right bg-indigo-50/50">核算体积</th>
                        {waybill.orderType !== 'SEA_FCL' && (
                          <>
                            <th className="py-2.5 px-3 w-24">应收单价(¥)</th>
                            <th className="py-2.5 px-3 w-24">成本单价(¥)</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {editableItems.map((item, idx) => {
                        const qty = Number(item.quantity) || 1;
                        const l = Number(item.length) || 0;
                        const w = Number(item.width) || 0;
                        const h = Number(item.height) || 0;
                        const vol = l && w && h ? (l * w * h * qty) / 1_000_000 : 0;

                        const estQty = item.estimatedQuantity ?? qty;
                        const estDim = item.estimatedLength && item.estimatedWidth && item.estimatedHeight ? `${item.estimatedLength}×${item.estimatedWidth}×${item.estimatedHeight}cm` : null;

                        return (
                          <tr key={item.id || idx}>
                            <td className="py-2 px-3">
                              <div className="font-bold text-slate-900">{item.productName}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                预报: {estQty}件 {estDim ? `| ${estDim}` : ''} {item.estimatedWeight ? `| ${item.estimatedWeight}kg` : ''}
                              </div>
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditableItems((prev) =>
                                    prev.map((it, i) => (i === idx ? { ...it, quantity: val } : it))
                                  );
                                }}
                                className="w-full px-1.5 py-1 bg-slate-50 border rounded text-center text-xs font-bold"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="number"
                                step="0.1"
                                value={item.length || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditableItems((prev) =>
                                    prev.map((it, i) => (i === idx ? { ...it, length: val } : it))
                                  );
                                }}
                                className="w-full px-1.5 py-1 bg-slate-50 border rounded text-center text-xs"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="number"
                                step="0.1"
                                value={item.width || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditableItems((prev) =>
                                    prev.map((it, i) => (i === idx ? { ...it, width: val } : it))
                                  );
                                }}
                                className="w-full px-1.5 py-1 bg-slate-50 border rounded text-center text-xs"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="number"
                                step="0.1"
                                value={item.height || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditableItems((prev) =>
                                    prev.map((it, i) => (i === idx ? { ...it, height: val } : it))
                                  );
                                }}
                                className="w-full px-1.5 py-1 bg-slate-50 border rounded text-center text-xs"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="number"
                                step="0.1"
                                value={item.unitWeight || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditableItems((prev) =>
                                    prev.map((it, i) => (i === idx ? { ...it, unitWeight: val } : it))
                                  );
                                }}
                                className="w-full px-1.5 py-1 bg-slate-50 border rounded text-center text-xs"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-indigo-700 bg-indigo-50/40">
                              {vol > 0 ? `${vol.toFixed(4)} m³` : '-'}
                            </td>
                            {waybill.orderType !== 'SEA_FCL' && (
                              <>
                                <td className="py-2 px-3">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={item.receivableUnitPrice || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditableItems((prev) =>
                                        prev.map((it, i) => (i === idx ? { ...it, receivableUnitPrice: val } : it))
                                      );
                                    }}
                                    className="w-full px-2 py-1 bg-slate-50 border rounded text-xs"
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={item.payableUnitPrice || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditableItems((prev) =>
                                        prev.map((it, i) => (i === idx ? { ...it, payableUnitPrice: val } : it))
                                      );
                                    }}
                                    className="w-full px-2 py-1 bg-slate-50 border rounded text-xs"
                                  />
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              {currentStageIdx > 1 ? (
                <button
                  type="button"
                  onClick={() => handleRollback(1)}
                  className="px-3.5 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  回退状态至【已入库 (INBOUND)】
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveStageModal(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold"
                >
                  取消
                </button>
                {currentStageIdx > 1 ? (
                  <button
                    type="button"
                    onClick={() => handleStage2Submit(false)}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    仅更新实测尺寸数据
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStage2Submit(true)}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md"
                  >
                    保存实测数据并流转为【已入库 (INBOUND)】
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 阶段 3 模态框：人工排柜装箱 */}
      {/* ========================================================= */}
      {activeStageModal === 3 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded text-xs font-bold">
                  阶段 3 操作
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-1">
                  人工排柜：指定装载集装箱货柜
                </h2>
              </div>
              <button
                onClick={() => setActiveStageModal(null)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  从现有集装箱中选择
                </label>
                <select
                  value={selectedContainerId}
                  onChange={(e) => {
                    setSelectedContainerId(e.target.value);
                    if (e.target.value) setNewContainerNo('');
                  }}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- 选择现有集装箱 --</option>
                  {containers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.containerNo} ({c.originPort || '起运港'} ➔ {c.destinationPort || '目的港'}) - {c.status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-[11px] text-slate-400 font-semibold">或者直接输入新柜号</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    新建货柜柜号 (如 广62柜, MILU6019768)
                  </label>
                  <input
                    type="text"
                    placeholder="输入新柜号"
                    value={newContainerNo}
                    onChange={(e) => {
                      setNewContainerNo(e.target.value);
                      if (e.target.value) setSelectedContainerId('');
                    }}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    海运提单号 (选填)
                  </label>
                  <input
                    type="text"
                    placeholder="如 MCLPXMN082208"
                    value={newBlNumber}
                    onChange={(e) => setNewBlNumber(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  装柜配载日期
                </label>
                <input
                  type="date"
                  value={loadingDate}
                  onChange={(e) => setLoadingDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              {currentStageIdx > 2 ? (
                <button
                  type="button"
                  onClick={() => handleRollback(2)}
                  className="px-3.5 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  回退状态至【已装柜 (LOADED)】
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveStageModal(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold"
                >
                  取消
                </button>
                {currentStageIdx > 2 ? (
                  <button
                    type="button"
                    onClick={() => handleStage3Submit(false)}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    保存修改 (保持当前阶段)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStage3Submit(true)}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md"
                  >
                    确认装柜并流转为【已装柜 (LOADED)】
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 阶段 4 模态框：干线启运在途 */}
      {/* ========================================================= */}
      {activeStageModal === 4 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="px-2.5 py-0.5 bg-cyan-100 text-cyan-800 rounded text-xs font-bold">
                  阶段 4 操作
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-1">
                  干线启运：记录开船/起飞与海运提单
                </h2>
              </div>
              <button
                onClick={() => setActiveStageModal(null)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    实际开船日 (ETD) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={sailingDate}
                    onChange={(e) => setSailingDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    预计到港日 (ETA)
                  </label>
                  <input
                    type="date"
                    value={etaDate}
                    onChange={(e) => setEtaDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    船名 / 航次 (Vessel/Voyage) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="如 WAN HAI 312 / V.S012"
                    value={vesselVoyage}
                    onChange={(e) => setVesselVoyage(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    海运提单号 (B/L No.)
                  </label>
                  <input
                    type="text"
                    placeholder="如 MCLPXMN082208"
                    value={blNumber}
                    onChange={(e) => setBlNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-cyan-50/50 border border-cyan-300 rounded-lg text-xs font-mono font-bold text-cyan-950 focus:bg-white focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              {currentStageIdx > 3 ? (
                <button
                  type="button"
                  onClick={() => handleRollback(3)}
                  className="px-3.5 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  回退状态至【在途中 (IN_TRANSIT)】
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveStageModal(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold"
                >
                  取消
                </button>
                {currentStageIdx > 3 ? (
                  <button
                    type="button"
                    onClick={() => handleStage4Submit(false)}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    保存修改 (保持当前阶段)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStage4Submit(true)}
                    className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold shadow-md"
                  >
                    确认启运并流转为【在途中 (IN_TRANSIT)】
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 阶段 5 模态框：目的港清关放行 */}
      {/* ========================================================= */}
      {activeStageModal === 5 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-bold">
                  阶段 5 操作
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-1">
                  目的港清关：海关放行与上传税单水单
                </h2>
              </div>
              <button
                onClick={() => setActiveStageModal(null)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  清关完成放行日期
                </label>
                <input
                  type="date"
                  value={clearanceDate}
                  onChange={(e) => setClearanceDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  海关查验放行状态
                </label>
                <select
                  value={inspectStatus}
                  onChange={(e) => setInspectStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                >
                  <option value="">-- 请选择查验状态 --</option>
                  <option value="正常放行">正常放行 (No Inspection)</option>
                  <option value="海关查验后正常放行">海关查验后正常放行 (Inspected & Cleared)</option>
                  <option value="扣关补税已放行">扣关补税已放行 (Duty Paid & Released)</option>
                </select>
              </div>

              <LocalFileUpload
                label="海关缴税水单 / 放行凭证"
                value={customsSlipUrl}
                onChange={(url) => setCustomsSlipUrl(url)}
                accept="image/*,application/pdf"
                helperText="支持从电脑上传海关税单图片、PDF 或扣关放行证明"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              {currentStageIdx > 4 ? (
                <button
                  type="button"
                  onClick={() => handleRollback(4)}
                  className="px-3.5 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  回退状态至【海外拆派中】
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveStageModal(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold"
                >
                  取消
                </button>
                {currentStageIdx > 4 ? (
                  <button
                    type="button"
                    onClick={() => handleStage5Submit(false)}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    保存修改 (保持当前阶段)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStage5Submit(true)}
                    className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md"
                  >
                    确认放行并流转为【海外拆派中】
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 阶段 6 模态框：海外派送与签收完结 */}
      {/* ========================================================= */}
      {activeStageModal === 6 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-xs font-bold">
                  阶段 6 操作
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-1">
                  送达签收：回传签收单与锁定最终利润
                </h2>
              </div>
              <button
                onClick={() => setActiveStageModal(null)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  客户实际签收日期 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={signedDate}
                  onChange={(e) => setSignedDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium"
                />
              </div>

              <LocalFileUpload
                label="客户签收单照片 / 现场交付回执"
                value={signImageUrl}
                onChange={(url) => setSignImageUrl(url)}
                accept="image/*,application/pdf"
                helperText="支持从电脑上传客户签字盖章的回执照片或签收证明"
              />

              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1 font-mono">
                <span className="font-bold text-emerald-900">最终结算核对:</span>
                <div className="flex justify-between text-slate-700">
                  <span>总应收: ¥{Number(waybill.receivableAmount || 0).toFixed(2)}</span>
                  <span>总成本: ¥{Number(waybill.payableAmount || 0).toFixed(2)}</span>
                  <span className="font-bold text-emerald-700">最终毛利: ¥{Number(waybill.profitAmount || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setActiveStageModal(null)}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleStage6Submit}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md"
              >
                确认完结并流转为【已签收 (DELIVERED)】
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 附加杂费模态框 */}
      {/* ========================================================= */}
      {showFeeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              录入附加杂费
            </h2>

            <form onSubmit={handleAddFee} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">费用名称</label>
                <input
                  type="text"
                  value={feeName}
                  onChange={(e) => setFeeName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">收支方向</label>
                <select
                  value={feeDirection}
                  onChange={(e) => setFeeDirection(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                >
                  <option value="RECEIVABLE">+ 应收客户 (额外加收)</option>
                  <option value="PAYABLE">- 应付成本 (运营支出)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">币种</label>
                  <select
                    value={feeCurrency}
                    onChange={(e) => setFeeCurrency(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="CNY">¥ 人民币 (CNY)</option>
                    <option value="PHP">₱ 菲律宾比索 (PHP)</option>
                    <option value="USD">$ 美元 (USD)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">金额</label>
                  <input
                    type="number"
                    step="0.01"
                    value={feeAmount || ''}
                    onChange={(e) => setFeeAmount(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">备注</label>
                <input
                  type="text"
                  value={feeNote}
                  onChange={(e) => setFeeNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFeeModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-md"
                >
                  确认保存费用
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 附加单据凭证模态框 */}
      {/* ========================================================= */}
      {showAttachModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Paperclip className="w-5 h-5 text-blue-600" />
              追加单证附件
            </h2>

            <form onSubmit={handleAddAttachment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">凭证类型</label>
                <select
                  value={attachmentType}
                  onChange={(e) => setAttachmentType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                >
                  <option value="PICKUP_SCREENSHOT">送仓叫车/提货截图</option>
                  <option value="WAREHOUSE_IMAGE">到仓称重实物图</option>
                  <option value="CUSTOMS_SLIP">海关缴税放行水单</option>
                  <option value="SIGN_IMAGE">客户收货签字签收单</option>
                  <option value="OTHER">其他辅助凭单</option>
                </select>
              </div>

              <LocalFileUpload
                label="选择本地附件单据"
                value={fileUrl}
                fileName={fileName}
                onChange={(url, name) => {
                  setFileUrl(url);
                  if (name) setFileName(name);
                }}
                accept="image/*,application/pdf,.xlsx,.xls,.docx,.doc"
                helperText="直接从电脑上传各类凭证、水单、截图或表格文档"
                required
              />

              {fileUrl && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    文件显示名称 (已自动识别，可按需修改)
                  </label>
                  <input
                    type="text"
                    placeholder="如 叫车单截图.jpg"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAttachModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md"
                >
                  确认上传
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
