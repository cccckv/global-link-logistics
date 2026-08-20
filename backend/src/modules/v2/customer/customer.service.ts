import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CustomerAddressInput {
  name: string;
  phone: string;
  company?: string;
  country?: string;
  region?: string;
  address: string;
  isDefault?: boolean;
}

export class CustomerV2Service {
  async searchCustomers(keyword?: string) {
    const kw = keyword?.trim();
    const where = kw
      ? {
          OR: [
            { clientCode: { contains: kw, mode: 'insensitive' as const } },
            { name: { contains: kw, mode: 'insensitive' as const } },
            { phone: { contains: kw, mode: 'insensitive' as const } },
            { company: { contains: kw, mode: 'insensitive' as const } },
            { addresses: { some: { name: { contains: kw, mode: 'insensitive' as const } } } },
            { addresses: { some: { phone: { contains: kw, mode: 'insensitive' as const } } } },
            { addresses: { some: { company: { contains: kw, mode: 'insensitive' as const } } } },
            { addresses: { some: { address: { contains: kw, mode: 'insensitive' as const } } } },
          ],
        }
      : {};

    return prisma.customer.findMany({
      where,
      include: {
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
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
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });
  }

  async getCustomerByCode(clientCode: string) {
    return prisma.customer.findUnique({
      where: { clientCode },
      include: {
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
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
    addresses?: Array<CustomerAddressInput>;
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
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });
  }

  async updateCustomer(id: string, data: Partial<{
    clientCode: string;
    name: string;
    phone?: string;
    company?: string;
    destinationCountry?: string;
    destinationPort?: string;
    defaultWarehouse?: string;
    note?: string;
  }>) {
    return prisma.customer.update({
      where: { id },
      data,
      include: {
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });
  }

  async addCustomerAddress(customerId: string, addressData: CustomerAddressInput) {
    if (addressData.isDefault) {
      await prisma.customerAddress.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });
      // 默认收件人驱动同步更新客户主路线偏好
      if (addressData.country || addressData.region) {
        await prisma.customer.update({
          where: { id: customerId },
          data: {
            destinationCountry: addressData.country || undefined,
            destinationPort: addressData.region || undefined,
          },
        });
      }
    }

    return prisma.customerAddress.create({
      data: {
        ...addressData,
        customerId,
        addressType: 'OVERSEAS_RECIPIENT',
      },
    });
  }

  /**
   * 智能查重并保存收件人地址（防止脏数据与重复插入）
   */
  async saveCustomerAddressWithDeduplication(customerId: string, addressData: CustomerAddressInput) {
    const normalizeDigits = (val?: string) => (val || '').replace(/[^0-9]/g, '');
    const targetPhoneDigits = normalizeDigits(addressData.phone);
    const targetAddressClean = (addressData.address || '').trim().toLowerCase();

    // 查找该客户名下所有已有地址
    const existingAddresses = await prisma.customerAddress.findMany({
      where: { customerId },
    });

    // 1. 完全相同（电话数字一致 且 详细地址一致） -> 静默返回已有记录
    const exactMatch = existingAddresses.find(
      (a) =>
        normalizeDigits(a.phone) === targetPhoneDigits &&
        a.address.trim().toLowerCase() === targetAddressClean
    );
    if (exactMatch) {
      return { address: exactMatch, isNew: false, updated: false };
    }

    // 2. 电话相同但地址或名称有更新 -> 更新该记录
    const phoneMatch = existingAddresses.find(
      (a) => targetPhoneDigits.length >= 7 && normalizeDigits(a.phone) === targetPhoneDigits
    );
    if (phoneMatch) {
      const updated = await prisma.customerAddress.update({
        where: { id: phoneMatch.id },
        data: {
          name: addressData.name || phoneMatch.name,
          company: addressData.company || phoneMatch.company,
          country: addressData.country || phoneMatch.country,
          region: addressData.region || phoneMatch.region,
          address: addressData.address || phoneMatch.address,
        },
      });
      return { address: updated, isNew: false, updated: true };
    }

    // 3. 全新联系人 -> 创建新地址 (若为首个地址自动设为默认)
    const isFirst = existingAddresses.length === 0;
    const created = await this.addCustomerAddress(customerId, {
      ...addressData,
      isDefault: addressData.isDefault || isFirst,
    });
    return { address: created, isNew: true, updated: false };
  }

  async updateCustomerAddress(addressId: string, addressData: Partial<CustomerAddressInput> & { customerId?: string }) {
    if (addressData.isDefault && addressData.customerId) {
      await prisma.customerAddress.updateMany({
        where: { customerId: addressData.customerId, id: { not: addressId } },
        data: { isDefault: false },
      });
      // 默认收件人驱动同步更新客户主路线偏好
      if (addressData.country || addressData.region) {
        await prisma.customer.update({
          where: { id: addressData.customerId },
          data: {
            destinationCountry: addressData.country || undefined,
            destinationPort: addressData.region || undefined,
          },
        });
      }
    }

    const { customerId, ...dataToUpdate } = addressData;

    return prisma.customerAddress.update({
      where: { id: addressId },
      data: dataToUpdate,
    });
  }

  async deleteCustomerAddress(addressId: string) {
    return prisma.customerAddress.delete({
      where: { id: addressId },
    });
  }

  async setDefaultCustomerAddress(customerId: string, addressId: string) {
    await prisma.customerAddress.updateMany({
      where: { customerId },
      data: { isDefault: false },
    });

    const updated = await prisma.customerAddress.update({
      where: { id: addressId },
      data: { isDefault: true },
    });

    // 默认收件人驱动同步更新客户主路线偏好
    if (updated.country || updated.region) {
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          destinationCountry: updated.country || undefined,
          destinationPort: updated.region || undefined,
        },
      });
    }

    return updated;
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
