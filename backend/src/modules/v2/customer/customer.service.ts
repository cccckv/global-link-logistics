import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class CustomerV2Service {
  async searchCustomers(keyword?: string) {
    const where = keyword
      ? {
          OR: [
            { clientCode: { contains: keyword, mode: 'insensitive' as const } },
            { name: { contains: keyword, mode: 'insensitive' as const } },
            { phone: { contains: keyword, mode: 'insensitive' as const } },
          ],
        }
      : {};

    return prisma.customer.findMany({
      where,
      include: {
        addresses: {
          orderBy: { isDefault: 'desc' },
        },
      },
      orderBy: { clientCode: 'asc' },
    });
  }

  async getCustomerById(id: string) {
    return prisma.customer.findUnique({
      where: { id },
      include: {
        addresses: {
          orderBy: { isDefault: 'desc' },
        },
      },
    });
  }

  async getCustomerByCode(clientCode: string) {
    return prisma.customer.findUnique({
      where: { clientCode },
      include: {
        addresses: {
          orderBy: { isDefault: 'desc' },
        },
      },
    });
  }

  async createCustomer(data: {
    clientCode: string;
    name: string;
    phone?: string;
    company?: string;
    destinationCountry?: string;
    destinationPort?: string;
    defaultWarehouse?: string;
    note?: string;
    addresses?: Array<{
      name: string;
      phone: string;
      company?: string;
      country?: string;
      region?: string;
      address: string;
      isDefault?: boolean;
    }>;
  }) {
    const { addresses, ...customerData } = data;
    return prisma.customer.create({
      data: {
        ...customerData,
        addresses: addresses && addresses.length > 0
          ? {
              create: addresses.map(addr => ({
                ...addr,
                addressType: 'OVERSEAS_RECIPIENT',
              })),
            }
          : undefined,
      },
      include: {
        addresses: true,
      },
    });
  }

  async addCustomerAddress(customerId: string, addressData: {
    name: string;
    phone: string;
    company?: string;
    country?: string;
    region?: string;
    address: string;
    isDefault?: boolean;
  }) {
    if (addressData.isDefault) {
      await prisma.customerAddress.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });
    }

    return prisma.customerAddress.create({
      data: {
        ...addressData,
        customerId,
        addressType: 'OVERSEAS_RECIPIENT',
      },
    });
  }

  async deleteCustomer(id: string) {
    // 检查是否有运单关联
    const waybillCount = await prisma.waybill.count({
      where: { customerId: id },
    });

    if (waybillCount > 0) {
      throw new Error(`该客户名下已关联 ${waybillCount} 票运单，无法直接删除！请先处理或转移相关运单。`);
    }

    return prisma.customer.delete({
      where: { id },
    });
  }
}
