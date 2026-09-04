import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Ship,
  Plane,
  Container,
  Plus,
  Trash2,
  CheckCircle2,
  PackageCheck,
  ArrowRight,
  UserCheck,
  MapPin,
  FileText,
  DollarSign,
  Info,
  Copy,
  Check,
  FileSpreadsheet,
  Users,
  X,
  RefreshCw,
} from 'lucide-react';
import { BatchImportModal } from '../../components/v2/BatchImportModal';
import {
  customerV2Api,
  waybillV2Api,
  channelV2Api,
  originWarehouseV2Api,
  financeV2Api,
  type Customer,
  type CustomerAddress,
  type ShipmentType,
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

interface CargoItemRow {
  id: string;
  trackingNumber: string;
  productName: string;
  quantity: number | '';
  length?: number | '';
  width?: number | '';
  height?: number | '';
  volume?: number | '';
  unitWeight?: number | '';
  receivableCurrency: CurrencyType;
  receivableUnitPrice?: number | '';
  payableCurrency: CurrencyType;
  payableUnitPrice?: number | '';
}

interface FeeItemRow {
  id: string;
  feeName: string;
  feeDirection: 'RECEIVABLE' | 'PAYABLE';
  amount: number | '';
  currency: CurrencyType;
  note?: string;
}

export default function InboundWorkbench() {
  const navigate = useNavigate();

  // Mode: SEA_LCL | AIR | SEA_FCL
  const [orderType, setOrderType] = useState<ShipmentType>('SEA_LCL');
  const [showImportModal, setShowImportModal] = useState(false);

  // Customer / userMark
  const [userMark, setUserMark] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [originWarehouses, setOriginWarehouses] = useState<OriginWarehouse[]>([]);

  // Route and channel
  const [originWarehouse, setOriginWarehouse] = useState('');
  const [destinationCountry, setDestinationCountry] = useState('');
  const [destinationPort, setDestinationPort] = useState('');
  const [forwarderChannel, setForwarderChannel] = useState('');
  const [channels, setChannels] = useState<ShippingChannel[]>([]);
  const [expressNo, setExpressNo] = useState('');
  const [note, setNote] = useState('');

  // Overseas Consignee Address (认唛头不认发货人，按目的国/港口级联过滤)
  const [selectedConsigneeId, setSelectedConsigneeId] = useState<string>('');
  const [overseasName, setOverseasName] = useState('');
  const [overseasPhone, setOverseasPhone] = useState('');
  const [overseasCompany, setOverseasCompany] = useState('');
  const [overseasAddress, setOverseasAddress] = useState('');
  const [saveToAddressBook, setSaveToAddressBook] = useState(false);

  // Cargo Items (Pre-declared items)
  const [items, setItems] = useState<CargoItemRow[]>([
    {
      id: '1',
      trackingNumber: '',
      productName: '',
      quantity: 1,
      length: undefined,
      width: undefined,
      height: undefined,
      unitWeight: undefined,
      receivableCurrency: 'CNY',
      receivableUnitPrice: undefined,
      payableCurrency: 'CNY',
      payableUnitPrice: undefined,
    },
  ]);

  // Fees & Pricing
  const [isFixedPrice, setIsFixedPrice] = useState(false);
  const [fixedPriceAmount, setFixedPriceAmount] = useState<number | undefined>(undefined);
  const [fclQuotation, setFclQuotation] = useState<number | undefined>(undefined);
  const [fclQuotationCurrency, setFclQuotationCurrency] = useState<'CNY' | 'USD' | 'PHP'>('CNY');
  const [fees, setFees] = useState<FeeItemRow[]>([]);

  // 单票统一双汇率与当日实时行情
  const [usdRate, setUsdRate] = useState<number | ''>(7.20);
  const [phpRate, setPhpRate] = useState<number | ''>(8.00);
  const [rateSource, setRateSource] = useState<'LIVE' | 'CACHE' | 'FALLBACK' | 'CUSTOM'>('FALLBACK');
  const [isLoadingRates, setIsLoadingRates] = useState(false);

  // Submitting & Success Result Modal
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdResult, setCreatedResult] = useState<{
    id: string;
    waybillNo: string;
    userMark: string;
    orderType: ShipmentType;
    originWarehouse?: string;
    destinationCountry?: string;
    itemCount: number;
  } | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  const handleCopyWaybillNo = (no: string) => {
    navigator.clipboard.writeText(no);
    setHasCopied(true);
    toast.success(`系统运单号【${no}】已复制到剪贴板！`);
    setTimeout(() => setHasCopied(false), 2500);
  };

  const resetForm = () => {
    setUserMark('');
    setSelectedCustomer(null);
    const defaultWh = originWarehouses.find((w) => w.isDefault);
    setOriginWarehouse(defaultWh ? (defaultWh.shortName || defaultWh.name) : '');
    setDestinationCountry('');
    setDestinationPort('');
    const defaultCh = channels.find((c) => c.isDefault);
    setForwarderChannel(defaultCh ? defaultCh.name : '');
    setExpressNo('');
    setNote('');
    setSelectedConsigneeId('');
    setOverseasName('');
    setOverseasPhone('');
    setOverseasCompany('');
    setOverseasAddress('');
    setSaveToAddressBook(false);
    setIsFixedPrice(false);
    setFixedPriceAmount(undefined);
    setFclQuotation(undefined);
    setFclQuotationCurrency('CNY');
    setFees([]);
    setItems([
      {
        id: '1',
        trackingNumber: '',
        productName: '',
        quantity: 1,
        length: undefined,
        width: undefined,
        height: undefined,
        unitWeight: undefined,
        receivableCurrency: 'CNY',
        receivableUnitPrice: undefined,
        payableCurrency: 'CNY',
        payableUnitPrice: undefined,
      },
    ]);
    setCreatedResult(null);
  };

  const fetchTodayRates = async () => {
    setIsLoadingRates(true);
    try {
      const res = await financeV2Api.getTodayExchangeRates();
      if (res.data?.success && res.data?.data) {
        setUsdRate(res.data.data.usdRate);
        setPhpRate(res.data.data.phpRate);
        setRateSource(res.data.data.source);
      }
    } catch (e) {
      console.warn('获取当日实时汇率异常，降级为系统基准默认值', e);
    } finally {
      setIsLoadingRates(false);
    }
  };

  // Load customers & origin warehouses & today exchange rates
  useEffect(() => {
    fetchTodayRates();

    customerV2Api.list().then((res) => {
      if (res.data.data) {
        setCustomers(res.data.data);
      }
    });

    originWarehouseV2Api.list({ isActive: true }).then((res) => {
      if (res.data.data && res.data.data.length > 0) {
        setOriginWarehouses(res.data.data);
        const defaultWh = res.data.data.find((w) => w.isDefault);
        if (defaultWh) {
          setOriginWarehouse(defaultWh.shortName || defaultWh.name);
        }
      }
    });
  }, []);

  // Dynamically load channels and sync origin location matching current orderType (SEA_LCL / AIR / SEA_FCL)
  useEffect(() => {
    if (orderType === 'SEA_FCL') {
      if (!ORIGIN_PORTS.includes(originWarehouse)) {
        setOriginWarehouse(ORIGIN_PORTS[0] || '广州南沙港');
      }
    } else {
      if (ORIGIN_PORTS.includes(originWarehouse) || !originWarehouse) {
        const defaultWh = originWarehouses.find((w) => w.isDefault);
        if (defaultWh) {
          setOriginWarehouse(defaultWh.shortName || defaultWh.name);
        } else if (originWarehouses.length > 0) {
          setOriginWarehouse(originWarehouses[0].shortName || originWarehouses[0].name);
        }
      }
    }

    const targetCategory =
      orderType === 'AIR'
        ? 'AIR'
        : orderType === 'SEA_FCL'
        ? 'FCL_BOOKING'
        : 'SEA_LCL';

    channelV2Api.list({ category: targetCategory as any, isActive: true }).then((res) => {
      if (res.data.data) {
        setChannels(res.data.data);
        const defaultCh = res.data.data.find((c) => c.isDefault);
        if (defaultCh) {
          setForwarderChannel(defaultCh.name);
        } else if (res.data.data.length > 0) {
          setForwarderChannel(res.data.data[0].name);
        } else {
          setForwarderChannel('');
        }
      }
    });
  }, [orderType, originWarehouses]);


  const applyConsignee = (addr?: Partial<CustomerAddress> | null) => {
    if (addr) {
      setSelectedConsigneeId(addr.id || '');
      setOverseasName(addr.name || '');
      setOverseasPhone(addr.phone || '');
      setOverseasCompany(addr.company || '');
      setOverseasAddress(addr.address || '');
    } else {
      setSelectedConsigneeId('');
      setOverseasName('');
      setOverseasPhone('');
      setOverseasCompany('');
      setOverseasAddress('');
    }
  };

  // Available consignees under selected customer filtered by destination country and port
  const availableConsignees = useMemo(() => {
    if (!selectedCustomer?.addresses || selectedCustomer.addresses.length === 0) return [];
    return selectedCustomer.addresses.filter((addr) => {
      const matchCountry = !destinationCountry || !addr.country || addr.country === destinationCountry;
      if (orderType === 'AIR') {
        return matchCountry;
      }
      const matchPort = !destinationPort || !addr.region || addr.region === destinationPort;
      return matchCountry && matchPort;
    });
  }, [selectedCustomer, destinationCountry, destinationPort, orderType]);

  // Handle Mark Select / Input
  const handleMarkChange = (val: string) => {
    setUserMark(val);
    const matched = customers.find(
      (c) => c.clientCode.toLowerCase() === val.trim().toLowerCase()
    );
    if (matched) {
      setSelectedCustomer(matched);
      if (matched.defaultWarehouse) setOriginWarehouse(matched.defaultWarehouse);
      const targetCountry = matched.destinationCountry || destinationCountry || '';
      const targetPort = orderType === 'AIR' ? '' : (matched.destinationPort || destinationPort || '');
      setDestinationCountry(targetCountry);
      setDestinationPort(targetPort);

      // Auto-fill matching overseas address
      const matchingAddrs = (matched.addresses || []).filter((a) => {
        const mC = !targetCountry || !a.country || a.country === targetCountry;
        if (orderType === 'AIR') return mC;
        const mP = !targetPort || !a.region || a.region === targetPort;
        return mC && mP;
      });
      const defaultAddr =
        matchingAddrs.find((a) => a.isDefault) ||
        matchingAddrs[0] ||
        matched.addresses?.find((a) => a.isDefault) ||
        matched.addresses?.[0];
      
      applyConsignee(defaultAddr);
    } else {
      setSelectedCustomer(null);
    }
  };

  // Clear Mark input and reset customer auto-fill
  const handleClearMark = () => {
    setUserMark('');
    setSelectedCustomer(null);
    setSelectedConsigneeId('');
    setOverseasName('');
    setOverseasPhone('');
    setOverseasCompany('');
    setOverseasAddress('');
  };

  // Handle Country Change with dynamic consignee cascade
  const handleCountryChange = (country: string) => {
    setDestinationCountry(country);
    const defaultPort = orderType === 'AIR' ? '' : getDefaultPortByCountry(country);
    setDestinationPort(defaultPort);

    if (selectedCustomer?.addresses) {
      const matching = selectedCustomer.addresses.filter((a) => {
        const mC = !country || !a.country || a.country === country;
        if (orderType === 'AIR') return mC;
        const mP = !defaultPort || !a.region || a.region === defaultPort;
        return mC && mP;
      });
      const targetAddr = matching.find((a) => a.isDefault) || matching[0];
      applyConsignee(targetAddr);
      if (targetAddr) {
        const routeHint = orderType === 'AIR' ? country : `${country}·${defaultPort}`;
        toast.info(`已按【${routeHint}】自动匹配收件人【${targetAddr.name}】`);
      }
    }
  };

  // Handle Port Change with dynamic consignee cascade
  const handlePortChange = (port: string) => {
    setDestinationPort(port);

    if (selectedCustomer?.addresses) {
      const matching = selectedCustomer.addresses.filter((a) => {
        const mC = !destinationCountry || !a.country || a.country === destinationCountry;
        const mP = !port || !a.region || a.region === port;
        return mC && mP;
      });
      const targetAddr = matching.find((a) => a.isDefault) || matching[0];
      applyConsignee(targetAddr);
      if (targetAddr) {
        toast.info(`已按【${port}】自动匹配收件人【${targetAddr.name}】`);
      }
    }
  };

  // Add / Remove items
  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        trackingNumber: '',
        productName: '',
        quantity: 1,
        receivableCurrency: 'CNY',
        payableCurrency: 'CNY',
      },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof CargoItemRow, value: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (['length', 'width', 'height', 'quantity'].includes(field)) {
          const qty = Number(field === 'quantity' ? value : updated.quantity) || 1;
          const l = Number(field === 'length' ? value : updated.length) || 0;
          const w = Number(field === 'width' ? value : updated.width) || 0;
          const h = Number(field === 'height' ? value : updated.height) || 0;
          if (l && w && h) {
            updated.volume = Number(((l * w * h * qty) / 1_000_000).toFixed(4));
          }
        }
        return updated;
      })
    );
  };

  // Add / Remove fee items
  const addFee = () => {
    setFees((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        feeName: '报关费',
        feeDirection: 'RECEIVABLE',
        amount: 0,
        currency: 'CNY',
      },
    ]);
  };

  const removeFee = (id: string) => {
    setFees((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFee = (id: string, field: keyof FeeItemRow, value: any) => {
    setFees((prev) =>
      prev.map((fee) => (fee.id === id ? { ...fee, [field]: value } : fee))
    );
  };

  // Calculations
  const totalPieces = items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
  const totalVolumeCbm = items.reduce((sum, i) => {
    if (i.volume !== undefined && i.volume !== null && i.volume !== '') {
      return sum + Number(i.volume);
    }
    const qty = Number(i.quantity) || 0;
    const l = Number(i.length) || 0;
    const w = Number(i.width) || 0;
    const h = Number(i.height) || 0;
    return sum + (l * w * h * qty) / 1_000_000;
  }, 0);

  const totalWeightKg = items.reduce((sum, i) => {
    const qty = Number(i.quantity) || 0;
    const wt = Number(i.unitWeight) || 0;
    return sum + wt * qty;
  }, 0);

  const convertToCny = (amount: number, curr?: string) => {
    const val = Number(amount) || 0;
    if (val === 0) return 0;
    const c = (curr || 'CNY').toUpperCase();
    const effectiveUsd = Number(usdRate) > 0 ? Number(usdRate) : 7.20;
    const effectivePhp = Number(phpRate) > 0 ? Number(phpRate) : 8.00;
    if (c === 'USD') return val * effectiveUsd;
    if (c === 'PHP') return effectivePhp > 0 ? val / effectivePhp : 0;
    return val;
  };

  const baseReceivableInCny = items.reduce((sum, i) => {
    const qty = Number(i.quantity) || 0;
    const price = Number(i.receivableUnitPrice) || 0;
    const priceCny = convertToCny(price, i.receivableCurrency);
    if (orderType === 'AIR') {
      return sum + priceCny * (Number(i.unitWeight) || 0) * qty;
    }
    const vol = ((Number(i.length) || 0) * (Number(i.width) || 0) * (Number(i.height) || 0) * qty) / 1_000_000;
    return sum + priceCny * vol;
  }, 0);

  const basePayableInCny = items.reduce((sum, i) => {
    const qty = Number(i.quantity) || 0;
    const price = Number(i.payableUnitPrice) || 0;
    const priceCny = convertToCny(price, i.payableCurrency);
    if (orderType === 'AIR') {
      return sum + priceCny * (Number(i.unitWeight) || 0) * qty;
    }
    const vol = ((Number(i.length) || 0) * (Number(i.width) || 0) * (Number(i.height) || 0) * qty) / 1_000_000;
    return sum + priceCny * vol;
  }, 0);

  const extraReceivableInCny = fees
    .filter((f) => f.feeDirection === 'RECEIVABLE')
    .reduce((sum, f) => sum + convertToCny(Number(f.amount) || 0, f.currency), 0);

  const extraPayableInCny = fees
    .filter((f) => f.feeDirection === 'PAYABLE')
    .reduce((sum, f) => sum + convertToCny(Number(f.amount) || 0, f.currency), 0);

  const finalReceivableInCny = orderType === 'SEA_FCL'
    ? convertToCny(Number(fclQuotation) || 0, fclQuotationCurrency) + extraReceivableInCny
    : isFixedPrice && fixedPriceAmount
    ? convertToCny(Number(fixedPriceAmount) || 0, 'CNY') + extraReceivableInCny
    : baseReceivableInCny + extraReceivableInCny;

  const finalPayableInCny = basePayableInCny + extraPayableInCny;
  const estimatedProfitInCny = finalReceivableInCny - finalPayableInCny;

  // Submit Handler (Phase 1 creation)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userMark.trim()) {
      toast.error('请填写或选择客户唛头/编码');
      return;
    }
    if (items.some((i) => !i.productName.trim())) {
      toast.error('请确保每行货物都填写了品名');
      return;
    }
    if (orderType === 'SEA_FCL' && (!fclQuotation || fclQuotation <= 0)) {
      toast.error('海运整柜订单必须填写「整柜协议总报价」');
      return;
    }
    if (!overseasName.trim()) {
      toast.error('请填写海外收件联系人姓名 (必填)');
      return;
    }
    if (!overseasPhone.trim()) {
      toast.error('请填写海外收件人联系电话 (必填)');
      return;
    }
    if (!overseasAddress.trim()) {
      toast.error('请填写海外目的港详细派送地址 (必填)');
      return;
    }

    setIsSubmitting(true);
    try {
      const isFcl = orderType === 'SEA_FCL';
      const payload = {
        orderType,
        userMark: userMark.trim(),
        originWarehouse,
        destinationCountry,
        destinationPort: orderType === 'AIR' ? undefined : (destinationPort?.trim() || undefined),
        forwarderChannel: forwarderChannel.trim() || undefined,
        expressNo: expressNo.trim() || undefined,

        note: note.trim() || undefined,
        isFixedPrice: isFcl ? true : isFixedPrice,
        fixedPriceAmount: isFcl ? (Number(fclQuotation) || undefined) : isFixedPrice ? fixedPriceAmount : undefined,

        overseasName: overseasName.trim() || undefined,
        overseasPhone: overseasPhone.trim() || undefined,
        overseasCompany: overseasCompany.trim() || undefined,
        overseasAddress: overseasAddress.trim() || undefined,
        saveToAddressBook: saveToAddressBook && !!selectedCustomer,

        items: items.map((item) => {
          const qty = Number(item.quantity) || 1;
          const l = item.length ? Number(item.length) : undefined;
          const w = item.width ? Number(item.width) : undefined;
          const h = item.height ? Number(item.height) : undefined;
          const directVol = item.volume !== undefined && item.volume !== null && item.volume !== '' ? Number(item.volume) : undefined;
          const estVol = directVol !== undefined ? directVol : (l && w && h ? (l * w * h * qty) / 1_000_000 : undefined);
          return {
            trackingNumber: item.trackingNumber.trim() || undefined,
            productName: item.productName.trim(),
            quantity: qty,
            estimatedQuantity: qty,
            estimatedLength: l,
            estimatedWidth: w,
            estimatedHeight: h,
            estimatedWeight: item.unitWeight ? Number(item.unitWeight) : undefined,
            estimatedVolume: estVol,
            length: l,
            width: w,
            height: h,
            unitWeight: item.unitWeight ? Number(item.unitWeight) : undefined,
            receivableCurrency: item.receivableCurrency,
            receivableUnitPrice: item.receivableUnitPrice ? Number(item.receivableUnitPrice) : undefined,
            payableCurrency: item.payableCurrency,
            payableUnitPrice: item.payableUnitPrice ? Number(item.payableUnitPrice) : undefined,
          };
        }),

        fees: fees
          .filter((f) => Number(f.amount) > 0)
          .map((f) => ({
            feeName: f.feeName,
            feeDirection: f.feeDirection,
            amount: Number(f.amount),
            currency: f.currency,
            note: f.note,
          })),
      };

      const res = await waybillV2Api.create(payload);
      if (res.data.success) {
        setCreatedResult({
          id: res.data.data.id,
          waybillNo: res.data.data.waybillNo,
          userMark: payload.userMark,
          orderType: payload.orderType,
          originWarehouse: payload.originWarehouse,
          destinationCountry: payload.destinationCountry,
          itemCount: payload.items.length,
        });
        toast.success(`预报单创建成功！系统运单号: ${res.data.data.waybillNo}`);

        // 若勾选了沉淀到常用地址簿，重新拉取最新客户数据以同步缓存
        if (payload.saveToAddressBook) {
          customerV2Api.list().then((cRes) => {
            if (cRes.data.data) setCustomers(cRes.data.data);
          });
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || '创建预报运单失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-cyan-600 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold uppercase tracking-wider">
              阶段 1：客户委托预报
            </span>
            <h1 className="text-2xl font-bold">极速预报下单工作台</h1>
          </div>
          <p className="text-blue-100 text-xs mt-1.5 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-cyan-300" />
            初始下单仅录入已知预报信息。货柜号、实测尺寸、开船与清关信息将在后续阶段逐步增量录入。
          </p>
        </div>

        {/* Mode Selector & Batch Import */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-semibold backdrop-blur-md border border-white/20 flex items-center gap-1.5 transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
            批量导入此类型订单
          </button>

          <div className="flex bg-black/20 p-1.5 rounded-xl backdrop-blur-md">
            <button
              type="button"
              onClick={() => setOrderType('SEA_LCL')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                orderType === 'SEA_LCL'
                  ? 'bg-white text-blue-800 shadow-md font-semibold'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <Ship className="w-4 h-4" />
              海运拼柜 (LCL)
            </button>
            <button
              type="button"
              onClick={() => setOrderType('AIR')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                orderType === 'AIR'
                  ? 'bg-white text-blue-800 shadow-md font-semibold'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <Plane className="w-4 h-4" />
              空运快递 (AIR)
            </button>
            <button
              type="button"
              onClick={() => setOrderType('SEA_FCL')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                orderType === 'SEA_FCL'
                  ? 'bg-white text-blue-800 shadow-md font-semibold'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <Container className="w-4 h-4" />
              海运整柜 (FCL)
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: 核心运输与客户唛头 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-600" />
              客户识别与路线设定
            </h2>
            <span className="text-xs text-slate-400">
              输入唛头自动带出客户档案与海外默认收件地址
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* 客户唛头 */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                客户编码 / 唛头 <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  list="customer-marks"
                  placeholder="如 WH-ZZY-FLB, WH-10115"
                  value={userMark}
                  onChange={(e) => handleMarkChange(e.target.value)}
                  required
                  className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-semibold text-blue-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {userMark && (
                  <button
                    type="button"
                    onClick={handleClearMark}
                    className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors"
                    title="清空唛头"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <datalist id="customer-marks">
                  {customers.map((c) => (
                    <option key={c.id} value={c.clientCode}>
                      {c.name} ({c.destinationCountry || ''})
                    </option>
                  ))}
                </datalist>
              </div>
              {selectedCustomer && (
                <p className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  已匹配: {selectedCustomer.name}
                </p>
              )}
            </div>

            {/* 起运仓 / 集货点 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  {orderType === 'SEA_FCL' ? '国内起运港口' : '起运仓 / 集货点'} <span className="text-red-500">*</span>
                </label>
                {orderType !== 'SEA_FCL' && (
                  <button
                    type="button"
                    onClick={() => navigate('/v2/warehouses')}
                    className="text-[11px] text-blue-600 hover:text-blue-700 hover:underline font-semibold"
                  >
                    管理起运仓 →
                  </button>
                )}
              </div>
              {orderType === 'SEA_FCL' ? (
                <select
                  value={originWarehouse}
                  onChange={(e) => setOriginWarehouse(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
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

            {/* 目的国 */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                {orderType === 'AIR' ? '目的国家 (终点国)' : '目的国'} <span className="text-red-500">*</span>
              </label>
              <select
                value={destinationCountry}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- 请选择目的国 --</option>
                {DESTINATION_COUNTRIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.enName})
                  </option>
                ))}
              </select>
            </div>

            {/* 目的港口 (仅海运模式显示) */}
            {orderType !== 'AIR' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  目的港口
                </label>
                <select
                  value={destinationPort}
                  onChange={(e) => handlePortChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- 请选择目的港口 --</option>
                  {getPortsByCountry(destinationCountry).map((port) => (
                    <option key={port} value={port}>
                      {port}
                    </option>
                  ))}
                  {destinationPort && !getPortsByCountry(destinationCountry).includes(destinationPort) && (
                    <option value={destinationPort}>
                      {destinationPort} (自定义/已指定)
                    </option>
                  )}
                </select>
              </div>
            )}

            {/* 承运服务商 / 专线渠道 (forwarderChannel) */}
            <div className={`space-y-1.5 ${orderType === 'AIR' ? '' : 'lg:col-span-2'}`}>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  承运服务商 / 专线渠道
                </label>
                <button
                  type="button"
                  onClick={() => navigate('/v2/channels')}
                  className="text-[11px] text-blue-600 hover:text-blue-700 hover:underline font-semibold"
                >
                  管理渠道 →
                </button>
              </div>
              <select
                value={forwarderChannel}
                onChange={(e) => setForwarderChannel(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-blue-50/40 border border-blue-300 rounded-lg text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">
                  {orderType === 'AIR'
                    ? '-- 请选择空运承运专线 --'
                    : orderType === 'SEA_FCL'
                    ? '-- 请选择整柜订舱渠道 --'
                    : '-- 请选择散货拼箱承运渠道 --'}
                </option>
                {channels.map((ch) => (
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

            {/* 订单备注 */}
            <div className={`space-y-1.5 ${orderType === 'AIR' ? 'col-span-1 md:col-span-2 lg:col-span-4' : 'lg:col-span-2'}`}>
              <label className="block text-xs font-semibold text-slate-700">
                预报备注
              </label>
              <input
                type="text"
                placeholder="如 客户特约、不报关、需木架加固等"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 海外收件人与派送信息模块 */}
          <div className="pt-2">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  海外收货人与{orderType === 'AIR' ? '目的国' : '目的港'}派送档案 (Consignee)
                </h3>
                <span className="text-[11px] text-slate-400">
                  认唛头不认发件人 · 始发由起运仓集运 · 末端派送依此档案
                </span>
              </div>

              {/* 动态收件人下拉选择条 (按目的国/港口级联过滤) */}
              {selectedCustomer && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-xl border border-emerald-200 shadow-sm text-xs">
                  <div className="flex items-center gap-2 shrink-0">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-slate-800">
                      选择该{orderType === 'AIR' ? '国家' : '港口'}下属海外收件人:
                    </span>
                    <span className="text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md font-medium">
                      {destinationCountry || '未选国别'}{orderType !== 'AIR' && destinationPort ? ` · ${destinationPort}` : ''} ({availableConsignees.length}个)
                    </span>
                  </div>

                  <div className="flex-1 max-w-lg">
                    <select
                      value={selectedConsigneeId}
                      onChange={(e) => {
                        const addrId = e.target.value;
                        if (!addrId) {
                          applyConsignee(null);
                        } else {
                          const target = selectedCustomer.addresses?.find((a) => a.id === addrId);
                          applyConsignee(target);
                          if (target) toast.success(`已切换为收件人【${target.name}】`);
                        }
                      }}
                      className="w-full px-3 py-1.5 bg-emerald-50/60 border border-emerald-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {availableConsignees.length > 0 ? (
                        <>
                          <option value="">-- 点击选取已登记收件人 (或在下方直接编辑) --</option>
                          {availableConsignees.map((addr) => (
                            <option key={addr.id} value={addr.id}>
                              {addr.name} ({addr.phone}) {addr.company ? `[${addr.company}]` : ''} - {addr.address ? addr.address.slice(0, 30) : ''}... {addr.isDefault ? '⭐[默认]' : ''}
                            </option>
                          ))}
                        </>
                      ) : (
                        <option value="">-- 该{orderType === 'AIR' ? '目的国' : '港口'}暂无已登记收件人 (请在下方手工输入新档案) --</option>
                      )}
                    </select>
                  </div>
                </div>
              )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      海外收件联系人 <span className="text-red-500 font-bold">* (必填)</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="如 Alex Johnson"
                      value={overseasName}
                      onChange={(e) => setOverseasName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      海外联系电话 / WhatsApp <span className="text-red-500 font-bold">* (必填)</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="如 +63 917 123 4567"
                      value={overseasPhone}
                      onChange={(e) => setOverseasPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-mono font-medium focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      海外公司名称 (选填)
                    </label>
                    <input
                      type="text"
                      placeholder="如 Manila Trading Inc."
                      value={overseasCompany}
                      onChange={(e) => setOverseasCompany(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    海外目的港详细派送地址 <span className="text-red-500 font-bold">* (必填)</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="如 Unit 802, BGC Tower, Taguig City, Metro Manila"
                    value={overseasAddress}
                    onChange={(e) => setOverseasAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* 显式勾选同步保存至客户常用地址簿 (带防重校验) */}
                {selectedCustomer && (
                  <div className="pt-2 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={saveToAddressBook}
                        onChange={(e) => setSaveToAddressBook(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300"
                      />
                      <span className="font-semibold text-slate-800">
                        💾 同步将该收件人保存至【<strong className="text-blue-900 font-bold">{selectedCustomer.clientCode}</strong>】的常用地址簿 (可复用)
                      </span>
                    </label>
                    {saveToAddressBook && (
                      <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                        ✓ 下单时将自动执行电话与地址防重校验
                      </span>
                    )}
                  </div>
                )}
              </div>
          </div>
        </div>

        {/* Section 2: 货物预报清单 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-indigo-600" />
              预报货物明细与预估信息
            </h2>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加一行货物
            </button>
          </div>

          {/* FCL 整柜专属包干协议报价卡片 */}
          {orderType === 'SEA_FCL' && (
            <div className="p-4 bg-gradient-to-r from-blue-50/90 via-indigo-50/80 to-slate-50 border-2 border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold text-xs shadow-md shrink-0">
                  FCL
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    海运整柜包干协议总报价
                    <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold">
                      整柜包干报价模式
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    整柜按柜收费（无需拆解单件方数单价）；实际干线成本（订舱、拖车、THC堆存等）将在后续集装箱开航与清关阶段逐笔录入。
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <span className="text-xs font-bold text-slate-700">
                  整柜协议总报价 <span className="text-red-500 font-black">* (必填)</span>:
                </span>
                <div className="flex items-center">
                  <select
                    value={fclQuotationCurrency}
                    onChange={(e) => setFclQuotationCurrency(e.target.value as any)}
                    className="px-2.5 py-2 bg-slate-100 border border-r-0 border-slate-300 rounded-l-xl text-xs font-bold text-slate-700"
                  >
                    <option value="CNY">¥ 人民币</option>
                    <option value="USD">$ 美元</option>
                    <option value="PHP">₱ 比索</option>
                  </select>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    placeholder="如 28000.00"
                    value={fclQuotation ?? ''}
                    onChange={(e) => setFclQuotation(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-36 sm:w-44 px-3 py-2 bg-white border border-slate-300 rounded-r-xl text-sm font-black text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold">
                  <th className="py-3 px-3 text-center w-12">#</th>
                  <th className="py-3 px-3 min-w-[140px]">国内送仓单号</th>
                  <th className="py-3 px-3 min-w-[140px]">中文品名 *</th>
                  <th className="py-3 px-2 w-20 text-center">预报件数 *</th>
                  <th className="py-3 px-2 w-24 text-center">预估长(cm)</th>
                  <th className="py-3 px-2 w-24 text-center">预估宽(cm)</th>
                  <th className="py-3 px-2 w-24 text-center">预估高(cm)</th>
                  <th className="py-3 px-3 w-28 text-center bg-indigo-50/50 text-indigo-900">
                    预估体积 (m³)
                  </th>
                  <th className="py-3 px-2 w-24 text-center">预估重(kg)</th>
                  {orderType !== 'SEA_FCL' && (
                    <>
                      <th className="py-3 px-3 min-w-[140px]">
                        约定应收单价 ({orderType === 'AIR' ? '元/kg' : '元/方'})
                      </th>
                      <th className="py-3 px-3 min-w-[140px]">
                        约定成本单价 ({orderType === 'AIR' ? '元/kg' : '元/方'})
                      </th>
                    </>
                  )}
                  <th className="py-3 px-2 text-center w-12">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => {
                  const qty = Number(item.quantity) || 1;
                  const l = Number(item.length) || 0;
                  const w = Number(item.width) || 0;
                  const h = Number(item.height) || 0;
                  const vol = l && w && h ? (l * w * h * qty) / 1_000_000 : 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          placeholder="国内快递号"
                          value={item.trackingNumber}
                          onChange={(e) => updateItem(item.id, 'trackingNumber', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          placeholder="品名 (如 背心)"
                          value={item.productName}
                          onChange={(e) => updateItem(item.id, 'productName', e.target.value)}
                          required
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                          required
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-center font-semibold text-slate-800 focus:bg-white"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          step="0.1"
                          placeholder="长"
                          value={item.length || ''}
                          onChange={(e) => updateItem(item.id, 'length', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-center focus:bg-white"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          step="0.1"
                          placeholder="宽"
                          value={item.width || ''}
                          onChange={(e) => updateItem(item.id, 'width', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-center focus:bg-white"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          step="0.1"
                          placeholder="高"
                          value={item.height || ''}
                          onChange={(e) => updateItem(item.id, 'height', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-center focus:bg-white"
                        />
                      </td>
                      <td className="py-2 px-2 bg-indigo-50/40">
                        <input
                          type="number"
                          step="0.0001"
                          placeholder={vol > 0 ? vol.toFixed(4) : "体积 m³"}
                          value={item.volume !== undefined && item.volume !== null ? item.volume : (vol > 0 ? Number(vol.toFixed(4)) : '')}
                          onChange={(e) => updateItem(item.id, 'volume', e.target.value ? Number(e.target.value) : '')}
                          className="w-full px-2 py-1.5 bg-white border border-indigo-200 rounded text-xs text-center font-mono font-bold text-indigo-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          title="可直接手填总方数(CBM)，或输入长宽高自动计算"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          step="0.1"
                          placeholder="kg"
                          value={item.unitWeight || ''}
                          onChange={(e) => updateItem(item.id, 'unitWeight', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-center focus:bg-white"
                        />
                      </td>
                      {orderType !== 'SEA_FCL' && (
                        <>
                          <td className="py-2 px-3">
                            <div className="flex gap-1">
                              <select
                                value={item.receivableCurrency}
                                onChange={(e) => updateItem(item.id, 'receivableCurrency', e.target.value)}
                                className="px-1.5 py-1 bg-slate-100 border border-slate-200 rounded text-xs"
                              >
                                <option value="CNY">¥ CNY</option>
                                <option value="PHP">₱ PHP</option>
                                <option value="USD">$ USD</option>
                              </select>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="单价"
                                value={item.receivableUnitPrice || ''}
                                onChange={(e) => updateItem(item.id, 'receivableUnitPrice', e.target.value)}
                                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:bg-white"
                              />
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex gap-1">
                              <select
                                value={item.payableCurrency}
                                onChange={(e) => updateItem(item.id, 'payableCurrency', e.target.value)}
                                className="px-1.5 py-1 bg-slate-100 border border-slate-200 rounded text-xs"
                              >
                                <option value="CNY">¥ CNY</option>
                                <option value="PHP">₱ PHP</option>
                                <option value="USD">$ USD</option>
                              </select>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="成本"
                                value={item.payableUnitPrice || ''}
                                onChange={(e) => updateItem(item.id, 'payableUnitPrice', e.target.value)}
                                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:bg-white"
                              />
                            </div>
                          </td>
                        </>
                      )}
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          disabled={items.length <= 1}
                          className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

                {/* Section 2.5: 单票统一汇率卡片 */}
        <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-white rounded-xl border border-blue-200/80 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 text-blue-600 ${isLoadingRates ? 'animate-spin' : ''}`} />
              <h3 className="text-sm font-bold text-slate-800">
                单票结算汇率配置 (贵币计价法)
              </h3>
              <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${
                rateSource === 'LIVE' ? 'bg-emerald-100 text-emerald-700' :
                rateSource === 'CACHE' ? 'bg-blue-100 text-blue-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                {rateSource === 'LIVE' ? '当日实时行情' : rateSource === 'CACHE' ? '今日缓存汇率' : rateSource === 'CUSTOM' ? '单票手工微调' : '系统安全基准'}
              </span>
            </div>
            <button
              type="button"
              onClick={fetchTodayRates}
              disabled={isLoadingRates}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 rounded text-xs font-semibold shadow-sm transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRates ? 'animate-spin' : ''}`} />
              {isLoadingRates ? '正在同步...' : '重新获取当日汇率'}
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="bg-white/90 p-3 rounded-lg border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-600">美金结算汇率 (USD)</span>
                <p className="text-[11px] text-slate-400">1 美元 (USD) 兑换人民币</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 font-mono">1 USD =</span>
                <input
                  type="number"
                  step="0.0001"
                  value={usdRate}
                  onChange={(e) => {
                    setUsdRate(e.target.value === '' ? '' : Number(e.target.value));
                    setRateSource('CUSTOM');
                  }}
                  className="w-24 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-sm text-blue-700 text-right focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="7.2000"
                />
                <span className="text-xs font-bold text-slate-700 font-mono">CNY</span>
              </div>
            </div>

            <div className="bg-white/90 p-3 rounded-lg border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-600">比索结算汇率 (PHP)</span>
                <p className="text-[11px] text-slate-400">1 人民币 (CNY) 兑换比索</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 font-mono">1 CNY =</span>
                <input
                  type="number"
                  step="0.0001"
                  value={phpRate}
                  onChange={(e) => {
                    setPhpRate(e.target.value === '' ? '' : Number(e.target.value));
                    setRateSource('CUSTOM');
                  }}
                  className="w-24 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-sm text-purple-700 text-right focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="8.0000"
                />
                <span className="text-xs font-bold text-slate-700 font-mono">PHP</span>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            提示：系统自动同步当日基准汇率。若该订单有业务约定特批汇率，可直接微调（仅对本票订单生效）。所有外币收支将统一按此汇率折算为人民币核算净毛利。
          </p>
        </div>

        {/* Section 3: 附加杂费 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              {orderType === 'SEA_FCL' ? '特殊附加杂费 (可选)' : '特殊杂费与包干协议 (可选)'}
            </h2>
            <div className="flex items-center gap-4">
              {orderType !== 'SEA_FCL' && (
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFixedPrice}
                    onChange={(e) => setIsFixedPrice(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  包干一口价模式
                </label>
              )}
              <button
                type="button"
                onClick={addFee}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                添加附加杂费
              </button>
            </div>
          </div>

          {orderType !== 'SEA_FCL' && isFixedPrice && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-4">
              <span className="text-xs font-bold text-amber-900">一口价应收总额 (¥):</span>
              <input
                type="number"
                step="0.01"
                placeholder="直接填入如 200.00"
                value={fixedPriceAmount || ''}
                onChange={(e) => setFixedPriceAmount(Number(e.target.value))}
                className="px-3 py-1.5 bg-white border border-amber-300 rounded-md text-sm font-bold text-amber-900"
              />
              <span className="text-xs text-amber-700">（将直接覆盖基于体积/重量计算的基础运费）</span>
            </div>
          )}

          {fees.length > 0 && (
            <div className="space-y-3 pt-2">
              {fees.map((fee) => (
                <div
                  key={fee.id}
                  className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                >
                  <input
                    type="text"
                    placeholder="费用名称 (如 报关费, 拖车费)"
                    value={fee.feeName}
                    onChange={(e) => updateFee(fee.id, 'feeName', e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded w-44 font-medium"
                  />
                  <select
                    value={fee.feeDirection}
                    onChange={(e) => updateFee(fee.id, 'feeDirection', e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded font-semibold"
                  >
                    <option value="RECEIVABLE">+ 应收客户 (加价)</option>
                    <option value="PAYABLE">- 应付成本 (支出)</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <select
                      value={fee.currency}
                      onChange={(e) => updateFee(fee.id, 'currency', e.target.value)}
                      className="px-2 py-1.5 bg-white border border-slate-300 rounded"
                    >
                      <option value="CNY">¥ CNY</option>
                      <option value="PHP">₱ PHP</option>
                      <option value="USD">$ USD</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="金额"
                      value={fee.amount || ''}
                      onChange={(e) => updateFee(fee.id, 'amount', Number(e.target.value))}
                      className="px-2.5 py-1.5 bg-white border border-slate-300 rounded w-32 font-bold"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="费用备注"
                    value={fee.note || ''}
                    onChange={(e) => updateFee(fee.id, 'note', e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded"
                  />
                  <button
                    type="button"
                    onClick={() => removeFee(fee.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Floating Bar */}
        <div className="sticky bottom-4 z-20 bg-slate-900 text-white rounded-2xl p-5 shadow-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 border border-slate-800">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-xs">
            <div>
              <span className="text-slate-400">预报件数</span>
              <p className="text-lg font-bold text-white font-mono mt-0.5">{totalPieces} 件</p>
            </div>
            <div>
              <span className="text-slate-400">
                {orderType === 'AIR' ? '预估重量' : '预估体积'}
              </span>
              <p className="text-lg font-bold text-cyan-400 font-mono mt-0.5">
                {orderType === 'AIR'
                  ? `${totalWeightKg.toFixed(2)} kg`
                  : `${totalVolumeCbm.toFixed(4)} m³`}
              </p>
            </div>
            <div>
              <span className="text-slate-400">预计应收总额 (折合)</span>
              <p className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
                ¥ {finalReceivableInCny.toFixed(2)}
              </p>
            </div>
            <div>
              <span className="text-slate-400">预计净毛利 (折合)</span>
              <p className={`text-lg font-bold font-mono mt-0.5 ${estimatedProfitInCny >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                ¥ {estimatedProfitInCny.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto">
            <button
              type="button"
              onClick={() => navigate('/v2/waybills')}
              className="px-5 py-2.5 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-colors"
            >
              取消返回
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/30 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isSubmitting ? '保存中...' : '提交预报单 (进入生命周期流转)'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </form>

      {/* ========================================================= */}
      {/* 预报单创建成功提示弹窗 (展示生成的系统运单号，支持一键复制保存) */}
      {/* ========================================================= */}
      {createdResult && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900">
                委托预报单创建成功！
              </h2>
              <p className="text-xs text-slate-500">
                系统已自动生成全局唯一运单号，请妥善复制保存并告知客户
              </p>
            </div>

            {/* Waybill Number Copy Area */}
            <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl space-y-2 text-center relative">
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                系统生成运单号 (System Waybill No.)
              </span>
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-blue-950 select-all">
                  {createdResult.waybillNo}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyWaybillNo(createdResult.waybillNo)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                    hasCopied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-300'
                  }`}
                  title="点击复制运单号"
                >
                  {hasCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      复制单号
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Summary Details */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
              <div className="flex justify-between text-slate-600">
                <span>客户唛头/编码:</span>
                <strong className="text-slate-900 font-mono">{createdResult.userMark}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>运输通道类型:</span>
                <span className="font-semibold text-slate-900">
                  {createdResult.orderType === 'SEA_LCL'
                    ? '🚢 海运拼箱 (LCL)'
                    : createdResult.orderType === 'AIR'
                    ? '✈️ 空运专线 (AIR)'
                    : '📦 海运整柜 (FCL)'}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>起运/目的地:</span>
                <span className="text-slate-900 font-medium">
                  {createdResult.originWarehouse || '待定起运仓'} ➔ {createdResult.destinationCountry || '待定目的国'}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>货物商品数量:</span>
                <span className="text-slate-900 font-medium">{createdResult.itemCount} 行商品</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  handleCopyWaybillNo(createdResult.waybillNo);
                  navigate(`/v2/waybills/${createdResult.id}`);
                }}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>📋 复制单号并进入详情 (生命周期推进)</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  继续预报下一单
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/v2/waybills')}
                  className="w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  返回运单列表
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 批量导入弹窗 */}
      <BatchImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        importType={orderType}
        onSuccess={() => {
          toast.success('订单批量导入完成！');
          navigate('/v2/waybills');
        }}
      />
    </div>
  );
}
