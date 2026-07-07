import { PrismaClient, QuickOrderType, QuickOrderStatus, Prisma } from '@prisma/client';
import { ContactService } from './contact.service';

const prisma = new PrismaClient();
const contactService = new ContactService();

// ============================================
// Types & Interfaces
// ============================================

interface CreateQuickOrderInput {
  orderType: QuickOrderType;
  warehouse?: string;
  destination: string;
  note?: string;
  userMark?: string;
  mark?: string;
  originPort?: string;
  destinationPort?: string;
  voyageNumber?: string;
  airWaybillNumber?: string;
  billOfLading?: string;
  containerNumber?: string;
  bookingChannel?: string;
  customsDeclarationChannel?: string;
  customsClearanceChannel?: string;
  loadingDate?: string;
  eta?: string;
  markUserId?: string;
  batchTaskId?: string;
  receivedAt?: string;
  overseasReceivedAt?: string;
  receipts?: { receiptUrl: string; receiptFileName: string }[];
  receiptUrl?: string;
  receiptFileName?: string;
  overseasReceipts?: { receiptUrl: string; receiptFileName: string }[];
  carPickupReceivable?: number;
  carPickupActual?: number;
  portGateFee?: number;
  truckingFee?: number;
  customsCertFee?: number;
  bookingFee?: number;
  thcOverstayFee?: number;
  totalShippingDays?: number;
  
  recipientAddress: {    name: string;
    company?: string;
    phone: string;
    region?: string;
    address: string;
  };

  overseasAddress?: {
    name: string;
    company?: string;
    phone: string;
    region?: string;
    address: string;
  };
  
  declarations?: Array<{
    trackingNumber?: string;
    productName: string;
    quantity: number;
    length?: number;
    width?: number;
    height?: number;
    weight: number;
    cnyUnitPrice?: number;
    phpUnitPrice?: number;
    channelUnitPricePhp?: number;
    channelUnitPriceCny?: number;
  }>;
  
  containers?: Array<{
    containerType: 'GP_20' | 'GP_40' | 'HQ_40' | 'HQ_45';
    quantity: number;
    weight?: number;
    productsJson?: string;
  }>;
}

interface QuickOrderFilters {
  orderType?: QuickOrderType;
  status?: QuickOrderStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  searchType?: 'trackingNumber' | 'orderNumber' | 'productName' | 'warehouseNumber';
  keyword?: string;
  mark?: string;
  warehouse?: string;
  exportAll?: boolean;
}

// ============================================
// QuickOrder Service
// ============================================

export class QuickOrderService {
  /**
   * 生成订单号
   * 格式: GL{timestamp}{random}
   */
  private generateOrderNumber(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `WH${timestamp}${random}`;
  }

  /**
   * 构建搜索条件
   */
  private buildSearchCondition(searchType: string, keyword: string): Prisma.QuickOrderWhereInput {
    const search = { contains: keyword, mode: 'insensitive' as const };
    
    switch (searchType) {
      case 'orderNumber':
        return { orderNumber: search };
      case 'trackingNumber':
        return { 
          OR: [
            { declarations: { some: { trackingNumber: search } } },
          ],
        };
      case 'productName':
        return { declarations: { some: { productName: search } } };
      case 'warehouseNumber':
        return { warehouse: search };
      default:
        return {};
    }
  }

