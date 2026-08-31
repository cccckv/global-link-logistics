import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Truck,
  Ship,
  DollarSign,
  Paperclip,
  Upload,
  ExternalLink,
  Trash2,
  Edit3,
  Plus,
  Container as ContainerIcon,
  ChevronRight,
  ShieldCheck,
  RotateCcw,
  Save,
  Package,
  Copy,
  Lock,
  Building,
  MapPin,
  X,
  Eye,
} from 'lucide-react';
import {
  waybillV2Api,
  containerV2Api,
  financeV2Api,
  channelV2Api,
  originWarehouseV2Api,
  type Waybill,
  type WaybillItem,
  type ContainerMaster,
  type WaybillStatus,
  type AttachmentType,
  type CurrencyType,
  type ShippingChannel,
  type OriginWarehouse,
} from '../../lib/v2-api';

import {
  DESTINATION_COUNTRIES,
  getPortsByCountry,
  getDefaultPortByCountry,
  ORIGIN_WAREHOUSES,
  ORIGIN_PORTS,
} from '../../lib/logistics-dictionary';
import { LocalFileUpload } from '../../components/v2/LocalFileUpload';

interface StageMeta {
  key: WaybillStatus;
  stageNum: number;
  label: string;
  desc: string;
  actionText?: string;
}

