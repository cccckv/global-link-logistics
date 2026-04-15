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
  batchTaskId?: string;
  
  pickupAddress?: {
    name: string;
    company?: string;
    phone: string;
    region?: string;
    address: string;
  };
  
  recipientAddress: {
    name: string;
    company?: string;
    phone: string;
    region?: string;
    address: string;
  };
  
  declarations?: Array<{
    trackingNumber?: string;
    productName: string;
    length?: number;
    width?: number;
    height?: number;
    weight: number;
    cnyUnitPrice?: number;
    phpUnitPrice?: number;
    channelUnitPricePhp?: number;
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
    return `GL${timestamp}${random}`;
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
    if (input.declarations && input.declarations.length > 0) {
      const missingChannelPrice = input.declarations.some(d => d.channelUnitPricePhp === undefined || d.channelUnitPricePhp === null);
      if (missingChannelPrice) {
        throw new Error('每条申报信息必须填写渠道单价');
      }
    }

    const declarationsData = input.declarations?.map(d => ({
      trackingNumber: d.trackingNumber,
      productName: d.productName,
      length: d.length ? new Prisma.Decimal(d.length) : null,
      width: d.width ? new Prisma.Decimal(d.width) : null,
      height: d.height ? new Prisma.Decimal(d.height) : null,
      weight: new Prisma.Decimal(d.weight),
      cnyUnitPrice: d.cnyUnitPrice ? new Prisma.Decimal(d.cnyUnitPrice) : null,
      phpUnitPrice: d.phpUnitPrice ? new Prisma.Decimal(d.phpUnitPrice) : null,
    })) || [];

    // 准备整柜明细数据
    const containersData = input.containers?.map(c => ({
      containerType: c.containerType,
      quantity: c.quantity,
      weight: c.weight ? new Prisma.Decimal(c.weight) : null,
      productsJson: c.productsJson,
    })) || [];

    let pickupAddressId: string | undefined;
    let recipientAddressId: string;

    if (input.pickupAddress) {
      const pickupAddr = await contactService.upsertPickupAddress(userId, input.pickupAddress);
      pickupAddressId = pickupAddr.id;
    }

    const recipientAddr = await contactService.upsertRecipientAddress(userId, input.recipientAddress);
    recipientAddressId = recipientAddr.id;

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
        batchTaskId: input.batchTaskId,
        status: 'PENDING',
        
        pickupAddressId,
        recipientAddressId,
        
        declarations: declarationsData.length > 0 ? {
          create: declarationsData,
        } : undefined,
        
        containers: containersData.length > 0 ? {
          create: containersData,
        } : undefined,
      },
      include: {
        pickupAddress: true,
        recipientAddress: true,
        declarations: true,
        containers: true,
      },
    });

    if (order.declarations.length > 0 && input.declarations) {
      const channelPriceMap = new Map(
        input.declarations.map((d, idx) => [idx, d.channelUnitPricePhp])
      );
      
      await prisma.orderPaymentCollection.createMany({
        data: order.declarations.map((declaration, idx) => ({
          orderId: order.id,
          declarationId: declaration.id,
          channelUnitPricePhp: channelPriceMap.get(idx) ? new Prisma.Decimal(channelPriceMap.get(idx)!) : new Prisma.Decimal(0),
          receivableFreightAmount: new Prisma.Decimal(0),
          receivableOtherAmount: new Prisma.Decimal(0),
          actualReceivedAmount: new Prisma.Decimal(0),
          channelFreightCost: new Prisma.Decimal(0),
          channelOtherCost: new Prisma.Decimal(0),
          profit: new Prisma.Decimal(0),
        })),
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
      
      ...(filters.searchType && filters.keyword && this.buildSearchCondition(filters.searchType, filters.keyword)),
    };

    const [orders, total] = await Promise.all([
      prisma.quickOrder.findMany({
        where,
        include: {
          pickupAddress: true,
          recipientAddress: true,
          declarations: true,
          containers: true,
          shipment: true,
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
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
        pickupAddress: true,
        recipientAddress: true,
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
  async update(id: string, userId: string, data: {
    status?: QuickOrderStatus;
    note?: string;
  }) {
    // 验证权限
    const order = await prisma.quickOrder.findFirst({
      where: { id, userId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // 更新订单
    const updated = await prisma.quickOrder.update({
      where: { id },
      data,
      include: {
        pickupAddress: true,
        recipientAddress: true,
        declarations: true,
        containers: true,
      },
    });

    return updated;
  }

  /**
   * 取消订单
   */
  async cancel(id: string, userId: string) {
    // 验证权限和状态
    const order = await prisma.quickOrder.findFirst({
      where: { id, userId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status !== 'PENDING') {
      throw new Error('Only pending orders can be cancelled');
    }

    // 更新状态为已取消
    const cancelled = await prisma.quickOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return cancelled;
  }

  /**
   * 获取各状态订单数量统计
   */
  async getStatusCounts(userId: string) {
    const [all, pending, confirmed, inTransit, delivered, cancelled] = await Promise.all([
      prisma.quickOrder.count({ where: { userId } }),
      prisma.quickOrder.count({ where: { userId, status: 'PENDING' } }),
      prisma.quickOrder.count({ where: { userId, status: 'CONFIRMED' } }),
      prisma.quickOrder.count({ where: { userId, status: 'IN_TRANSIT' } }),
      prisma.quickOrder.count({ where: { userId, status: 'DELIVERED' } }),
      prisma.quickOrder.count({ where: { userId, status: 'CANCELLED' } }),
    ]);

    return {
      all,
      pending,
      confirmed,
      inTransit,
      delivered,
      cancelled,
    };
  }
}