  /**
   * 创建快速订单
   */
  async create(userId: string, input: CreateQuickOrderInput) {
    const orderNumber = this.generateOrderNumber();

    // 准备申报明细数据
    const declarationsData = input.declarations?.map(d => ({
      trackingNumber: d.trackingNumber,
      productName: d.productName,
      quantity: d.quantity,
      length: d.length ? new Prisma.Decimal(d.length) : null,
      width: d.width ? new Prisma.Decimal(d.width) : null,
      height: d.height ? new Prisma.Decimal(d.height) : null,
      weight: d.weight != null ? new Prisma.Decimal(d.weight) : new Prisma.Decimal(0),
      cnyUnitPrice: d.cnyUnitPrice ? new Prisma.Decimal(d.cnyUnitPrice) : null,
      phpUnitPrice: d.phpUnitPrice ? new Prisma.Decimal(d.phpUnitPrice) : null,
      channelUnitPricePhp: d.channelUnitPricePhp ? new Prisma.Decimal(d.channelUnitPricePhp) : null,
      channelUnitPriceCny: d.channelUnitPriceCny ? new Prisma.Decimal(d.channelUnitPriceCny) : null,
    })) || [];

    // 准备整柜明细数据
    const containersData = input.containers?.map(c => ({
      containerType: c.containerType,
      quantity: c.quantity,
      weight: c.weight ? new Prisma.Decimal(c.weight) : null,
      productsJson: c.productsJson,
    })) || [];

    let recipientAddressId: string;
    let overseasAddressId: string | undefined;

    const recipientAddr = await contactService.upsertRecipientAddress(userId, input.recipientAddress);
    recipientAddressId = recipientAddr.id;

    if (input.overseasAddress) {
      const overseasAddr = await contactService.upsertOverseasAddress(input.markUserId || userId, input.overseasAddress);
      overseasAddressId = overseasAddr.id;
    }

    const order = await prisma.quickOrder.create({
      data: {
        orderNumber,
        userId,
        orderType: input.orderType,
        warehouse: input.warehouse,
        destination: input.destination,
        note: input.note,
        userMark: input.userMark,
        mark: input.mark,
        originPort: input.originPort,
        destinationPort: input.destinationPort,
        voyageNumber: input.voyageNumber,
        airWaybillNumber: input.airWaybillNumber,
        billOfLading: input.billOfLading,
        containerNumber: input.containerNumber,
        bookingChannel: input.bookingChannel,
        customsDeclarationChannel: input.customsDeclarationChannel,
        customsClearanceChannel: input.customsClearanceChannel,
        loadingDate: input.loadingDate ? new Date(input.loadingDate) : undefined,
        eta: input.eta ? new Date(input.eta) : undefined,
        totalShippingDays: input.totalShippingDays ?? undefined,
        markUserId: input.markUserId,
        batchTaskId: input.batchTaskId,
        receivedAt: input.receivedAt ? new Date(input.receivedAt) : undefined,
        overseasReceivedAt: input.overseasReceivedAt ? new Date(input.overseasReceivedAt) : undefined,
        status: 'LOADING',
        
        recipientAddressId,
        overseasAddressId,
        
        declarations: declarationsData.length > 0 ? {
          create: declarationsData,
        } : undefined,
        
        containers: containersData.length > 0 ? {
          create: containersData,
        } : undefined,
      },
      include: {
        recipientAddress: true,
        overseasAddress: true,
        declarations: true,
        containers: true,
      },
    });

    const receiptsToCreate = input.receipts && input.receipts.length > 0
      ? input.receipts
      : (input.receiptUrl && input.receiptFileName ? [{ receiptUrl: input.receiptUrl, receiptFileName: input.receiptFileName }] : []);

    if (receiptsToCreate.length > 0) {
      await prisma.orderPaymentVoucher.createMany({
        data: receiptsToCreate.map(r => ({
          orderId: order.id,
          fileUrl: r.receiptUrl,
          fileName: r.receiptFileName,
          voucherType: 'RECEIPT',
        })),
      });
    }

    if (input.overseasReceipts && input.overseasReceipts.length > 0) {
      await prisma.orderPaymentVoucher.createMany({
        data: input.overseasReceipts.map(r => ({
          orderId: order.id,
          fileUrl: r.receiptUrl,
          fileName: r.receiptFileName,
          voucherType: 'OVERSEAS_RECEIPT',
        })),
      });
    }

    if (declarationsData.length > 0) {
      const decls = input.declarations!;
      const totalPieces = decls.reduce((s, d) => s + (d.quantity || 1), 0);
      const totalWeight = decls.reduce((s, d) => s + (d.weight || 0) * (d.quantity || 1), 0);
      const totalVolume = decls.reduce((s, d) => {
        if (d.length && d.width && d.height) {
          return s + (d.length * d.width * d.height / 1_000_000) * (d.quantity || 1);
        }
        return s;
      }, 0);
      const isSeaLcl = input.orderType === 'SEA_LCL';
      const isSeaFcl = input.orderType === 'SEA_FCL';
      const receivableUsePhp = decls.some(d => !!d.phpUnitPrice);
      const payableUsePhp = decls.some(d => !!d.channelUnitPricePhp);
      const receivableAmount = isSeaFcl
        ? decls.reduce((s, d) => s + (receivableUsePhp ? (d.phpUnitPrice || 0) : (d.cnyUnitPrice || 0)), 0)
        : decls.reduce((s, d) => {
            const price = receivableUsePhp ? (d.phpUnitPrice || 0) : (d.cnyUnitPrice || 0);
            const factor = isSeaLcl
              ? (d.length && d.width && d.height ? (d.length * d.width * d.height / 1_000_000) : 0)
              : (d.weight || 0);
            return s + price * factor * (d.quantity || 1);
          }, 0);
      const payableAmount = isSeaFcl
        ? decls.reduce((s, d) => s + (payableUsePhp ? (d.channelUnitPricePhp || 0) : (d.channelUnitPriceCny || 0)), 0)
        : decls.reduce((s, d) => {
            const price = payableUsePhp ? (d.channelUnitPricePhp || 0) : (d.channelUnitPriceCny || 0);
            const factor = isSeaLcl
              ? (d.length && d.width && d.height ? (d.length * d.width * d.height / 1_000_000) : 0)
              : (d.weight || 0);
            return s + price * factor * (d.quantity || 1);
          }, 0);

      await prisma.orderPaymentCollection.create({
        data: {
          orderId: order.id,
          totalPieces,
          totalWeight: new Prisma.Decimal(totalWeight),
          totalVolume: totalVolume > 0 ? new Prisma.Decimal(totalVolume) : null,
          receivableAmount: new Prisma.Decimal(receivableAmount),
          payableAmount: new Prisma.Decimal(payableAmount),
          receivableCurrency: receivableUsePhp ? 'PHP' : 'CNY',
          payableCurrency: payableUsePhp ? 'PHP' : 'CNY',
          carPickupReceivable: input.carPickupReceivable ? new Prisma.Decimal(input.carPickupReceivable) : null,
          carPickupActual: input.carPickupActual ? new Prisma.Decimal(input.carPickupActual) : null,
          portGateFee: input.portGateFee ? new Prisma.Decimal(input.portGateFee) : null,
          truckingFee: input.truckingFee ? new Prisma.Decimal(input.truckingFee) : null,
          customsCertFee: input.customsCertFee ? new Prisma.Decimal(input.customsCertFee) : null,
          bookingFee: input.bookingFee ? new Prisma.Decimal(input.bookingFee) : null,
          thcOverstayFee: input.thcOverstayFee ? new Prisma.Decimal(input.thcOverstayFee) : null,
        },
      });
    }

    return order;
  }

