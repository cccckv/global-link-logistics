import { PrismaClient, ShipmentType, WaybillStatus, CurrencyType, FeeDirection, AttachmentType } from '@prisma/client';
import { CustomerV2Service } from '../customer/customer.service';

const prisma = new PrismaClient();
const customerService = new CustomerV2Service();

function generateWaybillNo(type: ShipmentType = 'SEA_LCL'): string {
  const prefix = type === 'AIR' ? 'AWB' : type === 'SEA_FCL' ? 'FCL' : 'LCL';
  const now = new Date();
  const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
  const randomStr = Math.floor(1000 + Math.random() * 9000).toString();
  return `${prefix}${dateStr}${randomStr}`;
}

export function parseNullableDate(val: any): Date | null | undefined {
  if (val === undefined) return undefined;
  if (val === null || val === '' || val === 'null' || val === 'undefined') return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 客户门户专属数据脱敏过滤器：
 * 1. 隐藏内部同行渠道 (forwarderChannel)
 * 2. 隐藏内部总应付成本与毛利 (payableAmount, profitAmount, basePayable)
 * 3. 过滤费用子表：仅保留 RECEIVABLE (应收)，彻底移除 PAYABLE (应付成本)
 * 4. 货物明细脱敏：移除单件应付成本单价与币种
 */
export function sanitizeWaybillForCustomer(waybill: any) {
  if (!waybill) return null;
  const {
    forwarderChannel,
    payableAmount,
    profitAmount,
    basePayable,
    ...safeWb
  } = waybill;

  if (Array.isArray(safeWb.fees)) {
    safeWb.fees = safeWb.fees.filter((f: any) => f.feeDirection === 'RECEIVABLE');
  }

  if (Array.isArray(safeWb.items)) {
    safeWb.items = safeWb.items.map((item: any) => {
      const { payableUnitPrice, payableCurrency, payableVolume, ...safeItem } = item;
      return safeItem;
    });
  }

  return safeWb;
}

export interface CreateWaybillItemInput {
  id?: string;
  trackingNumber?: string;
  productName: string;
  quantity?: number;
  length?: number;
  width?: number;
  height?: number;
  unitWeight?: number;
  estimatedQuantity?: number;
  estimatedLength?: number;
  estimatedWidth?: number;
  estimatedHeight?: number;
  estimatedWeight?: number;
  estimatedVolume?: number;
  receivableCurrency?: CurrencyType;
  receivableUnitPrice?: number;
  receivableVolume?: number;
  payableCurrency?: CurrencyType;
  payableUnitPrice?: number;
  payableVolume?: number;
}

export interface CreateWaybillFeeInput {
  feeName: string;
  feeDirection: FeeDirection;
  amount: number;
  currency?: CurrencyType;
  exchangeRate?: number;
  amountInCny?: number;
  note?: string;
}

export interface CreateWaybillInput {
  orderType: ShipmentType;
  userMark: string;
  operatorId?: string;
  originWarehouse?: string;
  destinationCountry: string;
  destinationPort?: string;
  expressNo?: string;
  customsType?: string;
  forwarderChannel?: string;
  isFixedPrice?: boolean;
  fixedPriceAmount?: number;
  saveToAddressBook?: boolean;

  voyageNumber?: string;
  airWaybillNo?: string;
  note?: string;

  recipientName?: string;
  recipientPhone?: string;

  recipientCompany?: string;
  recipientAddress?: string;
  recipientRegion?: string;

  overseasName?: string;
  overseasPhone?: string;
  overseasCompany?: string;
  overseasAddress?: string;
  overseasRegion?: string;

  inboundDate?: Date | string;
  items: CreateWaybillItemInput[];
  fees?: CreateWaybillFeeInput[];
  attachments?: Array<{
    attachmentType: AttachmentType;
    fileUrl: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
  }>;
}

export interface CalculateFinancialsParams {
  orderType: ShipmentType;
  isFixedPrice?: boolean;
  fixedPriceAmount?: number | null;
  currentReceivableAmount?: number | null;
  items: Array<{
    quantity?: number | null;
    length?: number | null;
    width?: number | null;
    height?: number | null;
    unitWeight?: number | null;
    estimatedQuantity?: number | null;
    estimatedLength?: number | null;
    estimatedWidth?: number | null;
    estimatedHeight?: number | null;
    estimatedWeight?: number | null;
    estimatedVolume?: number | null;
    receivableUnitPrice?: number | null;
    payableUnitPrice?: number | null;
  }>;
  fees?: Array<{
    feeDirection: FeeDirection;
    amountInCny?: any;
    amount?: any;
    exchangeRate?: any;
  }>;
}

export function calculateWaybillFinancials(params: CalculateFinancialsParams) {
  const { orderType, isFixedPrice, fixedPriceAmount, currentReceivableAmount, items, fees } = params;

  let baseReceivable = 0;
  let basePayable = 0;

  if (items && items.length > 0) {
    for (const item of items) {
      const qty = item.quantity && Number(item.quantity) > 0 ? Number(item.quantity) : 1;
      const recvPrice = item.receivableUnitPrice ? Number(item.receivableUnitPrice) : 0;
      const payPrice = item.payableUnitPrice ? Number(item.payableUnitPrice) : 0;

      if (orderType === 'AIR') {
        const wt = item.unitWeight !== undefined && item.unitWeight !== null
          ? Number(item.unitWeight)
          : (item.estimatedWeight !== undefined && item.estimatedWeight !== null ? Number(item.estimatedWeight) : 0);
        baseReceivable += recvPrice * wt * qty;
        basePayable += payPrice * wt * qty;
      } else {
        let vol = 0;
        if (item.length && item.width && item.height) {
          vol = (Number(item.length) * Number(item.width) * Number(item.height) * qty) / 1_000_000;
        } else if (item.estimatedLength && item.estimatedWidth && item.estimatedHeight) {
          const estQty = item.estimatedQuantity && Number(item.estimatedQuantity) > 0 ? Number(item.estimatedQuantity) : qty;
          vol = (Number(item.estimatedLength) * Number(item.estimatedWidth) * Number(item.estimatedHeight) * estQty) / 1_000_000;
        } else if (item.estimatedVolume) {
          vol = Number(item.estimatedVolume);
        }
        baseReceivable += recvPrice * vol;
        basePayable += payPrice * vol;
      }
    }
  }

  // Determine final base receivable (isolated from surcharges)
  let finalBaseReceivable = baseReceivable;
  if (isFixedPrice) {
    if (fixedPriceAmount !== undefined && fixedPriceAmount !== null && Number(fixedPriceAmount) > 0) {
      finalBaseReceivable = Number(fixedPriceAmount);
    } else if (currentReceivableAmount !== undefined && currentReceivableAmount !== null && Number(currentReceivableAmount) > 0) {
      let existingRecvFeesSum = 0;
      if (fees && fees.length > 0) {
        for (const fee of fees) {
          if (fee.feeDirection === 'RECEIVABLE') {
            const rate = fee.exchangeRate ? Number(fee.exchangeRate) : 1.0;
            existingRecvFeesSum += fee.amountInCny !== undefined && fee.amountInCny !== null
              ? Number(fee.amountInCny)
              : (Number(fee.amount || 0) * rate);
          }
        }
      }
      finalBaseReceivable = Math.max(0, Number(currentReceivableAmount) - existingRecvFeesSum);
    }
  }

  let finalReceivable = finalBaseReceivable;
  let finalPayable = basePayable;

  if (fees && fees.length > 0) {
    for (const fee of fees) {
      const rate = fee.exchangeRate ? Number(fee.exchangeRate) : 1.0;
      const cny = fee.amountInCny !== undefined && fee.amountInCny !== null
        ? Number(fee.amountInCny)
        : (Number(fee.amount || 0) * rate);
      if (fee.feeDirection === 'RECEIVABLE') {
        finalReceivable += cny;
      } else {
        finalPayable += cny;
      }
    }
  }

  return {
    baseReceivable: Math.round(finalBaseReceivable * 100) / 100,
    basePayable: Math.round(basePayable * 100) / 100,
    receivableAmount: Math.round(finalReceivable * 100) / 100,
    payableAmount: Math.round(finalPayable * 100) / 100,
    profitAmount: Math.round((finalReceivable - finalPayable) * 100) / 100,
  };
}

export class WaybillV2Service {
  async createWaybill(data: CreateWaybillInput) {
    const waybillNo = generateWaybillNo(data.orderType);

    let customerId: string | undefined;
    const customer = await prisma.customer.findUnique({
      where: { clientCode: data.userMark },
    });
    if (customer) {
      customerId = customer.id;
    }

    let totalPieces = 0;
    let totalPayableCbm = 0;
    let totalReceivableCbm = 0;
    let totalWeightKg = 0;

    const processedItems = data.items.map((item, idx) => {
      const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;
      totalPieces += qty;

      let payableVol = 0;
      let receivableVol = 0;
      if (item.length && item.width && item.height) {
        payableVol = (item.length * item.width * item.height * qty) / 1_000_000;
        receivableVol = payableVol;
      }
      totalPayableCbm += payableVol;
      totalReceivableCbm += receivableVol;

      if (item.unitWeight) {
        totalWeightKg += item.unitWeight * qty;
      }

      const estQty = item.estimatedQuantity !== undefined && item.estimatedQuantity !== null ? item.estimatedQuantity : qty;
      const estL = item.estimatedLength !== undefined && item.estimatedLength !== null ? item.estimatedLength : item.length;
      const estW = item.estimatedWidth !== undefined && item.estimatedWidth !== null ? item.estimatedWidth : item.width;
      const estH = item.estimatedHeight !== undefined && item.estimatedHeight !== null ? item.estimatedHeight : item.height;
      const estWt = item.estimatedWeight !== undefined && item.estimatedWeight !== null ? item.estimatedWeight : item.unitWeight;
      const estVol = estL && estW && estH ? (estL * estW * estH * estQty) / 1_000_000 : (item.estimatedVolume || undefined);

      return {
        itemIndex: idx + 1,
        trackingNumber: item.trackingNumber,
        productName: item.productName,
        quantity: qty,
        estimatedQuantity: estQty,
        estimatedLength: estL,
        estimatedWidth: estW,
        estimatedHeight: estH,
        estimatedWeight: estWt,
        estimatedVolume: estVol,
        length: item.length,
        width: item.width,
        height: item.height,
        payableVolume: payableVol > 0 ? payableVol : undefined,
        receivableVolume: receivableVol > 0 ? receivableVol : undefined,
        unitWeight: item.unitWeight,
        totalWeight: item.unitWeight ? item.unitWeight * qty : undefined,
        receivableCurrency: item.receivableCurrency || 'CNY',
        receivableUnitPrice: item.receivableUnitPrice,
        payableCurrency: item.payableCurrency || 'CNY',
        payableUnitPrice: item.payableUnitPrice,
      };
    });

    const feesToCreate: any[] = [];
    if (data.fees && data.fees.length > 0) {
      data.fees.forEach(fee => {
        const rate = fee.exchangeRate || 1.0;
        const cnyAmount = fee.amount * rate;
        feesToCreate.push({
          feeName: fee.feeName,
          feeDirection: fee.feeDirection,
          amount: fee.amount,
          currency: fee.currency || 'CNY',
          exchangeRate: rate,
          amountInCny: cnyAmount,
          note: fee.note,
        });
      });
    }

    const financials = calculateWaybillFinancials({
      orderType: data.orderType,
      isFixedPrice: data.isFixedPrice,
      fixedPriceAmount: data.fixedPriceAmount,
      items: processedItems,
      fees: feesToCreate,
    });

    const initialStatus: WaybillStatus = data.inboundDate ? 'INBOUND' : 'DRAFT';

    const createdWaybill = await prisma.waybill.create({
      data: {
        waybillNo,
        orderType: data.orderType,
        status: initialStatus,
        customerId,
        userMark: data.userMark,
        operatorId: data.operatorId,
        originWarehouse: data.originWarehouse,
        destinationCountry: data.destinationCountry,
        destinationPort: data.destinationPort,
        expressNo: data.expressNo,
        customsType: data.customsType,
        forwarderChannel: data.forwarderChannel,
        voyageNumber: data.voyageNumber,
        airWaybillNo: data.airWaybillNo,
        note: data.note,
        isFixedPrice: data.isFixedPrice || false,
        recipientName: data.recipientName,
        recipientPhone: data.recipientPhone,
        recipientCompany: data.recipientCompany,
        recipientAddress: data.recipientAddress,
        recipientRegion: data.recipientRegion,
        overseasName: data.overseasName,
        overseasPhone: data.overseasPhone,
        overseasCompany: data.overseasCompany,
        overseasAddress: data.overseasAddress,
        overseasRegion: data.overseasRegion,
        inboundDate: parseNullableDate(data.inboundDate) || undefined,
        totalPieces,
        totalPayableCbm: totalPayableCbm > 0 ? totalPayableCbm : undefined,
        totalReceivableCbm: totalReceivableCbm > 0 ? totalReceivableCbm : undefined,
        totalWeightKg: totalWeightKg > 0 ? totalWeightKg : undefined,
        receivableAmount: financials.receivableAmount,
        payableAmount: financials.payableAmount,
        profitAmount: financials.profitAmount,
        items: {
          create: processedItems,
        },
        fees: feesToCreate.length > 0 ? { create: feesToCreate } : undefined,
        attachments: data.attachments && data.attachments.length > 0
          ? { create: data.attachments }
          : undefined,
      },
      include: {
        items: true,
        fees: true,
        attachments: true,
      },
    });

    // 显式勾选同步沉淀至客户地址簿 (带多维防重校验)
    if (data.saveToAddressBook && customerId && data.overseasName && (data.overseasPhone || data.overseasAddress)) {
      try {
        await customerService.saveCustomerAddressWithDeduplication(customerId, {
          name: data.overseasName,
          phone: data.overseasPhone || '-',
          company: data.overseasCompany,
          country: data.destinationCountry,
          region: data.destinationPort,
          address: data.overseasAddress || '默认目的港派送地址',
        });
      } catch (err) {
        console.error('Failed to sync overseas consignee to customer address book:', err);
      }
    }

    return createdWaybill;
  }

  async getWaybills(params: {
    orderType?: ShipmentType;
    status?: WaybillStatus;
    search?: string;
    containerId?: string;
    containerNo?: string;
    userMark?: string;
    userMarks?: string[];
    originWarehouse?: string;
    destinationCountry?: string;
    destinationPort?: string;
    forwarderChannel?: string;
    customsType?: string;
    unassignedOnly?: boolean | string;
    overseasKeyword?: string;
    dateType?: 'createdAt' | 'inboundDate' | 'loadingDate' | 'sailingDate' | 'eta' | 'signedDate';
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      orderType,
      status,
      search,
      containerId,
      containerNo,
      userMark,
      originWarehouse,
      destinationCountry,
      destinationPort,
      forwarderChannel,
      customsType,
      unassignedOnly,
      overseasKeyword,
      dateType,
      startDate,
      endDate,
    } = params;

    const where: any = {};
    const andConditions: any[] = [];

    if (orderType) where.orderType = orderType;

    // 待配载/待排柜/待发运筛选: 未挂载集装箱 (containerId is null) 且状态为已入库 INBOUND (若指定了 orderType 则精准限定对应类型)
    const isUnassigned = unassignedOnly === true || unassignedOnly === 'true';
    if (isUnassigned) {
      where.containerId = null;
      if (status) {
        where.status = status;
      } else {
        where.status = 'INBOUND';
      }
    } else {
      if (status) where.status = status;
      if (containerId) where.containerId = containerId;
    }

    if (params.userMarks && params.userMarks.length > 0) {
      if (userMark && userMark.trim() && params.userMarks.includes(userMark.trim())) {
        where.userMark = userMark.trim();
      } else {
        where.userMark = { in: params.userMarks };
      }
    } else if (userMark && userMark.trim()) {
      where.userMark = { contains: userMark.trim(), mode: 'insensitive' };
    }

    if (originWarehouse && originWarehouse.trim()) {
      where.originWarehouse = { contains: originWarehouse.trim(), mode: 'insensitive' };
    }

    if (destinationCountry && destinationCountry.trim()) {
      where.destinationCountry = { contains: destinationCountry.trim(), mode: 'insensitive' };
    }

    if (destinationPort && destinationPort.trim()) {
      where.destinationPort = { contains: destinationPort.trim(), mode: 'insensitive' };
    }

    if (forwarderChannel && forwarderChannel.trim()) {
      where.forwarderChannel = { contains: forwarderChannel.trim(), mode: 'insensitive' };
    }

    if (customsType && customsType.trim()) {
      where.customsType = { contains: customsType.trim(), mode: 'insensitive' };
    }

    // 柜号/提单号精确或模糊反查
    if (containerNo && containerNo.trim()) {
      const cNo = containerNo.trim();
      where.containerMaster = {
        OR: [
          { containerNo: { contains: cNo, mode: 'insensitive' } },
          { blNumber: { contains: cNo, mode: 'insensitive' } },
          { vesselVoyage: { contains: cNo, mode: 'insensitive' } },
        ],
      };
    }

    // 海外收件人/电话/公司模糊搜索
    if (overseasKeyword && overseasKeyword.trim()) {
      const okw = overseasKeyword.trim();
      andConditions.push({
        OR: [
          { overseasName: { contains: okw, mode: 'insensitive' } },
          { overseasPhone: { contains: okw, mode: 'insensitive' } },
          { overseasCompany: { contains: okw, mode: 'insensitive' } },
          { overseasAddress: { contains: okw, mode: 'insensitive' } },
        ],
      });
    }

    // 综合模糊搜索
    if (search && search.trim()) {
      const s = search.trim();
      andConditions.push({
        OR: [
          { waybillNo: { contains: s, mode: 'insensitive' } },
          { expressNo: { contains: s, mode: 'insensitive' } },
          { userMark: { contains: s, mode: 'insensitive' } },
          { airWaybillNo: { contains: s, mode: 'insensitive' } },
          { voyageNumber: { contains: s, mode: 'insensitive' } },
          { destinationCountry: { contains: s, mode: 'insensitive' } },
          { destinationPort: { contains: s, mode: 'insensitive' } },
          { forwarderChannel: { contains: s, mode: 'insensitive' } },
          { overseasName: { contains: s, mode: 'insensitive' } },
          { overseasPhone: { contains: s, mode: 'insensitive' } },
          { containerMaster: { containerNo: { contains: s, mode: 'insensitive' } } },
          { containerMaster: { blNumber: { contains: s, mode: 'insensitive' } } },
          {
            items: {
              some: {
                OR: [
                  { trackingNumber: { contains: s, mode: 'insensitive' } },
                  { productName: { contains: s, mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
      });
    }

    // 业务时间范围筛选 (支持按录单时间、入库时间、装柜时间、开船时间、ETA、签收时间)
    if (startDate || endDate) {
      const validDateFields = ['createdAt', 'inboundDate', 'loadingDate', 'sailingDate', 'eta', 'signedDate'];
      const field = dateType && validDateFields.includes(dateType) ? dateType : 'createdAt';
      const dateCondition: any = {};
      if (startDate) {
        dateCondition.gte = new Date(startDate);
      }
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        dateCondition.lte = eDate;
      }
      where[field] = dateCondition;
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const pageNum = Math.max(1, Number(params.page) || 1);
    const limitNum = Math.max(1, Number(params.limit) || 20);
    const skip = (pageNum - 1) * limitNum;

    // 构建不含 status 条件的基础 where，用于 groupBy 统计各状态数量
    const countsWhere = { ...where };
    delete countsWhere.status;

    const [total, waybills, counts] = await Promise.all([
      prisma.waybill.count({ where }),
      prisma.waybill.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { orderBy: { itemIndex: 'asc' } },
          fees: true,
          containerMaster: true,
          customer: true,
        },
      }),
      prisma.waybill.groupBy({
        by: ['status'],
        where: countsWhere,
        _count: { id: true },
      }),
    ]);

    const countsMap: Record<string, number> = {
      ALL: 0,
      DRAFT: 0,
      INBOUND: 0,
      LOADED: 0,
      IN_TRANSIT: 0,
      CUSTOMS: 0,
      DISPATCHING: 0,
      DELIVERED: 0,
    };

    let allCount = 0;
    counts.forEach((c) => {
      countsMap[c.status] = c._count.id;
      allCount += c._count.id;
    });
    countsMap.ALL = allCount;

    return {
      data: waybills,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      counts: countsMap,
    };
  }

  async getWaybillById(id: string) {
    return prisma.waybill.findUnique({
      where: { id },
      include: {
        items: { orderBy: { itemIndex: 'asc' } },
        fees: { orderBy: { createdAt: 'asc' } },
        attachments: { orderBy: { uploadedAt: 'desc' } },
        containerMaster: true,
        customer: {
          include: {
            addresses: {
              orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
            },
          },
        },
      },
    });
  }

  async updateWaybill(id: string, data: Partial<CreateWaybillInput> & {
    status?: WaybillStatus;
    containerId?: string;
    loadingDate?: Date | string;
    sailingDate?: Date | string;
    eta?: Date | string;
    clearanceDate?: Date | string;
    signedDate?: Date | string;
    inboundDate?: Date | string;
    inspectStatus?: string;
  }) {
    const { items, ...rest } = data;
    const updateData: any = { ...rest };

    if ('inboundDate' in data) updateData.inboundDate = parseNullableDate(data.inboundDate);
    if ('loadingDate' in data) updateData.loadingDate = parseNullableDate(data.loadingDate);
    if ('sailingDate' in data) updateData.sailingDate = parseNullableDate(data.sailingDate);
    if ('eta' in data) updateData.eta = parseNullableDate(data.eta);
    if ('clearanceDate' in data) updateData.clearanceDate = parseNullableDate(data.clearanceDate);
    if ('signedDate' in data) updateData.signedDate = parseNullableDate(data.signedDate);

    const existingWb = await prisma.waybill.findUnique({
      where: { id },
      include: { fees: true, items: true },
    });
    if (!existingWb) throw new Error('Waybill not found');

    const effectiveOrderType = updateData.orderType || existingWb.orderType;
    const effectiveIsFixed = updateData.isFixedPrice !== undefined ? updateData.isFixedPrice : existingWb.isFixedPrice;
    const effectiveFixedAmt = updateData.fixedPriceAmount !== undefined ? updateData.fixedPriceAmount : existingWb.fixedPriceAmount;

    if (items && items.length > 0) {
      const existingItemMap = new Map<string, any>();
      for (const it of existingWb.items) {
        existingItemMap.set(it.id, it);
      }

      const keepIds = new Set<string>();
      for (const it of items) {
        if (it.id && existingItemMap.has(it.id)) {
          keepIds.add(it.id);
        }
      }

      // 1. 删除前端已主动移除的行 (存在于数据库但不在 keepIds 中)
      const toDeleteIds = existingWb.items
        .filter((it) => !keepIds.has(it.id))
        .map((it) => it.id);
      if (toDeleteIds.length > 0) {
        await prisma.waybillItem.deleteMany({
          where: { id: { in: toDeleteIds } },
        });
      }

      let totalPieces = 0;
      let totalPayableCbm = 0;
      let totalReceivableCbm = 0;
      let totalWeightKg = 0;
      const finalItemsForFinancials: any[] = [];

      // 2. 按行精准 Upsert (修改已有行或插入新增行)
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const existingItem = item.id ? existingItemMap.get(item.id) : undefined;

        // 件数
        const qty = item.quantity && item.quantity > 0
          ? Number(item.quantity)
          : (existingItem?.quantity ? Number(existingItem.quantity) : 1);

        // 预报字段 (阶段 1 快照)
        const estQty = item.estimatedQuantity !== undefined && item.estimatedQuantity !== null
          ? Number(item.estimatedQuantity)
          : (existingItem?.estimatedQuantity !== undefined && existingItem?.estimatedQuantity !== null
              ? Number(existingItem.estimatedQuantity)
              : qty);

        const estL = item.estimatedLength !== undefined && item.estimatedLength !== null
          ? Number(item.estimatedLength)
          : (existingItem?.estimatedLength !== undefined && existingItem?.estimatedLength !== null
              ? Number(existingItem.estimatedLength)
              : (item.length !== undefined && item.length !== null ? Number(item.length) : null));

        const estW = item.estimatedWidth !== undefined && item.estimatedWidth !== null
          ? Number(item.estimatedWidth)
          : (existingItem?.estimatedWidth !== undefined && existingItem?.estimatedWidth !== null
              ? Number(existingItem.estimatedWidth)
              : (item.width !== undefined && item.width !== null ? Number(item.width) : null));

        const estH = item.estimatedHeight !== undefined && item.estimatedHeight !== null
          ? Number(item.estimatedHeight)
          : (existingItem?.estimatedHeight !== undefined && existingItem?.estimatedHeight !== null
              ? Number(existingItem.estimatedHeight)
              : (item.height !== undefined && item.height !== null ? Number(item.height) : null));

        const estWt = item.estimatedWeight !== undefined && item.estimatedWeight !== null
          ? Number(item.estimatedWeight)
          : (existingItem?.estimatedWeight !== undefined && existingItem?.estimatedWeight !== null
              ? Number(existingItem.estimatedWeight)
              : (item.unitWeight !== undefined && item.unitWeight !== null ? Number(item.unitWeight) : null));

        const estVol = (item.estimatedVolume !== undefined && item.estimatedVolume !== null && String(item.estimatedVolume).trim() !== '' && Number(item.estimatedVolume) > 0)
          ? Number(item.estimatedVolume)
          : (existingItem?.estimatedVolume !== undefined && existingItem?.estimatedVolume !== null && Number(existingItem.estimatedVolume) > 0
              ? Number(existingItem.estimatedVolume)
              : (estL && estW && estH ? (estL * estW * estH * estQty) / 1_000_000 : null));

        // 实测尺寸与长宽高 (阶段 2 实测)
        const l = item.length !== undefined && item.length !== null
          ? Number(item.length)
          : (existingItem?.length !== undefined && existingItem?.length !== null ? Number(existingItem.length) : null);

        const w = item.width !== undefined && item.width !== null
          ? Number(item.width)
          : (existingItem?.width !== undefined && existingItem?.width !== null ? Number(existingItem.width) : null);

        const h = item.height !== undefined && item.height !== null
          ? Number(item.height)
          : (existingItem?.height !== undefined && existingItem?.height !== null ? Number(existingItem.height) : null);

        const calcCbm = (l && w && h) ? (l * w * h * qty) / 1_000_000 : 0;

        // 实装/计费方数：若传入则优先使用；若未传入但已有历史实测方数则严格保留；否则根据长宽高计算
        let payableCbm = 0;
        if (item.payableVolume !== undefined && item.payableVolume !== null && String(item.payableVolume).trim() !== '' && Number(item.payableVolume) > 0) {
          payableCbm = Number(item.payableVolume);
        } else if (existingItem?.payableVolume !== undefined && existingItem?.payableVolume !== null && Number(existingItem.payableVolume) > 0) {
          payableCbm = Number(existingItem.payableVolume);
        } else {
          payableCbm = calcCbm;
        }

        let recvCbm = 0;
        if (item.receivableVolume !== undefined && item.receivableVolume !== null && String(item.receivableVolume).trim() !== '' && Number(item.receivableVolume) > 0) {
          recvCbm = Number(item.receivableVolume);
        } else if (existingItem?.receivableVolume !== undefined && existingItem?.receivableVolume !== null && Number(existingItem.receivableVolume) > 0) {
          recvCbm = Number(existingItem.receivableVolume);
        } else {
          recvCbm = payableCbm;
        }

        // 实测重量
        const unitWt = item.unitWeight !== undefined && item.unitWeight !== null
          ? Number(item.unitWeight)
          : (existingItem?.unitWeight !== undefined && existingItem?.unitWeight !== null ? Number(existingItem.unitWeight) : null);

        const totalWt = unitWt !== null ? unitWt * qty : (existingItem?.totalWeight ? Number(existingItem.totalWeight) : 0);

        const itemPayload: any = {
          waybillId: id,
          itemIndex: idx + 1,
          trackingNumber: item.trackingNumber !== undefined
            ? (item.trackingNumber ? String(item.trackingNumber).trim() : null)
            : (existingItem?.trackingNumber || null),
          productName: item.productName !== undefined
            ? (item.productName ? String(item.productName).trim() : '通用货物')
            : (existingItem?.productName || '通用货物'),
          quantity: qty,
          length: l,
          width: w,
          height: h,
          payableVolume: payableCbm > 0 ? payableCbm : null,
          receivableVolume: recvCbm > 0 ? recvCbm : null,
          unitWeight: unitWt,
          totalWeight: totalWt > 0 ? totalWt : null,
          estimatedQuantity: estQty,
          estimatedLength: estL,
          estimatedWidth: estW,
          estimatedHeight: estH,
          estimatedWeight: estWt,
          estimatedVolume: estVol,
          receivableCurrency: item.receivableCurrency || existingItem?.receivableCurrency || 'CNY',
          receivableUnitPrice: item.receivableUnitPrice !== undefined && item.receivableUnitPrice !== null
            ? Number(item.receivableUnitPrice)
            : (existingItem?.receivableUnitPrice ? Number(existingItem.receivableUnitPrice) : null),
          payableCurrency: item.payableCurrency || existingItem?.payableCurrency || 'CNY',
          payableUnitPrice: item.payableUnitPrice !== undefined && item.payableUnitPrice !== null
            ? Number(item.payableUnitPrice)
            : (existingItem?.payableUnitPrice ? Number(existingItem.payableUnitPrice) : null),
        };

        if (existingItem) {
          const updatedItem = await prisma.waybillItem.update({
            where: { id: existingItem.id },
            data: itemPayload,
          });
          finalItemsForFinancials.push(updatedItem);
        } else {
          const createdItem = await prisma.waybillItem.create({
            data: itemPayload,
          });
          finalItemsForFinancials.push(createdItem);
        }

        totalPieces += qty;
        totalPayableCbm += payableCbm;
        totalReceivableCbm += recvCbm;
        totalWeightKg += totalWt;
      }

      updateData.totalPieces = totalPieces;
      updateData.totalPayableCbm = totalPayableCbm;
      updateData.totalReceivableCbm = totalReceivableCbm;
      updateData.totalWeightKg = totalWeightKg;

      const financials = calculateWaybillFinancials({
        orderType: effectiveOrderType,
        isFixedPrice: effectiveIsFixed,
        fixedPriceAmount: effectiveFixedAmt,
        currentReceivableAmount: existingWb.receivableAmount ? Number(existingWb.receivableAmount) : undefined,
        items: finalItemsForFinancials as any,
        fees: existingWb.fees as any,
      });

      updateData.receivableAmount = financials.receivableAmount;
      updateData.payableAmount = financials.payableAmount;
      updateData.profitAmount = financials.profitAmount;
    } else if (updateData.isFixedPrice !== undefined || updateData.fixedPriceAmount !== undefined) {
      const financials = calculateWaybillFinancials({
        orderType: effectiveOrderType,
        isFixedPrice: effectiveIsFixed,
        fixedPriceAmount: effectiveFixedAmt,
        currentReceivableAmount: existingWb.receivableAmount ? Number(existingWb.receivableAmount) : undefined,
        items: existingWb.items as any,
        fees: existingWb.fees as any,
      });
      updateData.receivableAmount = financials.receivableAmount;
      updateData.payableAmount = financials.payableAmount;
      updateData.profitAmount = financials.profitAmount;
    }

    const updated = await prisma.waybill.update({
      where: { id },
      data: updateData,
      include: {
        items: { orderBy: { itemIndex: 'asc' } },
        fees: { orderBy: { createdAt: 'asc' } },
        attachments: { orderBy: { uploadedAt: 'desc' } },
        containerMaster: true,
      },
    });

    // 🔗 集装箱全部完结自动闭环与自愈引擎 (Auto-Completion & Auto-Healing Engine)
    if (updated.containerId) {
      if (updated.status === 'DELIVERED') {
        // 1. 自动完结检查：检索该货柜名下的所有拼箱运单
        const containerWaybills = await prisma.waybill.findMany({
          where: { containerId: updated.containerId },
          select: { id: true, status: true },
        });
        const isAllDelivered =
          containerWaybills.length > 0 && containerWaybills.every((w) => w.status === 'DELIVERED');
        if (isAllDelivered) {
          await prisma.containerMaster.update({
            where: { id: updated.containerId },
            data: { status: 'COMPLETED' },
          });
        }
      } else {
        // 2. 自愈回退检查：若某运单撤销签收或回退阶段（非 DELIVERED），而集装箱当前处于 COMPLETED，自动回退至 DISPATCHING
        const currentContainer = await prisma.containerMaster.findUnique({
          where: { id: updated.containerId },
          select: { status: true },
        });
        if (currentContainer?.status === 'COMPLETED') {
          await prisma.containerMaster.update({
            where: { id: updated.containerId },
            data: { status: 'DISPATCHING' },
          });
        }
      }
    }

    return updated;
  }

  async batchAssignContainer(waybillIds: string[], containerId: string, loadingDate?: Date | string) {
    const lDate = (loadingDate ? parseNullableDate(loadingDate) : undefined) || new Date();

    // 1. 对于待入库/草稿/已入库的初始运单，推进至 LOADED (进港报关)
    await prisma.waybill.updateMany({
      where: {
        id: { in: waybillIds },
        status: { in: [WaybillStatus.DRAFT, WaybillStatus.INBOUND] },
      },
      data: {
        containerId,
        loadingDate: lDate,
        status: WaybillStatus.LOADED,
      },
    });

    // 2. 对于已处于在途、清关、签收等更高阶段的运单，仅更新集装箱归属与装箱日，严禁回退状态
    return prisma.waybill.updateMany({
      where: {
        id: { in: waybillIds },
        status: { notIn: [WaybillStatus.DRAFT, WaybillStatus.INBOUND] },
      },
      data: {
        containerId,
        loadingDate: lDate,
      },
    });
  }

  async deleteWaybill(id: string) {
    return prisma.waybill.delete({
      where: { id },
    });
  }
}
