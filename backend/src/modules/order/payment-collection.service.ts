import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface UpdatePaymentCollectionInput {
  channelUnitPricePhp?: number;
  receivableFreightAmount?: number;
  receivableOtherAmount?: number;
  actualReceivedAmount?: number;
  channelFreightCost?: number;
  channelOtherCost?: number;
  profit?: number;
}

interface PaymentCollectionFilters {
  orderId?: string;
  declarationId?: string;
  page?: number;
  limit?: number;
}

export class PaymentCollectionService {
  /**
   * 获取收款记录列表
   */
  async findAll(filters: PaymentCollectionFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderPaymentCollectionWhereInput = {
      ...(filters.orderId && { orderId: filters.orderId }),
      ...(filters.declarationId && { declarationId: filters.declarationId }),
    };

    const [collections, total] = await Promise.all([
      prisma.orderPaymentCollection.findMany({
        where,
        include: {
          order: {
            include: {
              paymentVouchers: true,
            },
          },
          declaration: {
            select: {
              id: true,
              productName: true,
              weight: true,
              trackingNumber: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.orderPaymentCollection.count({ where }),
    ]);

    return {
      data: collections,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 获取单个收款记录详情
   */
  async findOne(id: string) {
    const collection = await prisma.orderPaymentCollection.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            orderType: true,
            status: true,
            destination: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            paymentVouchers: {
              orderBy: { uploadedAt: 'desc' },
            },
          },
        },
        declaration: true,
      },
    });

    return collection;
  }

  /**
   * 更新收款记录
   */
  async update(id: string, data: UpdatePaymentCollectionInput) {
    const updateData: Prisma.OrderPaymentCollectionUpdateInput = {};

    if (data.channelUnitPricePhp !== undefined) {
      updateData.channelUnitPricePhp = new Prisma.Decimal(data.channelUnitPricePhp);
    }
    if (data.receivableFreightAmount !== undefined) {
      updateData.receivableFreightAmount = new Prisma.Decimal(data.receivableFreightAmount);
    }
    if (data.receivableOtherAmount !== undefined) {
      updateData.receivableOtherAmount = new Prisma.Decimal(data.receivableOtherAmount);
    }
    if (data.actualReceivedAmount !== undefined) {
      updateData.actualReceivedAmount = new Prisma.Decimal(data.actualReceivedAmount);
    }
    if (data.channelFreightCost !== undefined) {
      updateData.channelFreightCost = new Prisma.Decimal(data.channelFreightCost);
    }
    if (data.channelOtherCost !== undefined) {
      updateData.channelOtherCost = new Prisma.Decimal(data.channelOtherCost);
    }
    if (data.profit !== undefined) {
      updateData.profit = new Prisma.Decimal(data.profit);
    }

    const updated = await prisma.orderPaymentCollection.update({
      where: { id },
      data: updateData,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            paymentVouchers: {
              select: {
                id: true,
                fileUrl: true,
                fileName: true,
                uploadedAt: true,
              },
            },
          },
        },
        declaration: {
          select: {
            id: true,
            productName: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * 批量更新订单的所有收款记录
   */
  async batchUpdateByOrder(orderId: string, updates: Array<{ declarationId: string } & UpdatePaymentCollectionInput>) {
    const results = await Promise.all(
      updates.map(async (update) => {
        const { declarationId, ...data } = update;
        
        const collection = await prisma.orderPaymentCollection.findFirst({
          where: {
            orderId,
            declarationId,
          },
        });

        if (!collection) {
          throw new Error(`Payment collection not found for declaration ${declarationId}`);
        }

        return this.update(collection.id, data);
      })
    );

    return results;
  }

  async addVoucher(orderId: string, fileUrl: string, fileName?: string) {
    const voucher = await prisma.orderPaymentVoucher.create({
      data: {
        orderId,
        fileUrl,
        fileName,
      },
    });

    return voucher;
  }

  /**
   * 删除收款凭证
   */
  async deleteVoucher(voucherId: string) {
    await prisma.orderPaymentVoucher.delete({
      where: { id: voucherId },
    });
  }
}