  /**
   * 获取订单列表（分页 + 筛选）
   */
  async findAll(userId: string, filters: QuickOrderFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.QuickOrderWhereInput = {
      userId,
      ...(filters.orderType && { orderType: filters.orderType }),
      ...(filters.status && { status: filters.status }),
      ...(filters.startDate || filters.endDate ? {
        createdAt: {
          ...(filters.startDate && { gte: new Date(filters.startDate) }),
          ...(filters.endDate && { lte: new Date(filters.endDate) }),
        },
      } : {}),
      
      ...(filters.mark && {
        OR: [
          { mark: { contains: filters.mark, mode: 'insensitive' } },
          { userMark: { contains: filters.mark, mode: 'insensitive' } },
        ],
      }),
      
      ...(filters.warehouse && { warehouse: { contains: filters.warehouse, mode: 'insensitive' as const } }),
      
      ...(filters.searchType && filters.keyword && this.buildSearchCondition(filters.searchType, filters.keyword)),
    };

    const include = {
      recipientAddress: true,
      overseasAddress: true,
      declarations: true,
      containers: true,
      shipment: true,
      payment: true,
      paymentCollections: true,
    } as const;

    const [orders, total] = await Promise.all([
      filters.exportAll
        ? prisma.quickOrder.findMany({ where, include, orderBy: { createdAt: 'desc' } })
        : prisma.quickOrder.findMany({ where, include, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.quickOrder.count({ where }),
    ]);

    return {
      data: orders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 获取订单详情
   */
  async findOne(id: string, userId: string) {
    const order = await prisma.quickOrder.findFirst({
      where: { id, userId },
      include: {
        recipientAddress: true,
        overseasAddress: true,
        declarations: {
          orderBy: { createdAt: 'asc' },
        },
        containers: {
          orderBy: { createdAt: 'asc' },
        },
        shipment: {
          include: {
            events: {
              orderBy: { timestamp: 'desc' },
            },
          },
        },
        payment: true,
        batchTask: true,
        paymentVouchers: {
          orderBy: { uploadedAt: 'desc' },
        },
        paymentCollections: true,
      },
    });

    return order;
  }

  /**
   * 更新订单
   */
  async update(id: string, userId: string | null, data: {
    status?: QuickOrderStatus;
    note?: string;
    voyageNumber?: string;
    airWaybillNumber?: string;
    billOfLading?: string;
    containerNumber?: string;
    bookingChannel?: string;
    customsDeclarationChannel?: string;
    customsClearanceChannel?: string;
    loadingDate?: string;
    eta?: string;
    totalShippingDays?: number | null;
    destination?: string;
    warehouse?: string;
    mark?: string;
    userMark?: string;
    markUserId?: string;
    receivedAt?: string;
    overseasReceivedAt?: string;
    recipientAddress?: {
      name: string;
      company?: string;
      phone: string;
      region?: string;
      address: string;
    };
    overseasAddress?: {
      name: string;
      company?: string;
      phone: string;
      region?: string;
      address: string;
    } | null;
  }) {
    // 验证权限：userId 为 null 时跳过（管理员操作）
    const order = await prisma.quickOrder.findFirst({
      where: userId ? { id, userId } : { id },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // 同步更新地址本（用订单原始 owner 的 userId）
    const ownerUserId = order.userId;
    let recipientAddressId: string | undefined;
    let overseasAddressId: string | undefined | null;

    if (data.recipientAddress) {
      const addr = await contactService.upsertRecipientAddress(ownerUserId, data.recipientAddress);
      recipientAddressId = addr.id;
    }

    if (data.overseasAddress !== undefined) {
      if (data.overseasAddress === null) {
        overseasAddressId = null;
      } else {
        const addr = await contactService.upsertOverseasAddress(ownerUserId, data.overseasAddress);
        overseasAddressId = addr.id;
      }
    }

    const { recipientAddress: _ra, overseasAddress: _oa, ...scalarData } = data;

    const updatePayload: any = { ...scalarData };
    if (data.loadingDate !== undefined) updatePayload.loadingDate = data.loadingDate ? new Date(data.loadingDate) : null;
    if (data.eta !== undefined) updatePayload.eta = data.eta ? new Date(data.eta) : null;
    if (data.receivedAt !== undefined) updatePayload.receivedAt = data.receivedAt ? new Date(data.receivedAt) : null;
    if (data.overseasReceivedAt !== undefined) updatePayload.overseasReceivedAt = data.overseasReceivedAt ? new Date(data.overseasReceivedAt) : null;
    if (recipientAddressId !== undefined) updatePayload.recipientAddressId = recipientAddressId;
    if (overseasAddressId !== undefined) updatePayload.overseasAddressId = overseasAddressId;

    const updated = await prisma.quickOrder.update({
      where: { id },
      data: updatePayload,
      include: {
        recipientAddress: true,
        overseasAddress: true,
        declarations: true,
        containers: true,
      },
    });

    return updated;
  }

  /**
   * 取消订单
   */
  async hardDelete(id: string): Promise<{ orderId: string; orderNumber: string }> {
    const order = await prisma.quickOrder.findUnique({ where: { id }, select: { id: true, orderNumber: true } });
    if (!order) throw new Error('Order not found');

    const shipment = await prisma.shipment.findFirst({ where: { quickOrderId: id }, select: { id: true } });
    if (shipment) {
      await prisma.trackingEvent.deleteMany({ where: { shipmentId: shipment.id } });
      await prisma.shipment.delete({ where: { id: shipment.id } });
    }

    await prisma.quickOrder.delete({ where: { id } });

    return { orderId: id, orderNumber: order.orderNumber };
  }

  async cancel(id: string, userId: string) {    // 验证权限和状态
    const order = await prisma.quickOrder.findFirst({
      where: { id, userId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status !== 'LOADING') {
      throw new Error('Only loading orders can be cancelled');
    }

    const cancelled = await prisma.quickOrder.update({
      where: { id },
      data: { status: 'LOADING' },
    });

    return cancelled;
  }

  /**
   * 获取各状态订单数量统计
   */
  async getStatusCounts(userId: string) {
    const [all, loading, sailing, arrived, customs, dispatching] = await Promise.all([
      prisma.quickOrder.count({ where: { userId } }),
      prisma.quickOrder.count({ where: { userId, status: 'LOADING' } }),
      prisma.quickOrder.count({ where: { userId, status: 'SAILING' } }),
      prisma.quickOrder.count({ where: { userId, status: 'ARRIVED' } }),
      prisma.quickOrder.count({ where: { userId, status: 'CUSTOMS' } }),
      prisma.quickOrder.count({ where: { userId, status: 'DISPATCHING' } }),
    ]);

    return {
      all,
      loading,
      sailing,
      arrived,
      customs,
      dispatching,
    };
  }

  async batchUpdateStatus(orderIds: string[], status: QuickOrderStatus): Promise<{ updatedCount: number; updatedIds: string[] }> {
    if (!orderIds.length) return { updatedCount: 0, updatedIds: [] };

    const deduped = [...new Set(orderIds)].slice(0, 200);

    await prisma.$transaction(
      deduped.map(id =>
        prisma.quickOrder.update({
          where: { id },
          data: { status },
        })
      )
    );

    return { updatedCount: deduped.length, updatedIds: deduped };
  }
}
