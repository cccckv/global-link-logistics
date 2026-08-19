import { PrismaClient, ShipmentType, WaybillStatus, CurrencyType, FeeDirection, AttachmentType } from '@prisma/client';

const prisma = new PrismaClient();

function generateWaybillNo(type: ShipmentType = 'SEA_LCL'): string {
  const prefix = type === 'AIR' ? 'AWB' : type === 'SEA_FCL' ? 'FCL' : 'LCL';
  const now = new Date();
  const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
  const randomStr = Math.floor(1000 + Math.random() * 9000).toString();
  return `${prefix}${dateStr}${randomStr}`;
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
  payableCurrency?: CurrencyType;
  payableUnitPrice?: number;
}

export interface CreateWaybillFeeInput {
  feeName: string;
  feeDirection: FeeDirection;
  amount: number;
  currency?: CurrencyType;
  exchangeRate?: number;
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

  let finalReceivable = baseReceivable;
  if (isFixedPrice) {
    if (fixedPriceAmount !== undefined && fixedPriceAmount !== null && Number(fixedPriceAmount) > 0) {
      finalReceivable = Number(fixedPriceAmount);
    } else if (currentReceivableAmount !== undefined && currentReceivableAmount !== null && Number(currentReceivableAmount) > 0) {
      finalReceivable = Number(currentReceivableAmount);
    }
  }

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
    baseReceivable: Math.round(baseReceivable * 100) / 100,
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

