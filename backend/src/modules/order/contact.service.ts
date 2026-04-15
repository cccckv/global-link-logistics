import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ContactInput {
  name: string;
  company?: string;
  phone: string;
  region?: string;
  address: string;
}

export class ContactService {
  /**
   * 查找或创建提货地址（自动去重）
   */
  async upsertPickupAddress(userId: string, input: ContactInput) {
    const contact = await prisma.orderPickupAddress.upsert({
      where: {
        userId_phone_name: {
          userId,
          phone: input.phone,
          name: input.name,
        },
      },
      update: {
        company: input.company,
        region: input.region,
        address: input.address,
        updatedAt: new Date(), // 更新使用时间
      },
      create: {
        userId,
        ...input,
      },
    });

    return contact;
  }

  /**
   * 查找或创建收件地址（自动去重）
   */
  async upsertRecipientAddress(userId: string, input: ContactInput) {
    const contact = await prisma.orderRecipientAddress.upsert({
      where: {
        userId_phone_name: {
          userId,
          phone: input.phone,
          name: input.name,
        },
      },
      update: {
        company: input.company,
        region: input.region,
        address: input.address,
        updatedAt: new Date(),
      },
      create: {
        userId,
        ...input,
      },
    });

    return contact;
  }

  /**
   * 获取用户的提货地址列表（按最近使用排序）
   */
  async getPickupAddresses(userId: string) {
    const addresses = await prisma.orderPickupAddress.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { updatedAt: 'desc' },
      ],
    });

    return addresses;
  }

  /**
   * 获取用户的收件地址列表（按最近使用排序）
   */
  async getRecipientAddresses(userId: string) {
    const addresses = await prisma.orderRecipientAddress.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { updatedAt: 'desc' },
      ],
    });

    return addresses;
  }

  /**
   * 设置默认提货地址
   */
  async setDefaultPickupAddress(userId: string, id: string) {
    await prisma.$transaction([
      prisma.orderPickupAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      }),
      prisma.orderPickupAddress.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    return await prisma.orderPickupAddress.findUnique({ where: { id } });
  }

  /**
   * 设置默认收件地址
   */
  async setDefaultRecipientAddress(userId: string, id: string) {
    await prisma.$transaction([
      prisma.orderRecipientAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      }),
      prisma.orderRecipientAddress.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    return await prisma.orderRecipientAddress.findUnique({ where: { id } });
  }

  /**
   * 删除提货地址
   */
  async deletePickupAddress(userId: string, id: string) {
    const address = await prisma.orderPickupAddress.findFirst({
      where: { id, userId },
    });

    if (!address) {
      throw new Error('Address not found');
    }

    await prisma.orderPickupAddress.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * 删除收件地址
   */
  async deleteRecipientAddress(userId: string, id: string) {
    const address = await prisma.orderRecipientAddress.findFirst({
      where: { id, userId },
    });

    if (!address) {
      throw new Error('Address not found');
    }

    await prisma.orderRecipientAddress.delete({
      where: { id },
    });

    return { success: true };
  }
}
