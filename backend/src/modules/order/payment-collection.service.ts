import { PrismaClient, Prisma } from '@prisma/client';
import path from 'path';
import fs from 'fs/promises';

const prisma = new PrismaClient();

export interface UpsertPaymentCollectionInput {
  totalPieces: number;
  totalVolume?: number;
  totalWeight?: number;
  receivableAmount: number;
  payableAmount: number;
  receivableCurrency?: string;
  payableCurrency?: string;
  carPickupReceivable?: number;
  carPickupActual?: number;
}

export interface PaymentCollectionFilters {
  orderId?: string;
  page?: number;
  limit?: number;
}

export class PaymentCollectionService {
  async findAll(filters: PaymentCollectionFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderPaymentCollectionWhereInput = {
      ...(filters.orderId && { orderId: filters.orderId }),
    };

    const [collections, total] = await Promise.all([
      prisma.orderPaymentCollection.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              orderType: true,
              status: true,
              destination: true,
              warehouse: true,
              userMark: true,
              mark: true,
              createdAt: true,
              user: { select: { id: true, name: true, phone: true } },
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
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findByOrderId(orderId: string) {
    return prisma.orderPaymentCollection.findUnique({
      where: { orderId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            orderType: true,
            status: true,
            destination: true,
            createdAt: true,
            user: { select: { id: true, name: true, phone: true } },
          },
        },
      },
    });
  }

  async upsert(orderId: string, data: UpsertPaymentCollectionInput) {
    const payload = {
      totalPieces: data.totalPieces,
      totalVolume: data.totalVolume != null ? new Prisma.Decimal(data.totalVolume) : null,
      totalWeight: data.totalWeight != null ? new Prisma.Decimal(data.totalWeight) : null,
      receivableAmount: new Prisma.Decimal(data.receivableAmount),
      payableAmount: new Prisma.Decimal(data.payableAmount),
      receivableCurrency: data.receivableCurrency ?? 'CNY',
      payableCurrency: data.payableCurrency ?? 'PHP',
      carPickupReceivable: data.carPickupReceivable != null ? new Prisma.Decimal(data.carPickupReceivable) : null,
      carPickupActual: data.carPickupActual != null ? new Prisma.Decimal(data.carPickupActual) : null,
    };

    return prisma.orderPaymentCollection.upsert({
      where: { orderId },
      create: { orderId, ...payload },
      update: payload,
    });
  }

  async addVoucher(orderId: string, fileUrl: string, fileName?: string, fileType?: string) {
    return prisma.orderPaymentVoucher.create({
      data: { orderId, fileUrl, fileName, fileType },
    });
  }

  async deleteVoucher(voucherId: string) {
    const voucher = await prisma.orderPaymentVoucher.findUnique({
      where: { id: voucherId },
      select: { fileUrl: true },
    });

    await prisma.orderPaymentVoucher.delete({ where: { id: voucherId } });

    if (voucher?.fileUrl) {
      try {
        const urlPath = voucher.fileUrl.replace(/^\/api\//, '');
        const filePath = path.join(process.cwd(), urlPath);
        await fs.unlink(filePath);
      } catch {
      }
    }
  }
}