const getStagesByOrderType = (orderType?: string): StageMeta[] => {
  if (orderType === 'SEA_FCL') {
    return [
      {
        key: 'DRAFT',
        stageNum: 1,
        label: '1. 订舱委托',
        desc: '录入箱型规格、国内起运港与整柜报价',
        actionText: '🏭 派车到厂 ➔ 阶段2产地装箱',
      },
      {
        key: 'INBOUND',
        stageNum: 2,
        label: '2. 产地装箱',
        desc: '工厂装箱落封，直接录入集装箱柜号',
        actionText: '🚛 进港报关 ➔ 阶段3进港报关',
      },
      {
        key: 'LOADED',
        stageNum: 3,
        label: '3. 进港报关',
        desc: '重柜送达码头堆场，海关报关放行',
        actionText: '🌊 船舶开航 ➔ 阶段4干线航运',
      },
      {
        key: 'IN_TRANSIT',
        stageNum: 4,
        label: '4. 干线航运',
        desc: '开船航运中，记录海运提单与订舱成本',
        actionText: '🛃 抵港清关 ➔ 阶段5目的港清关',
      },
      {
        key: 'DISPATCHING',
        stageNum: 5,
        label: '5. 目的港清关',
        desc: '海外清关放行，录入税单与提柜送货',
        actionText: '✅ 送达签收 ➔ 阶段6送达签收',
      },
      {
        key: 'DELIVERED',
        stageNum: 6,
        label: '6. 送达签收',
        desc: '客户工厂拆箱收货签字，还空箱完结',
      },
    ];
  }

  if (orderType === 'AIR') {
    return [
      {
        key: 'DRAFT',
        stageNum: 1,
        label: '1. 客户预报',
        desc: '录入品名、件数、国内快递单号',
        actionText: '📦 包裹到仓 ➔ 阶段2到仓实测',
      },
      {
        key: 'INBOUND',
        stageNum: 2,
        label: '2. 到仓实测',
        desc: '过磅称重(kg)、录入车费、核算计费',
        actionText: '✈️ 打包出库 ➔ 阶段3仓库发货',
      },
      {
        key: 'LOADED',
        stageNum: 3,
        label: '3. 仓库发货',
        desc: '打包出库，交接空运专线并出具运单号',
        actionText: '🛬 运抵海外 ➔ 阶段4到海外仓',
      },
      {
        key: 'IN_TRANSIT',
        stageNum: 4,
        label: '4. 到海外仓',
        desc: '专线干线空运双清，到达海外分拨中心',
        actionText: '🚚 安排派送 ➔ 阶段5海外派送',
      },
      {
        key: 'DISPATCHING',
        stageNum: 5,
        label: '5. 海外派送',
        desc: '海外仓出库派送，末端配送中',
        actionText: '✅ 客户签收 ➔ 阶段6签收完结',
      },
      {
        key: 'DELIVERED',
        stageNum: 6,
        label: '6. 签收完结',
        desc: '上传签收单照片，锁定纯毛利',
      },
    ];
  }

  return [
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
};

export default function WaybillDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [waybill, setWaybill] = useState<Waybill | null>(null);
  const [loading, setLoading] = useState(true);
  const [containers, setContainers] = useState<ContainerMaster[]>([]);

  // Stage Modal States
  const [activeStageModal, setActiveStageModal] = useState<number | null>(null);

  // Origin Warehouses Master Data
  const [originWarehouses, setOriginWarehouses] = useState<OriginWarehouse[]>([]);

  // Route & Consignee Card (形态2) States
  const [isRouteCardExpanded, setIsRouteCardExpanded] = useState(false);
  const [showOverseasEditModal, setShowOverseasEditModal] = useState(false);
  const [editOverseasName, setEditOverseasName] = useState('');
  const [editOverseasPhone, setEditOverseasPhone] = useState('');
  const [editOverseasCompany, setEditOverseasCompany] = useState('');
  const [editOverseasRegion, setEditOverseasRegion] = useState('');
  const [editOverseasAddress, setEditOverseasAddress] = useState('');
  const [savingOverseas, setSavingOverseas] = useState(false);

  // Stage 1 (预报修改) State
  const [userMark, setUserMark] = useState('');
  const [originWarehouse, setOriginWarehouse] = useState('');
  const [destinationCountry, setDestinationCountry] = useState('');
  const [destinationPort, setDestinationPort] = useState('');
  const [forwarderChannel, setForwarderChannel] = useState('');
  const [channels, setChannels] = useState<ShippingChannel[]>([]);
  const [note, setNote] = useState('');

  // Stage 1 Overseas Consignee
  const [stage1OverseasName, setStage1OverseasName] = useState('');
  const [stage1OverseasPhone, setStage1OverseasPhone] = useState('');
  const [stage1OverseasCompany, setStage1OverseasCompany] = useState('');
  const [stage1OverseasRegion, setStage1OverseasRegion] = useState('');
  const [stage1OverseasAddress, setStage1OverseasAddress] = useState('');

  // Stage 2 (实测尺寸) State
  const [inboundDate, setInboundDate] = useState('');
  const [expressNo, setExpressNo] = useState('');
  const [editableItems, setEditableItems] = useState<any[]>([]);

  // Stage 3 (装柜配载) State
  const [selectedContainerId, setSelectedContainerId] = useState('');
  const [newContainerNo, setNewContainerNo] = useState('');
  const [loadingDate, setLoadingDate] = useState('');

  // Stage 4 (干线启运) State
  const [sailingDate, setSailingDate] = useState('');
  const [etaDate, setEtaDate] = useState('');
  const [vesselVoyage, setVesselVoyage] = useState('');
  const [blNumber, setBlNumber] = useState('');

  // Stage 5 (清关放行 & 目的港送柜拖车) State
  const [clearanceDate, setClearanceDate] = useState('');
  const [inspectStatus, setInspectStatus] = useState('');
  const [customsSlipUrl, setCustomsSlipUrl] = useState('');
  const [truckDriverName, setTruckDriverName] = useState('');
  const [truckDriverPhone, setTruckDriverPhone] = useState('');
  const [truckPlateNo, setTruckPlateNo] = useState('');
  const [truckingDate, setTruckingDate] = useState('');
  const [destArrivedDate, setDestArrivedDate] = useState('');
  const [hasInheritedTrucking, setHasInheritedTrucking] = useState(false);

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
  const [attachmentType, setAttachmentType] = useState<AttachmentType>('OTHER');
  const [attachFiles, setAttachFiles] = useState<Array<{ url: string; name: string; size?: number }>>([]);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [wbRes, contRes, chanRes, whRes] = await Promise.all([
        waybillV2Api.getById(id),
        containerV2Api.list({ limit: 100 }),
        channelV2Api.list({ isActive: true }),
        originWarehouseV2Api.list({ isActive: true }),
      ]);

      if (chanRes.data.success && chanRes.data.data) {
        setChannels(chanRes.data.data);
      }

      if (whRes.data.success && whRes.data.data) {
        setOriginWarehouses(whRes.data.data);
      }

      if (wbRes.data.success) {
        const wb = wbRes.data.data;
        setWaybill(wb);
        setUserMark(wb.userMark || '');
        setOriginWarehouse(wb.originWarehouse || '');
        setDestinationCountry(wb.destinationCountry || '');
        setDestinationPort(wb.destinationPort || '');
        setForwarderChannel(wb.forwarderChannel || '');
        setNote(wb.note || '');

        setStage1OverseasName(wb.overseasName || '');
        setStage1OverseasPhone(wb.overseasPhone || '');
        setStage1OverseasCompany(wb.overseasCompany || '');
        setStage1OverseasRegion(wb.overseasRegion || wb.destinationCountry || '');
        setStage1OverseasAddress(wb.overseasAddress || '');

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
        const initClearanceDate = wb.clearanceDate || wb.containerMaster?.clearanceDate;
        setClearanceDate(initClearanceDate ? new Date(initClearanceDate).toISOString().slice(0, 10) : '');
        setInspectStatus((wb as any).inspectStatus || '正常放行');
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

        const cont = wb.containerMaster;
        const dName = cont?.driverName || '';
        const dPhone = cont?.driverPhone || '';
        const pNo = cont?.truckPlateNo || '';
        const tDate = cont?.truckingDate ? new Date(cont.truckingDate).toISOString().slice(0, 10) : '';
        const aDate = cont?.destArrivedDate ? new Date(cont.destArrivedDate).toISOString().slice(0, 10) : '';

        setTruckDriverName(dName);
        setTruckDriverPhone(dPhone);
        setTruckPlateNo(pNo);
        setTruckingDate(tDate);
        setDestArrivedDate(aDate);
        setHasInheritedTrucking(Boolean(dName || pNo || dPhone || tDate || aDate));
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

  // Quick Create Container Modal (Stage 2)
  const [showQuickContainerModal, setShowQuickContainerModal] = useState(false);
  const [quickContainerNo, setQuickContainerNo] = useState('');
  const [quickContainerType, setQuickContainerType] = useState('40HQ');
  const [quickOriginPort, setQuickOriginPort] = useState('');
  const [quickDestinationPort, setQuickDestinationPort] = useState('');
  const [quickBlNumber, setQuickBlNumber] = useState('');
  const [quickBookingCost, setQuickBookingCost] = useState('');
  const [isCreatingContainer, setIsCreatingContainer] = useState(false);

  const handleQuickCreateContainer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickContainerNo.trim()) {
      toast.error('请输入集装箱柜号');
      return;
    }
    setIsCreatingContainer(true);
    try {
      const res = await containerV2Api.create({
        containerNo: quickContainerNo.trim().toUpperCase(),
        containerType: quickContainerType || undefined,
        originPort: quickOriginPort.trim() || waybill?.originWarehouse || undefined,
        destinationPort: quickDestinationPort.trim() || waybill?.destinationPort || undefined,
        blNumber: quickBlNumber.trim() || undefined,
        loadingDate: inboundDate ? new Date(inboundDate).toISOString() : new Date().toISOString(),
        status: 'LOADING',
      });
      if (res.data.success) {
        const newCont = res.data.data;
        // 如果填写了订柜成本，自动创建 BOOKING_FEE 费目
        const costVal = parseFloat(quickBookingCost);
        if (costVal > 0) {
          try {
            await containerV2Api.addFee(newCont.id, {
              feeSubject: 'BOOKING_FEE',
              feeDirection: 'PAYABLE',
              amount: costVal,
              currency: 'CNY',
              exchangeRate: 1,
              note: '快速建柜时录入的订柜成本',
            });
          } catch {
            toast.error('集装箱已创建，但订柜成本写入失败，请在货柜详情中手动补录');
          }
        }
        toast.success(`集装箱 ${newCont.containerNo} 创建成功并已自动选中！`);
        const contListRes = await containerV2Api.list({ limit: 100 });
        if (contListRes.data.success) {
          setContainers(contListRes.data.data || []);
        }
        setSelectedContainerId(newCont.id);
        setNewContainerNo('');
        setShowQuickContainerModal(false);
        setQuickContainerNo('');
        setQuickBlNumber('');
        setQuickBookingCost('');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || '新建集装箱失败');
    } finally {
      setIsCreatingContainer(false);
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
      prev.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it, [field]: val };
        if (['estimatedLength', 'estimatedWidth', 'estimatedHeight', 'estimatedQuantity', 'quantity'].includes(field)) {
          const qty = Number(field === 'estimatedQuantity' ? val : (updated.estimatedQuantity || updated.quantity || 1));
          const l = Number(field === 'estimatedLength' ? val : updated.estimatedLength) || 0;
          const w = Number(field === 'estimatedWidth' ? val : updated.estimatedWidth) || 0;
          const h = Number(field === 'estimatedHeight' ? val : updated.estimatedHeight) || 0;
          if (l && w && h) {
            updated.estimatedVolume = Number(((l * w * h * qty) / 1_000_000).toFixed(4));
          }
        }
        return updated;
      })
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
        const estVol = it.estimatedVolume !== undefined && it.estimatedVolume !== null ? it.estimatedVolume : it.payableVolume;
        return {
          ...it,
          quantity: estQty,
          length: estL,
          width: estW,
          height: estH,
          unitWeight: estWt,
          payableVolume: estVol,
        };
      })
    );
    toast.success('已一键带入客户预报尺寸、重量、方数与件数！');
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // 一键复制派件指令 (格式化文本)
  const handleCopyDispatchInstruction = () => {
    if (!waybill) return;
    const pcs = waybill.totalPieces || waybill.items?.reduce((s, i) => s + (i.quantity || 1), 0) || 0;
    const cbm = (Number(waybill.totalPayableCbm) || 0).toFixed(3);
    const originHub = originWarehouses.find(
      (w) => w.code === waybill.originWarehouse || w.shortName === waybill.originWarehouse || w.name === waybill.originWarehouse
    );
    const text = `【派件单】运单号: ${waybill.waybillNo} | 唛头: ${waybill.userMark || '无'}
始发仓: ${originHub?.name || waybill.originWarehouse || '广州集运仓'}
目的地: ${waybill.destinationCountry || ''}${waybill.orderType !== 'AIR' && waybill.destinationPort ? ` (${waybill.destinationPort})` : ''}
海外收件人: ${waybill.overseasName || '未填写'}
海外联系电话: ${waybill.overseasPhone || '未填写'}
海外收件公司: ${waybill.overseasCompany || '无'}
派送地址: ${waybill.overseasAddress || '自提/未填'}
货物概况: 共 ${pcs} 件 / ${waybill.orderType === 'AIR' ? `实测总重 ${waybill.totalWeightKg || 0} kg` : `计费体积 ${cbm} m³`} / 渠道: ${waybill.forwarderChannel || '专线'}`;

    navigator.clipboard.writeText(text);
    toast.success('已复制派件指令至剪贴板！');
  };

  // 独立保存/修改海外收件人 (随时在途变更)
  const handleSaveOverseasConsignee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waybill) return;
    setSavingOverseas(true);
    try {
      await waybillV2Api.update(waybill.id, {
        overseasName: editOverseasName.trim() || undefined,
        overseasPhone: editOverseasPhone.trim() || undefined,
        overseasCompany: editOverseasCompany.trim() || undefined,
        overseasRegion: editOverseasRegion.trim() || undefined,
        overseasAddress: editOverseasAddress.trim() || undefined,
      });
      toast.success('海外收件人与派送信息已成功更新！');
      setShowOverseasEditModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || '修改海外收件人失败');
    } finally {
      setSavingOverseas(false);
    }
  };

  // Stage 1 Save (修改预报信息与货物快照)
  const handleStage1Save = async () => {
    if (!waybill) return;
    try {
      const isInitialStage = waybill.status === 'DRAFT';
      await waybillV2Api.update(waybill.id, {
        userMark: userMark.trim(),
        originWarehouse,
        destinationCountry,
        destinationPort: waybill.orderType === 'AIR' ? undefined : (destinationPort.trim() || undefined),
        forwarderChannel: forwarderChannel.trim() || undefined,
        note: note.trim() || undefined,
        overseasName: stage1OverseasName.trim() || undefined,
        overseasPhone: stage1OverseasPhone.trim() || undefined,
        overseasCompany: stage1OverseasCompany.trim() || undefined,
        overseasRegion: stage1OverseasRegion.trim() || destinationCountry || undefined,
        overseasAddress: stage1OverseasAddress.trim() || undefined,
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
            payableVolume: isInitialStage ? estVol : (orig?.payableVolume !== undefined && orig?.payableVolume !== null ? Number(orig.payableVolume) : undefined),
            receivableVolume: isInitialStage ? estVol : (orig?.receivableVolume !== undefined && orig?.receivableVolume !== null ? Number(orig.receivableVolume) : undefined),
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


  // Stage 2 Save & Advance: 到仓实测尺寸与入库 (拼箱) / 产地装箱直录柜号 (整柜) / 实测称重 (空运)
  const handleStage2Submit = async (advanceStatus: boolean = true) => {
    if (!waybill) return;

    // 海运整柜 (SEA_FCL) 专用分支: 工厂装箱与直录柜号绑定
    if (waybill.orderType === 'SEA_FCL') {
      try {
        let targetContainerId = selectedContainerId;

        if (!targetContainerId && newContainerNo.trim()) {
          const createCRes = await containerV2Api.create({
            containerNo: newContainerNo.trim(),
            blNumber: blNumber.trim() || undefined,
            loadingDate: (inboundDate && String(inboundDate).trim()) ? inboundDate : new Date().toISOString().slice(0, 10),
            status: 'LOADING',
            originPort: waybill.originWarehouse || undefined,
            destinationPort: waybill.destinationPort || undefined,
          });
          targetContainerId = createCRes.data.data.id;
        }

        const payload: any = {
          inboundDate: (inboundDate && String(inboundDate).trim()) ? inboundDate : (advanceStatus ? new Date().toISOString() : undefined),
          expressNo: expressNo.trim() || undefined,
          containerId: targetContainerId || undefined,
          items: editableItems.map((item, idx) => {
            const orig = waybill.items?.find((i) => i.id === item.id) || (waybill.items ? waybill.items[idx] : undefined);
            const payableVol = item.payableVolume !== undefined && item.payableVolume !== null && String(item.payableVolume).trim() !== ''
              ? Number(item.payableVolume)
              : undefined;

            return {
              id: item.id?.startsWith('temp_') ? undefined : item.id,
              productName: item.productName,
              trackingNumber: item.trackingNumber,
              quantity: Number(item.quantity) || 1,
              length: item.length !== undefined && item.length !== null && String(item.length).trim() !== '' ? Number(item.length) : undefined,
              width: item.width !== undefined && item.width !== null && String(item.width).trim() !== '' ? Number(item.width) : undefined,
              height: item.height !== undefined && item.height !== null && String(item.height).trim() !== '' ? Number(item.height) : undefined,
              payableVolume: payableVol,
              unitWeight: item.unitWeight !== undefined && item.unitWeight !== null && String(item.unitWeight).trim() !== '' ? Number(item.unitWeight) : undefined,
              // 保留阶段 1 预报快照
              estimatedQuantity: orig?.estimatedQuantity !== undefined && orig?.estimatedQuantity !== null ? Number(orig.estimatedQuantity) : Number(item.quantity) || 1,
              estimatedLength: orig?.estimatedLength !== undefined && orig?.estimatedLength !== null ? Number(orig.estimatedLength) : undefined,
              estimatedWidth: orig?.estimatedWidth !== undefined && orig?.estimatedWidth !== null ? Number(orig.estimatedWidth) : undefined,
              estimatedHeight: orig?.estimatedHeight !== undefined && orig?.estimatedHeight !== null ? Number(orig.estimatedHeight) : undefined,
              estimatedVolume: orig?.estimatedVolume !== undefined && orig?.estimatedVolume !== null ? Number(orig.estimatedVolume) : undefined,
              estimatedWeight: orig?.estimatedWeight !== undefined && orig?.estimatedWeight !== null ? Number(orig.estimatedWeight) : (item.unitWeight ? Number(item.unitWeight) : undefined),
            };
          }),
        };

        if (advanceStatus) {
          payload.status = 'INBOUND';
        }

        await waybillV2Api.update(waybill.id, payload);
        toast.success(advanceStatus ? '阶段 2 产地装箱完成，已绑定集装箱并流转至【产地装箱 (INBOUND)】！' : '产地装箱信息已成功更新！');
        setActiveStageModal(null);
        loadData();
      } catch (err: any) {
        toast.error(err.response?.data?.error || '阶段 2 产地装箱保存失败');
      }
      return;
    }

    // 散货拼箱与空运通用分支
    try {
      const payload: any = {
        inboundDate: (inboundDate && String(inboundDate).trim()) ? inboundDate : (advanceStatus ? new Date().toISOString() : undefined),
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

  // Stage 3 Save & Advance: 人工排柜 (海运) / 仓库发货 (空运)
  const handleStage3Submit = async (advanceStatus: boolean = true) => {
    if (!waybill) return;

    // 前置门禁校验：推进流转前必须确保阶段 2 实测数据已完整录入
    if (advanceStatus) {
      if (waybill.orderType === 'AIR') {
        const hasWeight = (waybill.totalWeightKg && waybill.totalWeightKg > 0) ||
          waybill.items.some((it) => it.unitWeight && it.unitWeight > 0);
        if (!hasWeight) {
          toast.error('无法发货：当前运单尚未录入到仓实测重量，请先在阶段 2 完善实测重量！');
          return;
        }
      } else if (waybill.orderType === 'SEA_LCL') {
        const hasVol = (waybill.totalPayableCbm && waybill.totalPayableCbm > 0) ||
          waybill.items.some((it) => (it.payableVolume && it.payableVolume > 0) || (it.length && it.width && it.height));
        if (!hasVol) {
          toast.error('无法装柜：当前运单尚未录入到仓实测尺寸或体积，请先在阶段 2 完成实测核量！');
          return;
        }
      } else if (waybill.orderType === 'SEA_FCL') {
        if (!waybill.containerId && !selectedContainerId && !newContainerNo.trim()) {
          toast.error('无法进港报关：当前运单尚未在阶段 2 录入或绑定集装箱柜号！');
          return;
        }
      }
    }

    // 空运专用分支
    if (waybill.orderType === 'AIR') {
      if (!expressNo || !expressNo.trim()) {
        toast.error('【发货运单号】为必填项！仓库发货必须提供专线运单号或转运单号。');
        return;
      }

      try {
        const payload: any = {
          expressNo: expressNo.trim(),
          forwarderChannel: forwarderChannel?.trim() || undefined,
          loadingDate: loadingDate ? new Date(loadingDate).toISOString() : (advanceStatus ? new Date().toISOString() : undefined),
          note: note?.trim() || undefined,
        };

        if (advanceStatus) {
          payload.status = 'LOADED';
        }

        await waybillV2Api.update(waybill.id, payload);
        toast.success(advanceStatus ? '阶段 3 仓库发货完成，运单流转至【已发货 (LOADED)】！' : '发货运单信息已成功更新！');
        setActiveStageModal(null);
        loadData();
      } catch (err: any) {
        toast.error(err.response?.data?.error || '阶段 3 发货保存失败');
      }
      return;
    }

    // 海运整柜 (SEA_FCL) 专用分支: 进港报关确认
    if (waybill.orderType === 'SEA_FCL') {
      try {
        let targetContainerId = waybill.containerId || selectedContainerId;

        const validLoadingDate = (loadingDate && String(loadingDate).trim())
          ? new Date(loadingDate).toISOString()
          : (advanceStatus ? new Date().toISOString() : undefined);

        if (!targetContainerId && newContainerNo.trim()) {
          const createCRes = await containerV2Api.create({
            containerNo: newContainerNo.trim(),
            blNumber: blNumber.trim() || undefined,
            loadingDate: validLoadingDate || new Date().toISOString(),
            status: 'LOADING',
            originPort: waybill.originWarehouse || undefined,
            destinationPort: waybill.destinationPort || undefined,
          });
          targetContainerId = createCRes.data.data.id;
        }

        // Update container loadingDate if container exists
        if (targetContainerId && validLoadingDate) {
          await containerV2Api.update(targetContainerId, {
            loadingDate: validLoadingDate,
          });
        }

        const updatePayload: any = {
          containerId: targetContainerId || undefined,
          loadingDate: validLoadingDate,
        };

        if (advanceStatus) {
          updatePayload.status = 'LOADED';
        }

        await waybillV2Api.update(waybill.id, updatePayload);

        toast.success(advanceStatus ? '阶段 3 进港报关完成，运单流转至【进港报关 (LOADED)】！' : '进港报关数据已成功更新！');
        setActiveStageModal(null);
        loadData();
      } catch (err: any) {
        toast.error(err.response?.data?.error || '阶段 3 进港报关保存失败');
      }
      return;
    }

    // 散货拼箱海运分支
    try {
      const targetContainerId = selectedContainerId;

      if (!targetContainerId) {
        toast.error('请选择已有集装箱，或点击「快速新建货柜」创建新集装箱');
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

  // Stage 4 Save & Advance: 干线启运在途 (海运) / 到海外仓 (空运)
  const handleStage4Submit = async (advanceStatus: boolean = true) => {
    if (!waybill) return;

    // 前置门禁校验：海运分支必须已在阶段 3 装柜分配集装箱
    if (advanceStatus) {
      if (waybill.orderType !== 'AIR' && !waybill.containerId) {
        toast.error('无法启运在途：当前运单尚未在阶段 3 分配集装箱货柜，请先完成装柜配载！');
        return;
      }
    }

    // 空运专用分支
    if (waybill.orderType === 'AIR') {
      try {
        const payload: any = {
          clearanceDate: clearanceDate ? new Date(clearanceDate).toISOString() : (advanceStatus ? new Date().toISOString() : undefined),
        };

        if (advanceStatus) {
          payload.status = 'IN_TRANSIT';
        }

        await waybillV2Api.update(waybill.id, payload);
        toast.success(advanceStatus ? '阶段 4 到海外仓节点已记录，运单流转至【到海外仓 (IN_TRANSIT)】！' : '到达海外仓信息已更新！');
        setActiveStageModal(null);
        loadData();
      } catch (err: any) {
        toast.error(err.response?.data?.error || '阶段 4 保存失败');
      }
      return;
    }

    // 海运分支
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

  // Stage 5 Save & Advance: 清关放行 (海运) / 海外派送 (空运)
  const handleStage5Submit = async (advanceStatus: boolean = true) => {
    if (!waybill) return;

    // 前置门禁校验：海运分支必须已有阶段 4 实际开船日（已出海启运）
    if (advanceStatus) {
      if (waybill.orderType !== 'AIR') {
        const hasSailing = waybill.sailingDate || waybill.containerMaster?.sailingDate;
        if (!hasSailing) {
          toast.error('无法办理清关：当前集装箱尚未在阶段 4 记录实际开船日（班轮未启运），请先完善开船信息！');
          return;
        }
      } else {
        if (!waybill.expressNo) {
          toast.error('无法安排海外派送：当前运单尚未在阶段 3 录入发货运单号！');
          return;
        }
      }
    }

    // 空运专用分支
    if (waybill.orderType === 'AIR') {
      try {
        const payload: any = {};
        if (advanceStatus) {
          payload.status = 'DISPATCHING' as any;
        }
        if (note?.trim()) {
          payload.note = note.trim();
        }

        await waybillV2Api.update(waybill.id, payload);
        toast.success(advanceStatus ? '阶段 5 海外派送中已记录，运单流转至【海外派送 (DISPATCHING)】！' : '派送信息已更新！');
        setActiveStageModal(null);
        loadData();
      } catch (err: any) {
        toast.error(err.response?.data?.error || '阶段 5 更新失败');
      }
      return;
    }

    // 海运分支
    if (advanceStatus) {
      if (!truckDriverName.trim()) {
        toast.error('请填写目的港送柜拖车司机姓名！');
        return;
      }
      if (!truckDriverPhone.trim()) {
        toast.error('请填写拖车司机联系电话！');
        return;
      }
      if (!truckPlateNo.trim()) {
        toast.error('请填写拖车车牌号码！');
        return;
      }
      if (!truckingDate) {
        toast.error('请选择订车/提柜时间！');
        return;
      }
      if (!destArrivedDate) {
        toast.error('请选择送达仓库时间！');
        return;
      }
    }

    try {
      const formattedClearanceDate = clearanceDate ? new Date(clearanceDate).toISOString() : (advanceStatus ? new Date().toISOString() : undefined);

      const waybillPayload: any = {
        clearanceDate: formattedClearanceDate,
      };
      if (advanceStatus) {
        waybillPayload.status = 'DISPATCHING';
      }

      await waybillV2Api.update(waybill.id, waybillPayload);

      if (customsSlipUrl.trim()) {
        await financeV2Api.addAttachment(waybill.id, {
          attachmentType: 'CUSTOMS_SLIP',
          fileUrl: customsSlipUrl.trim(),
          fileName: '海关缴税放行水单',
        });
      }

      if (waybill.containerId) {
        await containerV2Api.update(waybill.containerId, {
          status: advanceStatus ? 'DISPATCHING' : undefined,
          clearanceDate: formattedClearanceDate,
          inspectStatus,
          driverName: truckDriverName.trim() || undefined,
          driverPhone: truckDriverPhone.trim() || undefined,
          truckPlateNo: truckPlateNo.trim() || undefined,
          truckingDate: truckingDate ? new Date(truckingDate).toISOString() : undefined,
          destArrivedDate: destArrivedDate ? new Date(destArrivedDate).toISOString() : undefined,
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
    if (!waybill) return;

    // 前置门禁刚性拦截：必须已具备阶段 5 清关放行及拖车送达记录
    if (waybill.orderType !== 'AIR') {
      const hasClearance = waybill.clearanceDate || waybill.containerMaster?.clearanceDate;
      const hasTrucking = Boolean(
        truckPlateNo?.trim() ||
        truckDriverName?.trim() ||
        destArrivedDate ||
        waybill.containerMaster?.truckPlateNo ||
        waybill.containerMaster?.driverName ||
        waybill.containerMaster?.destArrivedDate
      );
      if (!hasClearance || !hasTrucking) {
        toast.error('无法完成签收：当前运单尚未在阶段 5 记录目的港清关放行及送柜拖车信息，请先完善阶段 5 数据！');
        return;
      }
    } else {
      if (waybill.status !== 'DISPATCHING' && !waybill.clearanceDate) {
        toast.error('无法完成签收：当前运单尚未到达海外仓并进入阶段 5 海外派送，请先完善阶段 5 派送信息！');
        return;
      }
    }

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
        await financeV2Api.addAttachment(waybill.id, {
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
    if (!waybill) return;
    if (!feeAmount || feeAmount <= 0) {
      toast.error('请输入有效金额');
      return;
    }
    try {
      await financeV2Api.addFee(waybill.id, {
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
      await financeV2Api.deleteFee(feeId);
      toast.success('杂费已删除');
      loadData();
    } catch (err: any) {
      toast.error('删除费用失败');
    }
  };

  // Add Attachment (Supports batch multi-file)
  const handleAddAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waybill) return;
    if (attachFiles.length === 0) {
      toast.error('请选择或上传至少一份单据文件/图片');
      return;
    }
    try {
      await Promise.all(
        attachFiles.map((file) =>
          financeV2Api.addAttachment(waybill.id, {
            attachmentType,
            fileUrl: file.url,
            fileName: file.name || '单证图片',
          })
        )
      );
      toast.success(`成功追加 ${attachFiles.length} 份单证附件凭据！`);
      setShowAttachModal(false);
      setAttachFiles([]);
      loadData();
    } catch (err: any) {
      toast.error('上传附件失败');
    }
  };
  // Delete Attachment
  const handleDeleteAttachment = async (attId: string) => {
    if (!confirm('确认删除该单证附件？')) return;
    try {
      await financeV2Api.deleteAttachment(attId);
      toast.success('附件已删除');
      loadData();
    } catch (err: any) {
      toast.error('删除附件失败');
    }
  };

  // Handle clicking on a stage card (Inspection & Edit for achieved stages)
  const handleStageCardClick = (targetStageNum: number, targetIdx: number) => {
    if (!waybill) return;
    // 严禁越级跳步：未达到的未来阶段 (targetIdx > currentStageIdx) 严格上锁不可打开
    if (targetIdx > currentStageIdx && waybill.status !== 'DELIVERED') {
      toast.warning(
        `流程不可跳跃！当前处于【${currentStage.label}】，请通过下方待办指引按顺序推进流程。`
      );
      return;
    }
    setActiveStageModal(targetStageNum);
  };

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

  // Calculate current stage index based on dynamic orderType stages
  const stages = getStagesByOrderType(waybill.orderType);
  let currentStageIdx = stages.findIndex((s) => s.key === waybill.status);
  if (currentStageIdx === -1) {
    if (waybill.status === 'CUSTOMS') currentStageIdx = 4;
    else currentStageIdx = 0;
  }
  const currentStage = stages[currentStageIdx] || stages[0];

  // Rollback Stage Handler (Waterfall Truncation & Container Cascade)
  const handleRollback = async (targetStageIdx: number) => {
    const targetStage = stages[targetStageIdx];
    if (!targetStage || !waybill) return;

    let confirmMsg = `确认将运单状态回退至【${targetStage.label}】？\n系统将自动清空此阶段之后的所有流转数据（如开船、清关或签收时间），确保数据干净一致。`;

    // 针对海运拼箱且已装柜的干线回退 (阶段 3/4)
    if (waybill.orderType === 'SEA_LCL' && waybill.containerId && targetStageIdx >= 2) {
      confirmMsg = `⚠️ 货柜级广播联动警告：\n当前运单已装载于货柜【${waybill.containerMaster?.containerNo || '集装箱'}】。\n回退至【${targetStage.label}】将同步将该货柜及柜内处于更高阶段的所有拼箱运单回退至此状态，并清空后续干线/清关时间。\n\n是否确认整柜同步回退？`;
    } else if (targetStageIdx <= 1 && waybill.containerId) {
      confirmMsg = `⚠️ 单票掏箱与解绑确认：\n确认将当前运单回退至【${targetStage.label}】？\n此操作将单独把当前这 1 票货物从货柜【${waybill.containerMaster?.containerNo || '集装箱'}】中解绑移出（掏箱退仓），清空后续装柜与干线数据。\n同柜其余运单不受任何影响。`;
    }

    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      // 构造阶段水位线截断清空 Payload
      const payload: any = {
        status: targetStage.key,
      };

      if (targetStageIdx === 0) {
        // 回退至阶段 1 (DRAFT): 清空入库、装柜、开船、清关、签收，并单票解绑货柜
        payload.containerId = null;
        payload.inboundDate = null;
        payload.loadingDate = null;
        payload.sailingDate = null;
        payload.clearanceDate = null;
        payload.signedDate = null;
        payload.voyageNumber = null;
        payload.expressNo = null;
      } else if (targetStageIdx === 1) {
        // 回退至阶段 2 (INBOUND): 保留实测尺寸重量，清空装柜、开船、清关、签收，并单票解绑货柜
        payload.containerId = null;
        payload.loadingDate = null;
        payload.sailingDate = null;
        payload.clearanceDate = null;
        payload.signedDate = null;
        payload.voyageNumber = null;
      } else if (targetStageIdx === 2) {
        // 回退至阶段 3 (LOADED): 清空开船、清关、签收
        payload.sailingDate = null;
        payload.clearanceDate = null;
        payload.signedDate = null;
        payload.voyageNumber = null;

        // 若为拼箱整柜广播，同步将货柜自身状态回退为 LOADING
        if (waybill.containerId) {
          await containerV2Api.update(waybill.containerId, {
            status: 'LOADING',
          });
        }
      } else if (targetStageIdx === 3) {
        // 回退至阶段 4 (IN_TRANSIT): 清空清关、签收
        payload.clearanceDate = null;
        payload.signedDate = null;

        // 若为拼箱整柜广播，同步将货柜自身状态回退为 SAILING
        if (waybill.containerId) {
          await containerV2Api.update(waybill.containerId, {
            status: 'SAILING',
          });
        }
      } else if (targetStageIdx === 4) {
        // 回退至阶段 5 (DISPATCHING): 清空签收时间
        payload.signedDate = null;
      }

      await waybillV2Api.update(waybill.id, payload);
      toast.success(`运单已成功回退至【${targetStage.label}】，后续流转数据已彻底清理！`);
      setActiveStageModal(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || '状态回退失败');
    }
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
              回退至【{stages[currentStageIdx - 1]?.label}】
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

      {/* 形态 2: 紧凑路线与收发档案看板 (Collapsible / Expandable) */}
      {(() => {
        const originHubInfo = originWarehouses.find(
          (w) =>
            w.code === waybill.originWarehouse ||
            w.shortName === waybill.originWarehouse ||
            w.name === waybill.originWarehouse
        );
        const originPortName = ORIGIN_PORTS.find(
          (p) => p === waybill.originWarehouse
        ) || waybill.originWarehouse || '国内起运港';

        return (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all">
            <div className="px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-4 flex-wrap text-xs">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-blue-600" />
                  {waybill.orderType === 'SEA_FCL'
                    ? '海运整柜专属干线路径'
                    : waybill.orderType === 'AIR'
                    ? '空运专线干线路径'
                    : '散货拼箱集运路径'}
                </span>
                <span className="text-slate-300">|</span>
                <div className="flex items-center gap-2 font-semibold">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-mono text-[11px]">
                    {waybill.orderType === 'SEA_FCL'
                      ? originPortName
                      : (originHubInfo?.shortName || waybill.originWarehouse || '国内集拼仓')}
                  </span>
                  <span className="text-slate-400">➔</span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono text-[11px]">
                    {waybill.destinationCountry || '目的国'}{waybill.orderType !== 'AIR' && waybill.destinationPort ? ` (${waybill.destinationPort})` : ''}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end md:self-auto">
                <button
                  type="button"
                  onClick={handleCopyDispatchInstruction}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition-all"
                  title="一键复制海外派件派送指令信息"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  复制派件指令
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditOverseasName(waybill.overseasName || '');
                    setEditOverseasPhone(waybill.overseasPhone || '');
                    setEditOverseasCompany(waybill.overseasCompany || '');
                    setEditOverseasRegion(waybill.overseasRegion || waybill.destinationCountry || '');
                    setEditOverseasAddress(waybill.overseasAddress || '');
                    setShowOverseasEditModal(true);
                  }}
                  className="px-3 py-1.5 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition-all"
                  title="随时在途纠偏与更新海外收件人及送货地址"
                >
                  <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                  修改海外收件人
                </button>
                <button
                  type="button"
                  onClick={() => setIsRouteCardExpanded(!isRouteCardExpanded)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 ml-2"
                >
                  {isRouteCardExpanded ? '收起档案' : '展开档案'}
                  <ChevronRight
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isRouteCardExpanded ? 'rotate-90' : ''
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* 展开内容：始发枢纽与海外收件人详细档案 */}
            {isRouteCardExpanded && (
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white border-t border-slate-100">
                {/* 左侧：始发地枢纽信息 */}
                <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Building className="w-4 h-4 text-blue-600" />
                      {waybill.orderType === 'SEA_FCL'
                        ? '国内起运港口档案 (Origin Port)'
                        : '始发集运仓库档案 (Hub Depot)'}
                    </span>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                      {waybill.orderType === 'SEA_FCL'
                        ? 'PORT'
                        : (originHubInfo?.code || 'WAREHOUSE')}
                    </span>
                  </div>
                  {waybill.orderType === 'SEA_FCL' ? (
                    <div className="space-y-1.5 text-slate-600">
                      <p>
                        <span className="text-slate-400">起运港名称:</span>{' '}
                        <span className="font-bold text-slate-900">
                          {originPortName}
                        </span>
                      </p>
                      <p>
                        <span className="text-slate-400">集装箱堆场 / 码头作业区:</span>{' '}
                        <span className="font-medium text-slate-800">
                          国际集装箱码头堆场 (海关监管区)
                        </span>
                      </p>
                      <p className="text-[11px] text-blue-700 bg-blue-50/80 p-2 rounded border border-blue-200">
                        💡 提示：海运整柜由拖车直接在工厂/产地装箱落封后送达该港口码头，无需进入国内散货集拼仓。
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-slate-600">
                      <p>
                        <span className="text-slate-400">仓库名称:</span>{' '}
                        <span className="font-bold text-slate-900">
                          {originHubInfo?.name || `${waybill.originWarehouse || '广州'} 集拼中心`}
                        </span>
                      </p>
                      <p>
                        <span className="text-slate-400">国内收件联系人:</span>{' '}
                        <span className="font-medium text-slate-800">
                          {originHubInfo?.contactName || '仓管收发部'} ({originHubInfo?.contactPhone || '138-0000-0000'})
                        </span>
                      </p>
                      <p>
                        <span className="text-slate-400">收货地址:</span>{' '}
                        <span className="font-medium text-slate-800">
                          {originHubInfo?.address || '广东省广州市白云区国际物流集拼仓'}
                        </span>
                      </p>
                    </div>
                  )}
                </div>

                {/* 右侧：海外收货与派送档案 */}
                <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-200/60 space-y-2 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      海外收货与派送地址 (Consignee)
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                      {waybill.destinationCountry || '目的国'}{waybill.orderType !== 'AIR' && waybill.destinationPort ? ` · ${waybill.destinationPort}` : (waybill.orderType === 'AIR' ? ' · 空运' : '')}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-slate-600">
                    <p>
                      <span className="text-slate-400">收件联系人:</span>{' '}
                      <span className="font-bold text-slate-900">
                        {waybill.overseasName || '未填写'}
                      </span>
                    </p>
                    <p>
                      <span className="text-slate-400">联系电话:</span>{' '}
                      <span className="font-mono font-bold text-emerald-800">
                        {waybill.overseasPhone || '未填写'}
                      </span>
                    </p>
                    {waybill.overseasCompany && (
                      <p>
                        <span className="text-slate-400">收件公司:</span>{' '}
                        <span className="text-slate-800">{waybill.overseasCompany}</span>
                      </p>
                    )}
                    <p>
                      <span className="text-slate-400">派送详细地址:</span>{' '}
                      <span className="font-medium text-slate-900 leading-relaxed">
                        {waybill.overseasAddress || '目的港自提 / 派送地址待补充'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

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
          {stages.map((st, idx) => {
            const isCompleted = idx <= currentStageIdx;

            return (
              <div
                key={st.key}
                onClick={() => handleStageCardClick(st.stageNum, idx)}
                className={`p-4 rounded-xl border transition-all relative group ${
                  isCompleted
                    ? 'bg-emerald-50/60 border-emerald-300 text-slate-800 hover:border-emerald-500 cursor-pointer shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-bold ${
                    isCompleted ? 'text-emerald-900' : 'text-slate-400'
                  }`}>
                    {st.label}
                  </span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  {st.desc}
                </p>

                {/* Subtext actions */}
                {isCompleted ? (
                  <span className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 group-hover:underline">
                    <Edit3 className="w-3 h-3" /> 点击查看/修改
                  </span>
                ) : (
                  <span className="mt-2.5 inline-block text-[10px] text-slate-400">
                    🔒 前置阶段未完成
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Next Step Stage Callout Banner (全页面唯一的生命阶段流转推进中心) */}
      {currentStageIdx < 5 && (
        <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] text-blue-300 uppercase tracking-wider font-semibold">
                当前待办流转推进指引
              </span>
              <h3 className="text-sm font-bold text-white mt-0.5">
                {stages[currentStageIdx + 1]?.label}：{stages[currentStageIdx + 1]?.desc}
              </h3>
            </div>
          </div>

          <button
            onClick={() => setActiveStageModal(currentStageIdx + 2)}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/30 flex items-center gap-2 transition-all shrink-0"
          >
            {stages[currentStageIdx]?.actionText || `推进至【${stages[currentStageIdx + 1]?.label}】`}
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
                  {waybill.orderType === 'SEA_FCL'
                    ? '整柜装箱明细与双轨数据对比'
                    : '货物实测明细与双轨数据对比'}
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {waybill.orderType === 'SEA_FCL'
                    ? '对照 阶段 1 客户委托预报 与 阶段 2 产地实际装箱 (Packing List)'
                    : '对照 阶段 1 客户初始预报快照 与 阶段 2 仓库实测核量'}
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
                  {waybill.orderType === 'SEA_FCL' ? '修改阶段2装箱数据' : '修改阶段2实测与单价'}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold">
                    <th className="py-2.5 px-3">#</th>
                    {waybill.orderType !== 'SEA_FCL' && <th className="py-2.5 px-3">送仓快递单号</th>}
                    <th className="py-2.5 px-3">品名</th>
                    <th className="py-2.5 px-3 text-center">
                      <div className="flex flex-col items-center">
                        <span>件数对比</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {waybill.orderType === 'SEA_FCL' ? '预报 ➔ 装箱' : '预报 ➔ 实测'}
                        </span>
                      </div>
                    </th>
                    {waybill.orderType !== 'SEA_FCL' && (
                      <th className="py-2.5 px-3 text-center">
                        <div className="flex flex-col items-center">
                          <span>尺寸 (L×W×H cm)</span>
                          <span className="text-[10px] text-slate-400 font-normal">预报 ➔ 实测</span>
                        </div>
                      </th>
                    )}
                    <th className="py-2.5 px-3 text-right">
                      <div className="flex flex-col items-end">
                        <span>{waybill.orderType === 'SEA_FCL' ? '装箱方数 (CBM)' : '核算体积 (m³)'}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {waybill.orderType === 'SEA_FCL' ? '预报 ➔ 实际装箱' : '预报 ➔ 实测 (偏差)'}
                        </span>
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-right">
                      <div className="flex flex-col items-end">
                        <span>{waybill.orderType === 'SEA_FCL' ? '实际总毛重 (kg)' : '单件重量 (kg)'}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {waybill.orderType === 'SEA_FCL' ? '预报 ➔ 实际毛重' : '预报 ➔ 实测'}
                        </span>
                      </div>
                    </th>
                    {waybill.orderType === 'SEA_FCL' && (
                      <th className="py-2.5 px-3 text-center">绑定集装箱货柜</th>
                    )}
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
                    const volDiffPct =
                      estVol !== null && actVol !== null && estVol > 0.00001
                        ? ((actVol - estVol) / estVol) * 100
                        : null;

                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-mono text-slate-400">{idx + 1}</td>
                        {waybill.orderType !== 'SEA_FCL' && (
                          <td className="py-3 px-3 font-mono text-slate-600">{item.trackingNumber || '-'}</td>
                        )}
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

                        {/* 尺寸对比 (拼箱/空运展示) */}
                        {waybill.orderType !== 'SEA_FCL' && (
                          <td className="py-3 px-3 text-center font-mono">
                            <div className="text-slate-400 text-[11px]">
                              预: {hasEstDim ? `${estL}×${estW}×${estH}` : '-'}
                            </div>
                            <div className="text-slate-900 font-bold text-xs mt-0.5">
                              实: {hasActDim ? `${actL}×${actW}×${actH}` : <span className="text-slate-400 font-normal italic">待实测</span>}
                            </div>
                          </td>
                        )}

                        {/* 体积/方数对比 */}
                        <td className="py-3 px-3 text-right font-mono">
                          <div className="text-slate-400 text-[11px]">
                            {estVol ? `${estVol.toFixed(4)} m³` : '-'}
                          </div>
                          <div className="text-indigo-700 font-bold text-xs mt-0.5">
                            {actVol ? `${actVol.toFixed(4)} m³` : <span className="text-slate-400 font-normal italic">{waybill.orderType === 'SEA_FCL' ? '待装箱' : '待实测'}</span>}
                          </div>
                          {volDiff !== null && Math.abs(volDiff) > 0.0001 && (
                            <div className={`text-[10px] font-semibold mt-0.5 ${volDiff > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {volDiff > 0 ? `+${volDiff.toFixed(4)}` : volDiff.toFixed(4)} m³
                              {volDiffPct !== null && isFinite(volDiffPct) ? ` (${volDiffPct > 0 ? `+${volDiffPct.toFixed(1)}%` : `${volDiffPct.toFixed(1)}%`})` : ''}
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

                        {/* 整柜模式：关联集装箱 */}
                        {waybill.orderType === 'SEA_FCL' && (
                          <td className="py-3 px-3 text-center">
                            {waybill.containerMaster ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-800 rounded-lg text-xs font-mono font-bold border border-blue-200">
                                🚢 {waybill.containerMaster.containerNo}
                                {waybill.containerMaster.containerType ? ` (${waybill.containerMaster.containerType})` : ''}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs italic">待装箱绑定 (1柜)</span>
                            )}
                          </td>
                        )}

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
                              {waybill.orderType === 'SEA_FCL' ? '装箱核准' : '实测正常'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px]">
                              {waybill.orderType === 'SEA_FCL' ? '待产地装箱' : '待到仓实测'}
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

          {/* Container & Logistics Info (Dynamic: Air vs Sea) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                {waybill.orderType === 'AIR' ? (
                  <>
                    <Truck className="w-5 h-5 text-purple-600" />
                    空运专线与发货出库数据
                  </>
                ) : (
                  <>
                    <Ship className="w-5 h-5 text-blue-600" />
                    集装箱与干线航运数据
                  </>
                )}
              </h2>
              <button
                onClick={() => setActiveStageModal(waybill.orderType === 'SEA_FCL' ? 2 : 3)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                {waybill.orderType === 'AIR'
                  ? waybill.expressNo ? '修改发货物流' : '安排仓库发货'
                  : waybill.orderType === 'SEA_FCL'
                  ? waybill.containerMaster ? '修改配载货柜' : '进行产地装箱'
                  : waybill.containerMaster ? '修改配载货柜' : '进行装柜配载'}
              </button>
            </div>

            {waybill.orderType === 'AIR' ? (
              waybill.expressNo || waybill.loadingDate ? (
                <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 font-bold">
                        ✈️
                      </div>
                      <div>
                        <h3 className="text-base font-bold font-mono text-purple-950 flex items-center gap-2">
                          {waybill.expressNo || '专线发货单号待补'}
                          <span className="px-2 py-0.5 bg-purple-200 text-purple-800 rounded text-[10px] font-sans font-bold">
                            空运专线
                          </span>
                        </h3>
                        <p className="text-xs text-purple-700">
                          承运服务商: {waybill.forwarderChannel || '未指定专线渠道'} | 状态: {waybill.status}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-purple-200/60">
                    <div>
                      <span className="text-purple-500">起运/目的地</span>
                      <p className="font-semibold text-purple-900">
                        {waybill.originWarehouse || '未指定'} ➔ {waybill.destinationCountry || '未指定'}
                      </p>
                    </div>
                    <div>
                      <span className="text-purple-500">发货运单号</span>
                      <p className="font-mono font-bold text-purple-950">
                        {waybill.expressNo || '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-purple-500">发货出库日期</span>
                      <p className="font-semibold text-purple-900">
                        {waybill.loadingDate
                          ? new Date(waybill.loadingDate).toISOString().slice(0, 10)
                          : <span className="text-slate-400 font-normal italic">待出库</span>}
                      </p>
                    </div>
                    <div>
                      <span className="text-purple-500">到达海外仓日期</span>
                      <p className="font-semibold text-purple-900">
                        {waybill.clearanceDate
                          ? new Date(waybill.clearanceDate).toISOString().slice(0, 10)
                          : <span className="text-slate-400 font-normal italic">在途中</span>}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center space-y-2">
                  <p className="text-xs text-slate-500">
                    该空运单尚未打包发货。等国内集拼仓打包交接给专线后即可录入发货运单号。
                  </p>
                  {currentStageIdx >= 1 && (
                    <button
                      onClick={() => setActiveStageModal(3)}
                      className="px-3.5 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-semibold hover:bg-purple-100"
                    >
                      安排仓库发货 ➔
                    </button>
                  )}
                </div>
              )
            ) : waybill.containerMaster ? (
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ContainerIcon className="w-6 h-6 text-indigo-700" />
                    <div>
                      <h3 className="text-base font-bold font-mono text-indigo-950">
                        {waybill.containerMaster.containerNo}
                      </h3>
                      <p className="text-xs text-indigo-700">
                        类型: {waybill.containerMaster.containerType || '--'} | 状态: {waybill.containerMaster.status}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      navigate(
                        `/v2/containers?search=${encodeURIComponent(waybill.containerMaster?.containerNo || '')}`
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
                      {waybill.containerMaster.sailingDate
                        ? new Date(waybill.containerMaster.sailingDate).toISOString().slice(0, 10)
                        : '-'} ➔ {waybill.containerMaster.eta
                        ? new Date(waybill.containerMaster.eta).toISOString().slice(0, 10)
                        : '-'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center space-y-2">
                <p className="text-xs text-slate-500">
                  该运单暂未分配集装箱柜号。等仓库现场装箱后即可在此绑定货柜。
                </p>
                {currentStageIdx >= 1 && (
                  <button
                    onClick={() => setActiveStageModal(waybill.orderType === 'SEA_FCL' ? 2 : 3)}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100"
                  >
                    {waybill.orderType === 'SEA_FCL' ? '进行产地装箱与配载 ➔' : '安排装柜配载 ➔'}
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                {(waybill.attachments || []).map((att, idx) => {
                  const isImg = /\.(jpg|jpeg|png|webp|gif|bmp)(\?.*)?$/i.test(att.fileUrl) || att.fileUrl.startsWith('data:image');
                  const isPdf = /\.pdf(\?.*)?$/i.test(att.fileUrl);

                  const typeLabelMap: Record<string, string> = {
                    PICKUP_SCREENSHOT: '叫车/提货截图',
                    WAREHOUSE_IMAGE: '到仓实物图',
                    CUSTOMS_SLIP: '缴税放行水单',
                    SIGN_IMAGE: '签字签收回执',
                    OTHER: '其他单证',
                  };

                  return (
                    <div
                      key={att.id || idx}
                      className="group relative bg-white border border-slate-200 hover:border-blue-400 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition duration-200 flex flex-col"
                    >
                      {/* Image / Document Preview Thumbnail Area */}
                      <div
                        onClick={() => {
                          if (isImg) {
                            setPreviewImageUrl(att.fileUrl);
                          } else {
                            window.open(att.fileUrl, '_blank');
                          }
                        }}
                        className="h-28 bg-slate-100 relative cursor-pointer overflow-hidden flex items-center justify-center"
                      >
                        {isImg ? (
                          <img
                            src={att.fileUrl}
                            alt={att.fileName || '凭证图片'}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                            onError={(e: any) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : isPdf ? (
                          <div className="flex flex-col items-center justify-center text-rose-600 gap-1">
                            <span className="px-2 py-1 bg-rose-100 rounded font-bold text-xs">PDF</span>
                            <span className="text-[10px] text-slate-500 font-medium">点击打开文档</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-blue-600 gap-1">
                            <Paperclip className="w-6 h-6" />
                            <span className="text-[10px] text-slate-500 font-medium">点击打开文件</span>
                          </div>
                        )}

                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs gap-1.5 font-semibold backdrop-blur-xs">
                          <Eye className="w-4 h-4" />
                          {isImg ? '查看大图' : '查看原件'}
                        </div>
                      </div>

                      {/* Info & Action Footer */}
                      <div className="p-2.5 bg-white flex flex-col justify-between flex-1 border-t border-slate-100">
                        <div className="flex items-center justify-between gap-1">
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/60 rounded text-[10px] font-bold truncate max-w-[120px]">
                            {typeLabelMap[att.attachmentType] || att.attachmentType}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAttachment(att.id);
                            }}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                            title="删除单证附件"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <p className="text-xs font-semibold text-slate-800 mt-1.5 truncate" title={att.fileName || ''}>
                          {att.fileName || '单据凭证'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: 财务收支看板 */}
        <div className="space-y-6">
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                财务收支与毛利看板
              </h2>
              {waybill.isFixedPrice ? (
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[10px] font-semibold">
                  包干一口价
                </span>
              ) : currentStageIdx === 0 ? (
                <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded text-[10px] font-semibold">
                  预估参考 (待实测)
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-semibold">
                  实测核量结算
                </span>
              )}
            </div>

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
                        className="text-slate-500 hover:text-rose-400"
                      >
                        ×
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
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={userMark}
                        onChange={(e) => setUserMark(e.target.value)}
                        className="w-full pl-3 pr-7 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-blue-900 focus:ring-2 focus:ring-blue-500"
                      />
                      {userMark && (
                        <button
                          type="button"
                          onClick={() => setUserMark('')}
                          className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                          title="清空唛头"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {waybill?.orderType === 'SEA_FCL' ? '国内起运港口' : '起运仓 / 集货点'} <span className="text-red-500">*</span>
                    </label>
                    {waybill?.orderType === 'SEA_FCL' ? (
                      <select
                        value={originWarehouse}
                        onChange={(e) => setOriginWarehouse(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                      >
                        <option value="">-- 请选择国内起运港口 --</option>
                        {ORIGIN_PORTS.map((port) => (
                          <option key={port} value={port}>
                            {port}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={originWarehouse}
                        onChange={(e) => setOriginWarehouse(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                      >
                        <option value="">-- 请选择起运仓 --</option>
                        {originWarehouses.length > 0 ? (
                          originWarehouses.map((w) => (
                            <option key={w.id} value={w.shortName || w.name}>
                              {w.name} {w.isDefault ? '⭐ [默认]' : ''}
                            </option>
                          ))
                        ) : (
                          ORIGIN_WAREHOUSES.map((w) => (
                            <option key={w.value} value={w.value}>
                              {w.label}
                            </option>
                          ))
                        )}
                        {originWarehouse &&
                          !originWarehouses.some((w) => w.shortName === originWarehouse || w.name === originWarehouse) &&
                          !ORIGIN_WAREHOUSES.some((w) => w.value === originWarehouse) && (
                            <option value={originWarehouse}>{originWarehouse} (自定义起运点)</option>
                          )}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {waybill?.orderType === 'AIR' ? '目的国家 (终点国)' : '目的国与港口'}
                    </label>
                    {waybill?.orderType === 'AIR' ? (
                      <select
                        value={destinationCountry}
                        onChange={(e) => {
                          const country = e.target.value;
                          setDestinationCountry(country);
                          setDestinationPort('');
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                      >
                        <option value="">-- 请选择目的国 --</option>
                        {DESTINATION_COUNTRIES.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name} ({c.enName})
                          </option>
                        ))}
                      </select>
                    ) : (
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
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      承运渠道 / 服务商
                    </label>
                    <select
                      value={forwarderChannel}
                      onChange={(e) => setForwarderChannel(e.target.value)}
                      className="w-full px-3 py-2 bg-blue-50/40 border border-blue-300 rounded-lg text-xs font-bold text-slate-900 focus:bg-white"
                    >
                      <option value="">
                        {waybill?.orderType === 'AIR'
                          ? '-- 请选择空运承运专线 --'
                          : waybill?.orderType === 'SEA_FCL'
                          ? '-- 请选择整柜订舱渠道 --'
                          : '-- 请选择散货拼箱承运渠道 --'}
                      </option>
                      {channels
                        .filter((c) => {
                          if (waybill?.orderType === 'SEA_LCL') return c.category === 'SEA_LCL';
                          if (waybill?.orderType === 'AIR') return c.category === 'AIR';
                          if (waybill?.orderType === 'SEA_FCL') return c.category === 'FCL_BOOKING';
                          return true;
                        })
                        .map((ch) => (
                          <option key={ch.id} value={ch.name}>
                            {ch.name} {ch.code ? `(${ch.code})` : ''} {ch.isDefault ? '⭐ [默认]' : ''}
                          </option>
                        ))}
                      {forwarderChannel && !channels.some((c) => c.name === forwarderChannel) && (
                        <option value={forwarderChannel}>
                          {forwarderChannel} (自定义/历史渠道)
                        </option>
                      )}
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

              {/* 海外收件人与派送信息 (预报快照维护) */}
              <div className="p-4 bg-emerald-50/40 border border-emerald-200/70 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    海外收件人与{waybill?.orderType === 'AIR' ? '目的国' : '目的港'}派送档案 (预报快照)
                  </h3>
                  <span className="text-[11px] text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md font-semibold">
                    末端派件核对凭证
                  </span>
                </div>

                {/* 客户地址簿快捷选择 */}
                {waybill.customer?.addresses && waybill.customer.addresses.length > 0 && (() => {
                  const filteredAddrs = waybill.customer.addresses.filter((a) => {
                    if (!destinationCountry) return true;
                    if (waybill?.orderType === 'AIR') return !a.country || a.country === destinationCountry;
                    const matchCountry = !a.country || a.country === destinationCountry;
                    const matchPort = !destinationPort || !a.region || a.region === destinationPort;
                    return matchCountry && matchPort;
                  });

                  return (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white p-2 rounded-lg border border-emerald-200 text-xs">
                      <span className="font-bold text-emerald-800 shrink-0">
                        从【{waybill.customer.clientCode}】地址簿带入:
                      </span>
                      <select
                        onChange={(e) => {
                          const addrId = e.target.value;
                          const target = waybill.customer?.addresses?.find((a) => a.id === addrId);
                          if (target) {
                            setStage1OverseasName(target.name || '');
                            setStage1OverseasPhone(target.phone || '');
                            setStage1OverseasCompany(target.company || '');
                            setStage1OverseasAddress(target.address || '');
                            toast.success(`已带入【${target.name}】的收件档案`);
                          }
                        }}
                        className="flex-1 px-2.5 py-1.5 bg-emerald-50/50 border border-emerald-300 rounded-md font-medium text-slate-800"
                      >
                        <option value="">-- 点击选择客户名下的已登记收件人 ({filteredAddrs.length}个) --</option>
                        {filteredAddrs.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.phone}) - {a.address ? a.address.slice(0, 35) : ''}... {a.isDefault ? '⭐[默认]' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })()}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      海外收件人姓名
                    </label>
                    <input
                      type="text"
                      placeholder="如 Alex Johnson / 目的港联系人"
                      value={stage1OverseasName}
                      onChange={(e) => setStage1OverseasName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      海外联系电话 / WhatsApp
                    </label>
                    <input
                      type="text"
                      placeholder="如 +63 917 123 4567"
                      value={stage1OverseasPhone}
                      onChange={(e) => setStage1OverseasPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      海外收件公司 (选填)
                    </label>
                    <input
                      type="text"
                      placeholder="如 Manila Trade Logistics"
                      value={stage1OverseasCompany}
                      onChange={(e) => setStage1OverseasCompany(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    目的港详细派送 / 送货地址
                  </label>
                  <input
                    type="text"
                    placeholder="如 Unit 802, BGC Tower, Taguig City, Metro Manila"
                    value={stage1OverseasAddress}
                    onChange={(e) => setStage1OverseasAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                  />
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
                            <td className="py-2 px-2 bg-blue-50/40">
                              <input
                                type="number"
                                step="0.0001"
                                placeholder={vol > 0 ? vol.toFixed(4) : "方数 m³"}
                                value={item.estimatedVolume !== undefined && item.estimatedVolume !== null ? item.estimatedVolume : (vol > 0 ? Number(vol.toFixed(4)) : '')}
                                onChange={(e) => updateStage1Item(idx, 'estimatedVolume', e.target.value ? Number(e.target.value) : undefined)}
                                className="w-full px-1.5 py-1 bg-white border border-blue-200 rounded text-center text-xs font-mono font-bold text-blue-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                title="直接手填预估方数(CBM)，或输入长宽高自动计算"
                              />
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
      {/* 阶段 2 模态框：到仓实测 (拼箱/空运) / 产地装箱 (整柜) */}
      {/* ========================================================= */}
      {activeStageModal === 2 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                  waybill.orderType === 'SEA_FCL' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
                }`}>
                  阶段 2 操作
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-1">
                  {waybill.orderType === 'SEA_FCL'
                    ? '产地装箱：工厂现场装货与集装箱录入'
                    : waybill.orderType === 'AIR'
                    ? '包裹到仓：过磅实测重量与计费核算'
                    : '包裹到仓：实测长宽高、单重与核算计费'}
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {waybill.orderType === 'SEA_FCL'
                    ? '货车司机提空箱前往工厂现场装箱，记录出货装箱时间、录入集装箱柜号与装箱货物清单。'
                    : waybill.orderType === 'AIR'
                    ? '输入现场过磅实测毛重(kg)与单价车费，系统自动核算总运费。'
                    : '输入仓库现场实测数据。支持参考客户初始预报值，若无偏差可点击右上角一键快速带入。'}
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
              {waybill.orderType === 'SEA_FCL' ? (
                /* 海运整柜产地装箱专用表单 */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        工厂出货/装箱日期 <span className="text-red-500">*</span>
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
                        海关封条号 (Seal No. 选填)
                      </label>
                      <input
                        type="text"
                        placeholder="如 ML-889021 或 WH-0912"
                        value={expressNo}
                        onChange={(e) => setExpressNo(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                        📦 集装箱柜号绑定 (产地直接录入)
                      </span>
                      <div className="flex items-center gap-2">
                        {waybill.containerMaster && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[11px] font-bold">
                            已绑定: {waybill.containerMaster.containerNo}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setQuickOriginPort(waybill.originWarehouse || '');
                            setQuickDestinationPort(waybill.destinationPort || '');
                            setShowQuickContainerModal(true);
                          }}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1 transition-all"
                        >
                          ➕ 快速新建货柜
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        选择已有集装箱 (或点击右上角新建)
                      </label>
                      <select
                        value={selectedContainerId}
                        onChange={(e) => {
                          setSelectedContainerId(e.target.value);
                          if (e.target.value) setNewContainerNo('');
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- 选择现有集装箱 --</option>
                        {containers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.containerNo} {c.containerType ? `(${c.containerType})` : ''} ({c.originPort || '起运港'} ➔ {c.destinationPort || '目的港'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                /* 散货拼箱与空运表单 */
                <div className={waybill.orderType === 'AIR' ? 'max-w-xs' : 'grid grid-cols-1 sm:grid-cols-2 gap-4'}>
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

                  {waybill.orderType !== 'AIR' && (
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
                  )}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    {waybill.orderType === 'SEA_FCL'
                      ? '产地实际装箱清单 (Actual Packing List)'
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
                        <th className="py-2.5 px-3">
                          {waybill.orderType === 'SEA_FCL' ? '品名与委托预报快照' : '品名与预报基准'}
                        </th>
                        <th className="py-2.5 px-2 w-24 text-center">
                          {waybill.orderType === 'SEA_FCL' ? '实际装箱件数' : '实收/装箱件数'}
                        </th>
                        {waybill.orderType === 'SEA_FCL' ? (
                          <>
                            <th className="py-2.5 px-3 w-32 text-center bg-indigo-50/50 text-indigo-900 font-bold">
                              实际装箱方数 (CBM)
                            </th>
                            <th className="py-2.5 px-3 w-32 text-center">实际总毛重/VGM (kg)</th>
                          </>
                        ) : (
                          <>
                            <th className="py-2.5 px-2 w-20 text-center">实测长(cm)</th>
                            <th className="py-2.5 px-2 w-20 text-center">实测宽(cm)</th>
                            <th className="py-2.5 px-2 w-20 text-center">实测高(cm)</th>
                            <th className="py-2.5 px-2 w-24 text-center">单重/总重(kg)</th>
                            <th className="py-2.5 px-3 w-28 text-right bg-indigo-50/50">核算体积</th>
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
                        const vol = l && w && h ? (l * w * h * qty) / 1_000_000 : (item.payableVolume ? Number(item.payableVolume) : 0);

                        const estQty = item.estimatedQuantity ?? qty;
                        const estDim = item.estimatedLength && item.estimatedWidth && item.estimatedHeight ? `${item.estimatedLength}×${item.estimatedWidth}×${item.estimatedHeight}cm` : null;
                        const estVolStr = item.estimatedVolume ? `${Number(item.estimatedVolume).toFixed(3)} m³` : null;

                        return (
                          <tr key={item.id || idx}>
                            <td className="py-2 px-3">
                              <div className="font-bold text-slate-900">{item.productName}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                预报: {estQty}件 {estDim ? `| ${estDim}` : ''} {estVolStr ? `| ${estVolStr}` : ''} {item.estimatedWeight ? `| ${item.estimatedWeight}kg` : ''}
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
                            {waybill.orderType === 'SEA_FCL' ? (
                              <>
                                <td className="py-2 px-2 bg-indigo-50/30">
                                  <input
                                    type="number"
                                    step="0.0001"
                                    placeholder={item.estimatedVolume ? `预报 ${Number(item.estimatedVolume).toFixed(3)}` : '装箱方数 CBM'}
                                    value={item.payableVolume !== undefined && item.payableVolume !== null && String(item.payableVolume).trim() !== '' ? item.payableVolume : ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditableItems((prev) =>
                                        prev.map((it, i) => (i === idx ? { ...it, payableVolume: val } : it))
                                      );
                                    }}
                                    className="w-full px-2 py-1 bg-white border border-indigo-200 rounded text-center text-xs font-mono font-bold text-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <input
                                    type="number"
                                    step="0.1"
                                    placeholder="总毛重 kg"
                                    value={item.unitWeight || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditableItems((prev) =>
                                        prev.map((it, i) => (i === idx ? { ...it, unitWeight: val } : it))
                                      );
                                    }}
                                    className="w-full px-2 py-1 bg-slate-50 border rounded text-center text-xs font-mono"
                                  />
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-2 px-2">
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={item.length || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditableItems((prev) =>
                                        prev.map((it, i) => {
                                          if (i !== idx) return it;
                                          const up = { ...it, length: val };
                                          if (val && up.width && up.height) {
                                            up.payableVolume = ((Number(val) * Number(up.width) * Number(up.height) * (Number(up.quantity) || 1)) / 1_000_000).toFixed(4);
                                          }
                                          return up;
                                        })
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
                                        prev.map((it, i) => {
                                          if (i !== idx) return it;
                                          const up = { ...it, width: val };
                                          if (up.length && val && up.height) {
                                            up.payableVolume = ((Number(up.length) * Number(val) * Number(up.height) * (Number(up.quantity) || 1)) / 1_000_000).toFixed(4);
                                          }
                                          return up;
                                        })
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
                                        prev.map((it, i) => {
                                          if (i !== idx) return it;
                                          const up = { ...it, height: val };
                                          if (up.length && up.width && val) {
                                            up.payableVolume = ((Number(up.length) * Number(up.width) * Number(val) * (Number(up.quantity) || 1)) / 1_000_000).toFixed(4);
                                          }
                                          return up;
                                        })
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
                                <td className="py-2 px-2 bg-indigo-50/40">
                                  <input
                                    type="number"
                                    step="0.0001"
                                    placeholder={vol > 0 ? Number(vol).toFixed(4) : "方数 m³"}
                                    value={item.payableVolume !== undefined && item.payableVolume !== null ? item.payableVolume : (vol > 0 ? Number(vol.toFixed(4)) : '')}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditableItems((prev) =>
                                        prev.map((it, i) => (i === idx ? { ...it, payableVolume: val } : it))
                                      );
                                    }}
                                    className="w-full px-1.5 py-1 bg-white border border-indigo-200 rounded text-center text-xs font-mono font-bold text-indigo-900"
                                    title="直接手填方数(CBM)，或输入长宽高自动计算"
                                  />
                                </td>
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
                  回退状态至【{stages[1]?.label}】
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
                    保存修改 (保持当前阶段)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStage2Submit(true)}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md"
                  >
                    {waybill.orderType === 'SEA_FCL'
                      ? '确认产地装箱并流转为【产地装箱 (INBOUND)】'
                      : '保存实测数据并流转为【已入库 (INBOUND)】'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 阶段 3 模态框：人工排柜装箱 (拼箱) / 进港报关 (整柜) / 仓库发货 (空运) */}
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
                  {waybill.orderType === 'SEA_FCL'
                    ? '进港报关：重柜集港与海关报关放行'
                    : waybill.orderType === 'AIR'
                    ? '仓库发货：打包出库并交接专线渠道'
                    : '人工排柜：指定装载集装箱货柜'}
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {waybill.orderType === 'SEA_FCL'
                    ? '拖车将重柜送达港口码头堆场（Gate-in），完成国内海关出口报关放行。'
                    : waybill.orderType === 'AIR'
                    ? '录入发货出库日期、专线渠道及发货运单号（必填）。无需录入航班号。'
                    : '指定本批散货装入的物理集装箱柜号。'}
                </p>
              </div>
              <button
                onClick={() => setActiveStageModal(null)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {waybill.orderType === 'SEA_FCL' ? (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
                  <span className="text-xs font-bold text-blue-900 block">
                    🚢 整柜集港与报关信息核对
                  </span>
                  <div className="text-xs text-slate-700 space-y-1 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">集装箱柜号:</span>
                      <span className="font-bold text-blue-950">{waybill.containerMaster?.containerNo || newContainerNo || '产地装箱待绑定'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">国内起运港:</span>
                      <span className="font-bold">{waybill.originWarehouse || '--'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">目的港口:</span>
                      <span className="font-bold">{waybill.destinationPort || '--'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    码头还重/进港日期
                  </label>
                  <input
                    type="date"
                    value={loadingDate}
                    onChange={(e) => setLoadingDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium"
                  />
                </div>
              </div>
            ) : waybill.orderType === 'AIR' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    发货出库日期
                  </label>
                  <input
                    type="date"
                    value={loadingDate}
                    onChange={(e) => setLoadingDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    承运专线渠道 / 合作服务商
                  </label>
                  <select
                    value={forwarderChannel}
                    onChange={(e) => setForwarderChannel(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- 请选择空运承运专线 --</option>
                    {channels
                      .filter((c) => c.category === 'AIR')
                      .map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name} {c.code ? `(${c.code})` : ''} {c.isDefault ? '⭐ [默认]' : ''}
                        </option>
                      ))}
                    {forwarderChannel && !channels.some((c) => c.name === forwarderChannel) && (
                      <option value={forwarderChannel}>
                        {forwarderChannel} (自定义/历史渠道)
                      </option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    发货运单号 / 专线转运单号 <span className="text-red-500 font-bold">* (必填)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="如 FLY100002162 或 AWB91041985"
                    value={expressNo}
                    onChange={(e) => setExpressNo(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 bg-blue-50/50 border border-blue-300 rounded-lg text-xs font-mono font-bold text-blue-950 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    💡 仓库打包发货交接给专线后出具的运单号/提单号，用于海外到货与客户查询。
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    发货出库备注 (选填)
                  </label>
                  <input
                    type="text"
                    placeholder="如：已打包交接专线夜班车发往机场"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      选择集装箱货柜
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickOriginPort(waybill.originWarehouse || '');
                        setQuickDestinationPort(waybill.destinationPort || '');
                        setShowQuickContainerModal(true);
                      }}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1 transition-all"
                    >
                      ➕ 快速新建货柜
                    </button>
                  </div>
                  <select
                    value={selectedContainerId}
                    onChange={(e) => setSelectedContainerId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- 选择现有集装箱 (或点击右上角新建) --</option>
                    {containers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.containerNo} ({c.originPort || '起运港'} ➔ {c.destinationPort || '目的港'}) - {c.status}
                      </option>
                    ))}
                  </select>
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
            )}

            <div className="flex items-center justify-between pt-3 border-t">
              {currentStageIdx > 2 ? (
                <button
                  type="button"
                  onClick={() => handleRollback(2)}
                  className="px-3.5 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  回退状态至【{stages[2]?.label}】
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
                    {waybill.orderType === 'SEA_FCL'
                      ? '确认进港报关并流转为【进港报关 (LOADED)】'
                      : waybill.orderType === 'AIR'
                      ? '确认发货并流转为【已发货 (LOADED)】'
                      : '确认装柜并流转为【已装柜 (LOADED)】'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 阶段 4 模态框：干线启运在途 (海运) / 到海外仓 (空运) */}
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
                  {waybill.orderType === 'AIR'
                    ? '到海外仓：专线空运与双清到港入库'
                    : '干线启运：记录开船/起飞与海运提单'}
                </h2>
              </div>
              <button
                onClick={() => setActiveStageModal(null)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {waybill.orderType === 'AIR' ? (
              <div className="space-y-4">
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-1 text-xs">
                  <div className="flex items-center justify-between text-purple-900 font-bold">
                    <span>✈️ 专线空运干线发运状态</span>
                    <span className="font-mono">{waybill.forwarderChannel || '空运专线'}</span>
                  </div>
                  <p className="text-purple-700">
                    发货运单号: <span className="font-mono font-bold">{waybill.expressNo || expressNo || '未录入'}</span>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    到达海外仓日期 (到港清关入库)
                  </label>
                  <input
                    type="date"
                    value={clearanceDate}
                    onChange={(e) => setClearanceDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    💡 专线完成空运航程与口岸双清放行，货物进入目的国海外中转分拨仓的日期。
                  </p>
                </div>
              </div>
            ) : (
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
            )}

            <div className="flex items-center justify-between pt-3 border-t">
              {currentStageIdx > 3 ? (
                <button
                  type="button"
                  onClick={() => handleRollback(3)}
                  className="px-3.5 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  回退状态至【{stages[3]?.label}】
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
                    {waybill.orderType === 'AIR'
                      ? '确认到仓并流转为【到海外仓 (IN_TRANSIT)】'
                      : '确认启运并流转为【在途中 (IN_TRANSIT)】'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 阶段 5 模态框：目的港清关放行 (海运) / 海外派送 (空运) */}
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
                  {waybill.orderType === 'AIR'
                    ? '海外派送：海外仓出库安排末端配送'
                    : '目的港清关：海关放行与上传税单水单'}
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
              {/* 核对海外收件人与派送地址 */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-emerald-900 font-bold">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    核对末端海外收件人与派送指引
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-bold">
                    {waybill.destinationCountry} · {waybill.destinationPort || '目的港'}
                  </span>
                </div>
                <p className="text-slate-700">
                  <span className="text-slate-400">收件人:</span>{' '}
                  <span className="font-bold text-slate-900">{waybill.overseasName || '未填写'}</span>
                  {waybill.overseasPhone && (
                    <span className="font-mono text-emerald-800 ml-2 font-bold">({waybill.overseasPhone})</span>
                  )}
                </p>
                <p className="text-slate-600 leading-relaxed">
                  <span className="text-slate-400">派送地址:</span>{' '}
                  <span className="font-medium text-slate-800">{waybill.overseasAddress || '目的港自提 / 派件地址待补充'}</span>
                </p>
              </div>

              {waybill.orderType === 'AIR' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    末端派送备注 / 司机联系方式 / 本地快递单号 (选填)
                  </label>
                  <input
                    type="text"
                    placeholder="如：已安排本地司机 Juan 派送 (0912-3456789) 或 J&T 派送"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              ) : (
                <>
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

                  {/* 目的港送柜拖车信息 (海关提柜 ➔ 目的地仓库) */}
                  <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                      <div className="flex items-center gap-1.5 text-blue-900 font-bold text-xs">
                        <Truck className="w-4 h-4 text-blue-600" />
                        目的港送柜拖车信息 (海关提柜 ➔ 目的仓)
                        <span className="text-red-500">*</span>
                      </div>
                      {hasInheritedTrucking && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                          ✅ 已继承本柜拖车数据
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          司机姓名 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="如：Kuya Juan / 张师傅"
                          value={truckDriverName}
                          onChange={(e) => setTruckDriverName(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          联系电话 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="如：0917-888-9999 / 13800000000"
                          value={truckDriverPhone}
                          onChange={(e) => setTruckDriverPhone(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          车牌号码 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="如：NBD-8821 / 闽C-89821"
                          value={truckPlateNo}
                          onChange={(e) => setTruckPlateNo(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          订车/提柜时间 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={truckingDate}
                          onChange={(e) => setTruckingDate(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          送达仓库时间 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={destArrivedDate}
                          onChange={(e) => setDestArrivedDate(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              {currentStageIdx > 4 ? (
                <button
                  type="button"
                  onClick={() => handleRollback(4)}
                  className="px-3.5 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  回退状态至【{stages[4]?.label}】
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
                    {waybill.orderType === 'AIR'
                      ? '确认安排派送并流转为【海外派送中 (DISPATCHING)】'
                      : '确认放行并流转为【海外拆派中】'}
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
      {/* 附加单据凭证模态框 (支持多图批量上传) */}
      {/* ========================================================= */}
      {showAttachModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Paperclip className="w-5 h-5 text-blue-600" />
                批量追加单证与凭证附件
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowAttachModal(false);
                  setAttachFiles([]);
                }}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddAttachment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">凭证分类</label>
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
                label="选择本地附件单据（支持多选）"
                multiple={true}
                multipleFiles={attachFiles}
                onMultipleChange={setAttachFiles}
                accept="image/*,application/pdf,.xlsx,.xls,.docx,.doc"
                helperText="支持按住 Ctrl / Shift 批量选择多张照片、PDF或直接批量拖拽至此"
              />

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAttachModal(false);
                    setAttachFiles([]);
                  }}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={attachFiles.length === 0}
                  className={`px-5 py-2.5 text-white rounded-xl text-xs font-bold shadow-md transition ${
                    attachFiles.length > 0
                      ? 'bg-blue-600 hover:bg-blue-500 cursor-pointer'
                      : 'bg-slate-400 cursor-not-allowed'
                  }`}
                >
                  确认上传 {attachFiles.length > 0 && `(${attachFiles.length} 个)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 独立修改海外收件人与派件信息模态框 (随时在途更新) */}
      {/* ========================================================= */}
      {showOverseasEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900">
                  修改海外收货人与目的港派送档案
                </h2>
              </div>
              <button
                onClick={() => setShowOverseasEditModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              运单在全生命周期流转期间均支持纠偏与变更收件人或派送地址，保存后将即时更新并作为末端派件指引。
            </p>

            <form onSubmit={handleSaveOverseasConsignee} className="space-y-3.5 text-xs">
              {/* 从客户地址簿快捷选择 */}
              {waybill.customer?.addresses && waybill.customer.addresses.length > 0 && (
                <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1 text-xs">
                  <label className="block font-bold text-emerald-800">
                    从【{waybill.customer.clientCode}】的海外收件人地址簿快捷带入:
                  </label>
                  <select
                    onChange={(e) => {
                      const addrId = e.target.value;
                      const target = waybill.customer?.addresses?.find((a) => a.id === addrId);
                      if (target) {
                        setEditOverseasName(target.name || '');
                        setEditOverseasPhone(target.phone || '');
                        setEditOverseasCompany(target.company || '');
                        setEditOverseasRegion(target.country || target.region || '');
                        setEditOverseasAddress(target.address || '');
                        toast.success(`已快速切换为【${target.name}】的收件地址`);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg font-medium text-slate-800"
                  >
                    <option value="">-- 点击快速选取历史收件人档案 ({waybill.customer.addresses.length}个) --</option>
                    {waybill.customer.addresses.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.phone}) - {a.address ? a.address.slice(0, 35) : ''}... {a.isDefault ? '⭐[默认]' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    海外收件人姓名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="如 Alex Johnson"
                    value={editOverseasName}
                    onChange={(e) => setEditOverseasName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    海外联系电话 / WhatsApp <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="如 +63 917 123 4567"
                    value={editOverseasPhone}
                    onChange={(e) => setEditOverseasPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-medium"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    海外收件公司 (选填)
                  </label>
                  <input
                    type="text"
                    placeholder="如 Manila Import & Trading"
                    value={editOverseasCompany}
                    onChange={(e) => setEditOverseasCompany(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    目的国家 / 城市地区
                  </label>
                  <input
                    type="text"
                    placeholder="如 菲律宾 · 马尼拉"
                    value={editOverseasRegion}
                    onChange={(e) => setEditOverseasRegion(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  目的港详细派送送货地址 <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="如 Unit 802, BGC High Street, Bonifacio Global City, Taguig, Metro Manila"
                  value={editOverseasAddress}
                  onChange={(e) => setEditOverseasAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium leading-relaxed"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowOverseasEditModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={savingOverseas}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingOverseas ? '正在保存...' : '确认更新海外收件人'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 快速新建集装箱小弹窗 (Stage 2 产地装箱内嵌) */}
      {/* ========================================================= */}
      {showQuickContainerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[11px] font-bold">
                  集装箱快速建档
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  ➕ 快速新建物理集装箱
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickContainerModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickCreateContainer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  集装箱柜号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="如 MILU6019768 或 广62柜"
                  value={quickContainerNo}
                  onChange={(e) => setQuickContainerNo(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 uppercase focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    箱型规格
                  </label>
                  <select
                    value={quickContainerType}
                    onChange={(e) => setQuickContainerType(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                  >
                    <option value="40HQ">40HQ (高柜)</option>
                    <option value="20GP">20GP (小柜)</option>
                    <option value="45HQ">45HQ (超高柜)</option>
                    <option value="40GP">40GP (平柜)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    海运提单号 (选填)
                  </label>
                  <input
                    type="text"
                    placeholder="如 MCLPXMN082208"
                    value={quickBlNumber}
                    onChange={(e) => setQuickBlNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    国内起运港口
                  </label>
                  <select
                    value={quickOriginPort}
                    onChange={(e) => setQuickOriginPort(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- 请选择起运港口 --</option>
                    {ORIGIN_PORTS.map((port) => (
                      <option key={port} value={port}>
                        {port}
                      </option>
                    ))}
                    {quickOriginPort && !ORIGIN_PORTS.includes(quickOriginPort) && (
                      <option value={quickOriginPort}>{quickOriginPort} (自定义)</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    目的港口
                  </label>
                  <select
                    value={quickDestinationPort}
                    onChange={(e) => setQuickDestinationPort(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- 请选择目的港口 --</option>
                    {DESTINATION_COUNTRIES.map((c) => (
                      <optgroup key={c.name} label={`${c.name} (${c.enName})`}>
                        {c.ports.map((port) => (
                          <option key={port} value={port}>
                            {port}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    {quickDestinationPort && !DESTINATION_COUNTRIES.some((c) => c.ports.includes(quickDestinationPort)) && (
                      <option value={quickDestinationPort}>{quickDestinationPort} (自定义)</option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  订柜成本 (选填，单位: 人民币 CNY)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="如 8500.00"
                  value={quickBookingCost}
                  onChange={(e) => setQuickBookingCost(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  💡 将自动记录为该货柜的「订柜费用 (BOOKING_FEE)」，可在货柜详情中查看与修改。
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowQuickContainerModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isCreatingContainer}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20"
                >
                  {isCreatingContainer ? '创建中...' : '确认创建并自动选中'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 全屏单证/凭证图片大图预览 Lightbox 模态框 */}
      {/* ========================================================= */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-transparent rounded-2xl overflow-hidden flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImageUrl}
              alt="单证大图预览"
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl border border-white/10"
            />

            <div className="flex items-center gap-3 mt-3">
              <a
                href={previewImageUrl}
                target="_blank"
                rel="noreferrer"
                download
                className="px-3.5 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg text-xs font-medium backdrop-blur-md flex items-center gap-1.5 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                新窗口查看原图
              </a>
              <button
                type="button"
                onClick={() => setPreviewImageUrl(null)}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition shadow-md"
              >
                关闭预览
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
