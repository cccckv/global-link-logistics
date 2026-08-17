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
  trackingNumber?: string;
  productName: string;
  quantity?: number;
  length?: number;
  width?: number;
  height?: number;
  unitWeight?: number;
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
  voyageNumber?: string;
  airWaybillNo?: string;
  note?: string;
  isFixedPrice?: boolean;
  fixedPriceAmount?: number;

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

export class WaybillV2Service {
  async createWaybill(data: CreateWaybillInput) {
    const waybillNo = generateWaybillNo(data.orderType);

    // Auto-link customer by userMark
    let customerId: string | undefined;
    const customer = await prisma.customer.findUnique({
      where: { clientCode: data.userMark },
    });
    if (customer) {
      customerId = customer.id;
    }

    // Process items & calculations
    let totalPieces = 0;
    let totalPayableCbm = 0;
    let totalReceivableCbm = 0;
    let totalWeightKg = 0;
    let baseReceivable = 0;
    let basePayable = 0;

    const processedItems = data.items.map((item, idx) => {
      const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;
      totalPieces += qty;

      let payableVol = 0;
      let receivableVol = 0;
      if (item.length && item.width && item.height) {
        payableVol = (item.length * item.width * item.height * qty) / 1_000_000;
        receivableVol = payableVol; // Can be adjusted
      }
      totalPayableCbm += payableVol;
      totalReceivableCbm += receivableVol;

      if (item.unitWeight) {
        totalWeightKg += item.unitWeight * qty;
      }

      // Compute pricing
      const recvPrice = item.receivableUnitPrice || 0;
      const payPrice = item.payableUnitPrice || 0;

      if (data.orderType === 'AIR') {
        const wt = item.unitWeight || 0;
        baseReceivable += recvPrice * wt * qty;
        basePayable += payPrice * wt * qty;
      } else {
        baseReceivable += recvPrice * receivableVol;
        basePayable += payPrice * payableVol;
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

    let finalReceivable = data.isFixedPrice && data.fixedPriceAmount ? data.fixedPriceAmount : baseReceivable;
    let finalPayable = basePayable;

    // Process fees
    const feesToCreate: any[] = [];
    if (data.fees && data.fees.length > 0) {
      data.fees.forEach(fee => {
        const rate = fee.exchangeRate || 1.0;
        const cnyAmount = fee.amount * rate;
        if (fee.feeDirection === 'RECEIVABLE') {
          finalReceivable += cnyAmount;
        } else {
          finalPayable += cnyAmount;
        }
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

    const profit = finalReceivable - finalPayable;

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
        receivableAmount: finalReceivable,
        payableAmount: finalPayable,
        profitAmount: profit,

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
        customer: true,
      },
    });
  }

  async getWaybills(params?: {
    orderType?: ShipmentType;
    status?: WaybillStatus;
    search?: string;
    containerId?: string;
    userMark?: string;
    customsType?: string;
    forwarderChannel?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params?.page) || 1);
    const limit = Math.max(1, Number(params?.limit) || 20);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params?.orderType) where.orderType = params.orderType;
    if (params?.status) where.status = params.status;
    if (params?.containerId) where.containerId = params.containerId;
    if (params?.customsType) where.customsType = params.customsType;
    if (params?.forwarderChannel) where.forwarderChannel = params.forwarderChannel;
    if (params?.userMark) where.userMark = { contains: params.userMark, mode: 'insensitive' };

    if (params?.search) {
      const q = params.search;
      where.OR = [
        { waybillNo: { contains: q, mode: 'insensitive' } },
        { userMark: { contains: q, mode: 'insensitive' } },
        { expressNo: { contains: q, mode: 'insensitive' } },
        { customsType: { contains: q, mode: 'insensitive' } },
        { forwarderChannel: { contains: q, mode: 'insensitive' } },
        { airWaybillNo: { contains: q, mode: 'insensitive' } },
        { recipientPhone: { contains: q } },
        { overseasPhone: { contains: q } },
        { items: { some: { trackingNumber: { contains: q, mode: 'insensitive' } } } },
        { items: { some: { productName: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    if (params?.startDate || params?.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = new Date(params.startDate);
      if (params.endDate) where.createdAt.lte = new Date(params.endDate);
    }

    const [data, total] = await Promise.all([
      prisma.waybill.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          fees: true,
          attachments: true,
          containerMaster: true,
          customer: true,
        },
      }),
      prisma.waybill.count({ where }),
    ]);

    // Status counts
    const statusCounts = await prisma.waybill.groupBy({
      by: ['status'],
      where: params?.orderType ? { orderType: params.orderType } : {},
      _count: { id: true },
    });

    const countsMap = statusCounts.reduce((acc, curr) => {
      acc[curr.status] = curr._count.id;
      return acc;
    }, {} as Record<string, number>);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
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

    // If items are provided for re-calculation
    if (items && items.length > 0) {
      await prisma.waybillItem.deleteMany({ where: { waybillId: id } });

      let totalPieces = 0;
      let totalPayableCbm = 0;
      let totalReceivableCbm = 0;
      let totalWeightKg = 0;

      const newItems = items.map((item: any, idx: number) => {
        const qty = item.quantity && item.quantity > 0 ? Number(item.quantity) : 1;
        totalPieces += qty;

        let payableVol = 0;
        let receivableVol = 0;
        if (item.length && item.width && item.height) {
          payableVol = (Number(item.length) * Number(item.width) * Number(item.height) * qty) / 1_000_000;
          receivableVol = payableVol;
        }
        totalPayableCbm += payableVol;
        totalReceivableCbm += receivableVol;

        if (item.unitWeight) {
          totalWeightKg += Number(item.unitWeight) * qty;
        }

        const estQty = item.estimatedQuantity !== undefined && item.estimatedQuantity !== null
          ? Number(item.estimatedQuantity)
          : qty;
        const estL = item.estimatedLength !== undefined && item.estimatedLength !== null
          ? Number(item.estimatedLength)
          : (item.length !== undefined && item.length !== null ? Number(item.length) : undefined);
        const estW = item.estimatedWidth !== undefined && item.estimatedWidth !== null
          ? Number(item.estimatedWidth)
          : (item.width !== undefined && item.width !== null ? Number(item.width) : undefined);
        const estH = item.estimatedHeight !== undefined && item.estimatedHeight !== null
          ? Number(item.estimatedHeight)
          : (item.height !== undefined && item.height !== null ? Number(item.height) : undefined);
        const estWt = item.estimatedWeight !== undefined && item.estimatedWeight !== null
          ? Number(item.estimatedWeight)
          : (item.unitWeight !== undefined && item.unitWeight !== null ? Number(item.unitWeight) : undefined);
        const estVol = estL && estW && estH
          ? (estL * estW * estH * estQty) / 1_000_000
          : (item.estimatedVolume ? Number(item.estimatedVolume) : (payableVol > 0 ? payableVol : undefined));

        return {
          waybillId: id,
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
          length: item.length !== undefined && item.length !== null ? Number(item.length) : undefined,
          width: item.width !== undefined && item.width !== null ? Number(item.width) : undefined,
          height: item.height !== undefined && item.height !== null ? Number(item.height) : undefined,
          payableVolume: payableVol > 0 ? payableVol : undefined,
          receivableVolume: receivableVol > 0 ? receivableVol : undefined,
          unitWeight: item.unitWeight !== undefined && item.unitWeight !== null ? Number(item.unitWeight) : undefined,
          totalWeight: item.unitWeight ? Number(item.unitWeight) * qty : undefined,
          receivableCurrency: item.receivableCurrency || 'CNY',
          receivableUnitPrice: item.receivableUnitPrice !== undefined && item.receivableUnitPrice !== null ? Number(item.receivableUnitPrice) : undefined,
          payableCurrency: item.payableCurrency || 'CNY',
          payableUnitPrice: item.payableUnitPrice !== undefined && item.payableUnitPrice !== null ? Number(item.payableUnitPrice) : undefined,
        };
      });

      await prisma.waybillItem.createMany({ data: newItems });

      updateData.totalPieces = totalPieces;
      updateData.totalPayableCbm = totalPayableCbm;
      updateData.totalReceivableCbm = totalReceivableCbm;
      updateData.totalWeightKg = totalWeightKg;
    }

    return prisma.waybill.update({
      where: { id },
      data: updateData,
      include: {
        items: true,
        fees: true,
        attachments: true,
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
