import { PrismaClient, QuickOrderType, QuickOrderStatus, AdditionalService, Prisma } from '@prisma/client';
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
  trackingNumber?: string;
  courierCompany?: string;
  totalPackages?: number;
  note?: string;
  userMark?: string;
  mark?: string;
  attachmentUrl?: string;
  originPort?: string;
  destinationPort?: string;
  additionalServices?: AdditionalService[];
  batchTaskId?: string;
  
  pickupAddress?: {
    name: string;
    company?: string;
    phone: string;
    region?: string;
    postcode?: string;
    address: string;
  };
  
  recipientAddress: {
    name: string;
    company?: string;
    phone: string;
    region?: string;
    postcode?: string;
    address: string;
  };
  
  declarations?: Array<{
    trackingNumber?: string;
    productName: string;
    length?: number;
    width?: number;
    height?: number;
    outerQuantity?: number;
    innerQuantity?: number;
    weight: number;
    unitPrice?: number;
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
            { trackingNumber: search },
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
   * 计算密度
   * 密度 = 重量 / 体积 (kg/m³)
   */
  private calculateDensity(
    length: number,
    width: number,
    height: number,
    weight: number
  ): number {
    if (!length || !width || !height || !weight) return 0;
    
    const volume = (length * width * height) / 1000000; // m³
    const density = weight / volume; // kg/m³
    
    return Math.round(density * 100) / 100; // 保留2位小数
  }

  /**
   * 计算运费
   * TODO: 根据实际业务规则调整
   */
  private calculateShippingFee(
    orderType: QuickOrderType,
    declarations?: Array<{ weight: number }>,
    containers?: Array<{ containerType: string; quantity: number }>,
    additionalServices?: AdditionalService[]
  ): number {
    const baseRates: Record<string, number> = {
      SEA_LCL: 5,    // ¥5/kg
      AIR: 15,       // ¥15/kg
      LAND: 3,       // ¥3/kg
      PARCEL: 12,    // ¥12/kg
      SEA_FCL: 0,    // 整柜按柜型计费
      BATCH: 5,      // 批量导入按拼柜计费
    };

    let baseFee = 0;

    // 标准散货: 按重量计费
    if (orderType !== 'SEA_FCL' && declarations && declarations.length > 0) {
      const totalWeight = declarations.reduce((sum, d) => sum + Number(d.weight), 0);
      baseFee = totalWeight * baseRates[orderType];
    }

    // 海运整柜: 按柜型计费
    if (orderType === 'SEA_FCL' && containers && containers.length > 0) {
      const containerRates: Record<string, number> = {
        GP_20: 8000,   // ¥8000/柜
        GP_40: 12000,  // ¥12000/柜
        HQ_40: 13000,  // ¥13000/柜
        HQ_45: 15000,  // ¥15000/柜
      };

      baseFee = containers.reduce((sum, c) => {
        return sum + (containerRates[c.containerType] || 0) * c.quantity;
      }, 0);
    }

    // 附加服务费用
    const serviceRates: Record<string, number> = {
      WOODEN_FRAME: 50,   // ¥50/单
      CUSTOMS: 100,       // ¥100/单
      DISINFECTION: 30,   // ¥30/单
      LABEL: 10,          // ¥10/单
      DELIVERY: 80,       // ¥80/单
      UNLOADING: 60,      // ¥60/单
    };

    if (additionalServices && additionalServices.length > 0) {
      additionalServices.forEach(service => {
        baseFee += serviceRates[service] || 0;
      });
    }

    return Math.round(baseFee * 100) / 100; // 保留2位小数
  }

  /**
   * 创建快速订单
   */
  async create(userId: string, input: CreateQuickOrderInput) {
    const orderNumber = this.generateOrderNumber();
    
    // 计算运费
    const totalAmount = this.calculateShippingFee(
      input.orderType,
      input.declarations,
      input.containers,
      input.additionalServices
    );

    // 准备申报明细数据（计算密度）
    const declarationsData = input.declarations?.map(d => ({
      trackingNumber: d.trackingNumber,
      productName: d.productName,
      length: d.length ? new Prisma.Decimal(d.length) : null,
      width: d.width ? new Prisma.Decimal(d.width) : null,
      height: d.height ? new Prisma.Decimal(d.height) : null,
      outerQuantity: d.outerQuantity,
      innerQuantity: d.innerQuantity,
      weight: new Prisma.Decimal(d.weight),
      unitPrice: d.unitPrice ? new Prisma.Decimal(d.unitPrice) : null,
      density: d.length && d.width && d.height
        ? new Prisma.Decimal(this.calculateDensity(d.length, d.width, d.height, d.weight))
        : null,
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
        trackingNumber: input.trackingNumber,
        courierCompany: input.courierCompany,
        totalPackages: input.totalPackages,
        note: input.note,
        userMark: input.userMark,
        mark: input.mark,
        attachmentUrl: input.attachmentUrl,
        originPort: input.originPort,
        destinationPort: input.destinationPort,
        additionalServices: input.additionalServices || [],
        batchTaskId: input.batchTaskId,
        totalAmount: new Prisma.Decimal(totalAmount),
        currency: 'CNY',
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
    attachmentUrl?: string;
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
