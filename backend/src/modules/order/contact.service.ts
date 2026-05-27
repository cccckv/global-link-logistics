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

  async upsertOverseasAddress(userId: string, input: ContactInput) {
    const contact = await prisma.orderOverseasAddress.upsert({
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

  async getOverseasAddresses(userId: string) {
    const addresses = await prisma.orderOverseasAddress.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { updatedAt: 'desc' },
      ],
    });

    return addresses;
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

  async setDefaultOverseasAddress(userId: string, id: string) {
    await prisma.$transaction([
      prisma.orderOverseasAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      }),
      prisma.orderOverseasAddress.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    return await prisma.orderOverseasAddress.findUnique({ where: { id } });
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

  async deleteOverseasAddress(userId: string, id: string) {
    const address = await prisma.orderOverseasAddress.findFirst({
      where: { id, userId },
    });

    if (!address) {
      throw new Error('Address not found');
    }

    await prisma.orderOverseasAddress.delete({
      where: { id },
    });

    return { success: true };
  }
}