    return prisma.waybill.create({
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
        inboundDate: data.inboundDate ? new Date(data.inboundDate) : undefined,
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
  }

  async getWaybills(params: {
    orderType?: ShipmentType;
    status?: WaybillStatus;
    search?: string;
    containerId?: string;
    userMark?: string;
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
      userMark,
      startDate,
      endDate,
    } = params;


    const where: any = {};

    if (orderType) where.orderType = orderType;
    if (status) where.status = status;
    if (containerId) where.containerId = containerId;
    if (userMark) where.userMark = { contains: userMark, mode: 'insensitive' };

    if (search) {
      where.OR = [
        { waybillNo: { contains: search, mode: 'insensitive' } },
        { expressNo: { contains: search, mode: 'insensitive' } },
        { userMark: { contains: search, mode: 'insensitive' } },
        {
          items: {
            some: {
              OR: [
                { trackingNumber: { contains: search, mode: 'insensitive' } },
                { productName: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = eDate;
      }
    }

    const pageNum = Math.max(1, Number(params.page) || 1);
    const limitNum = Math.max(1, Number(params.limit) || 10);
    const skip = (pageNum - 1) * limitNum;

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
        customer: true,
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

    if (data.inboundDate) updateData.inboundDate = new Date(data.inboundDate);
    if (data.loadingDate) updateData.loadingDate = new Date(data.loadingDate);
    if (data.sailingDate) updateData.sailingDate = new Date(data.sailingDate);
    if (data.eta) updateData.eta = new Date(data.eta);
    if (data.clearanceDate) updateData.clearanceDate = new Date(data.clearanceDate);
    if (data.signedDate) updateData.signedDate = new Date(data.signedDate);

    const existingWb = await prisma.waybill.findUnique({
      where: { id },
      include: { fees: true, items: true },
    });
    if (!existingWb) throw new Error('Waybill not found');

    const effectiveOrderType = updateData.orderType || existingWb.orderType;
    const effectiveIsFixed = updateData.isFixedPrice !== undefined ? updateData.isFixedPrice : existingWb.isFixedPrice;
    const effectiveFixedAmt = updateData.fixedPriceAmount !== undefined ? updateData.fixedPriceAmount : existingWb.fixedPriceAmount;

    if (items && items.length > 0) {
      await prisma.waybillItem.deleteMany({ where: { waybillId: id } });

      let totalPieces = 0;
      let totalPayableCbm = 0;
      let totalReceivableCbm = 0;
      let totalWeightKg = 0;

      const newItems = items.map((item: any, idx: number) => {
        const qty = item.quantity && item.quantity > 0 ? Number(item.quantity) : 1;
        const l = Number(item.length) || 0;
        const w = Number(item.width) || 0;
        const h = Number(item.height) || 0;
        const payableCbm = (l * w * h * qty) / 1_000_000;
        const recvCbm = item.receivableVolume ? Number(item.receivableVolume) : payableCbm;
        const unitWt = item.unitWeight ? Number(item.unitWeight) : 0;
        const totalWt = unitWt * qty;

        totalPieces += qty;
        totalPayableCbm += payableCbm;
        totalReceivableCbm += recvCbm;
        totalWeightKg += totalWt;

        const estQty = item.estimatedQuantity !== undefined && item.estimatedQuantity !== null ? Number(item.estimatedQuantity) : qty;
        const estL = item.estimatedLength !== undefined && item.estimatedLength !== null ? Number(item.estimatedLength) : (item.length !== undefined && item.length !== null ? Number(item.length) : null);
        const estW = item.estimatedWidth !== undefined && item.estimatedWidth !== null ? Number(item.estimatedWidth) : (item.width !== undefined && item.width !== null ? Number(item.width) : null);
        const estH = item.estimatedHeight !== undefined && item.estimatedHeight !== null ? Number(item.estimatedHeight) : (item.height !== undefined && item.height !== null ? Number(item.height) : null);
        const estWt = item.estimatedWeight !== undefined && item.estimatedWeight !== null ? Number(item.estimatedWeight) : (item.unitWeight !== undefined && item.unitWeight !== null ? Number(item.unitWeight) : null);
        const estVol = item.estimatedVolume !== undefined && item.estimatedVolume !== null
          ? Number(item.estimatedVolume)
          : (estL && estW && estH ? (estL * estW * estH * estQty) / 1_000_000 : null);

        return {
          waybillId: id,
          itemIndex: idx + 1,
          trackingNumber: item.trackingNumber ? String(item.trackingNumber).trim() : null,
          productName: item.productName ? String(item.productName).trim() : '通用货物',
          quantity: qty,
          length: item.length !== undefined && item.length !== null ? Number(item.length) : null,
          width: item.width !== undefined && item.width !== null ? Number(item.width) : null,
          height: item.height !== undefined && item.height !== null ? Number(item.height) : null,
          payableVolume: payableCbm > 0 ? payableCbm : null,
          receivableVolume: recvCbm > 0 ? recvCbm : null,
          unitWeight: item.unitWeight !== undefined && item.unitWeight !== null ? Number(item.unitWeight) : null,
          totalWeight: totalWt > 0 ? totalWt : null,
          estimatedQuantity: estQty,
          estimatedLength: estL,
          estimatedWidth: estW,
          estimatedHeight: estH,
          estimatedWeight: estWt,
          estimatedVolume: estVol,
          receivableCurrency: item.receivableCurrency || 'CNY',
          receivableUnitPrice: item.receivableUnitPrice !== undefined && item.receivableUnitPrice !== null ? Number(item.receivableUnitPrice) : null,
          payableCurrency: item.payableCurrency || 'CNY',
          payableUnitPrice: item.payableUnitPrice !== undefined && item.payableUnitPrice !== null ? Number(item.payableUnitPrice) : null,
        };
      });

      await prisma.waybillItem.createMany({ data: newItems });


      updateData.totalPieces = totalPieces;
      updateData.totalPayableCbm = totalPayableCbm;
      updateData.totalReceivableCbm = totalReceivableCbm;
      updateData.totalWeightKg = totalWeightKg;

      const financials = calculateWaybillFinancials({
        orderType: effectiveOrderType,
        isFixedPrice: effectiveIsFixed,
        fixedPriceAmount: effectiveFixedAmt,
        currentReceivableAmount: existingWb.receivableAmount ? Number(existingWb.receivableAmount) : undefined,
        items: newItems as any,
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

    return prisma.waybill.update({
      where: { id },
      data: updateData,
      include: {
        items: { orderBy: { itemIndex: 'asc' } },
        fees: { orderBy: { createdAt: 'asc' } },
        attachments: { orderBy: { uploadedAt: 'desc' } },
        containerMaster: true,
      },
    });
  }

  async batchAssignContainer(waybillIds: string[], containerId: string, loadingDate?: Date | string) {
    const lDate = loadingDate ? new Date(loadingDate) : new Date();
    return prisma.waybill.updateMany({
      where: { id: { in: waybillIds } },
      data: {
        containerId,
        loadingDate: lDate,
        status: 'LOADED',
      },
    });
  }

  async deleteWaybill(id: string) {
    return prisma.waybill.delete({
      where: { id },
    });
  }
}
