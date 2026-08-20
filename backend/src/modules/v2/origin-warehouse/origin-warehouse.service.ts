import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const DEFAULT_ORIGIN_WAREHOUSES = [
  {
    code: 'GZ-01',
    name: '广州白云集拼总仓',
    shortName: '广州仓',
    contactName: '广州收货组 (李主管)',
    contactPhone: '138-0000-1111 / 020-88888888',
    province: '广东省',
    city: '广州市',
    address: '白云区石井街道石沙路物流园B区6栋102室',
    receivingHours: '09:00 - 21:00 (周一至周日)',
    isDefault: true,
    isActive: true,
    sortOrder: 1,
    note: '大宗货物请提前2小时预报，外箱务必贴牢客户唛头！',
  },
  {
    code: 'LY-01',
    name: '龙岩集散直发中心',
    shortName: '龙岩仓',
    contactName: '龙岩仓管 (张班长)',
    contactPhone: '139-0000-2222',
    province: '福建省',
    city: '龙岩市',
    address: '新罗区龙州工业园物流大道8号',
    receivingHours: '08:30 - 18:30',
    isDefault: false,
    isActive: true,
    sortOrder: 2,
    note: '闽西直发与本地拼箱集货点',
  },
  {
    code: 'YW-01',
    name: '义乌小商品集拼中心',
    shortName: '义乌仓',
    contactName: '义乌收件处 (陈主管)',
    contactPhone: '137-0000-3333',
    province: '浙江省',
    city: '金华市',
    address: '义乌市稠江街道北苑物流中心3号库',
    receivingHours: '09:00 - 22:00',
    isDefault: false,
    isActive: true,
    sortOrder: 3,
    note: '小商品/日用品散货快速集拼点',
  },
  {
    code: 'SZ-01',
    name: '深圳大湾区专线仓',
    shortName: '深圳仓',
    contactName: '深圳仓调度组',
    contactPhone: '136-0000-4444',
    province: '广东省',
    city: '深圳市',
    address: '宝安区福永街道物流园A区12栋',
    receivingHours: '09:00 - 20:00',
    isDefault: false,
    isActive: true,
    sortOrder: 4,
    note: '大湾区特快空海运集货点',
  },
  {
    code: 'QZ-01',
    name: '泉州鞋服产业带集散仓',
    shortName: '泉州仓',
    contactName: '泉州收货组',
    contactPhone: '135-0000-5555',
    province: '福建省',
    city: '泉州市',
    address: '晋江市鞋都物流园C区5号库',
    receivingHours: '09:00 - 19:00',
    isDefault: false,
    isActive: true,
    sortOrder: 5,
    note: '鞋服/纺织品货源地集运直装',
  },
];

export interface CreateOriginWarehouseInput {
  code: string;
  name: string;
  shortName: string;
  contactName: string;
  contactPhone: string;
  province?: string;
  city?: string;
  address: string;
  receivingHours?: string;
  isDefault?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  note?: string;
}

export class OriginWarehouseV2Service {
  async ensureSeedWarehouses() {
    const count = await prisma.originWarehouse.count();
    if (count === 0) {
      for (const item of DEFAULT_ORIGIN_WAREHOUSES) {
        await prisma.originWarehouse.create({
          data: item,
        });
      }
    }
  }

  async listWarehouses(params?: { isActive?: boolean; search?: string }) {
    await this.ensureSeedWarehouses();

    const where: any = {};
    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    if (params?.search) {
      const kw = params.search.trim();
      where.OR = [
        { name: { contains: kw, mode: 'insensitive' } },
        { shortName: { contains: kw, mode: 'insensitive' } },
        { code: { contains: kw, mode: 'insensitive' } },
        { contactName: { contains: kw, mode: 'insensitive' } },
        { address: { contains: kw, mode: 'insensitive' } },
      ];
    }

    return prisma.originWarehouse.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async getWarehouseById(id: string) {
    return prisma.originWarehouse.findUnique({
      where: { id },
    });
  }

  async createWarehouse(data: CreateOriginWarehouseInput) {
    if (data.isDefault) {
      await prisma.originWarehouse.updateMany({
        data: { isDefault: false },
      });
    }

    return prisma.originWarehouse.create({
      data: {
        code: data.code.trim().toUpperCase(),
        name: data.name.trim(),
        shortName: data.shortName.trim(),
        contactName: data.contactName.trim(),
        contactPhone: data.contactPhone.trim(),
        province: data.province?.trim() || undefined,
        city: data.city?.trim() || undefined,
        address: data.address.trim(),
        receivingHours: data.receivingHours?.trim() || undefined,
        isDefault: !!data.isDefault,
        isActive: data.isActive !== undefined ? !!data.isActive : true,
        sortOrder: Number(data.sortOrder) || 0,
        note: data.note?.trim() || undefined,
      },
    });
  }

  async updateWarehouse(id: string, data: Partial<CreateOriginWarehouseInput>) {
    if (data.isDefault) {
      await prisma.originWarehouse.updateMany({
        where: { id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updateData: any = {};
    if (data.code !== undefined) updateData.code = data.code.trim().toUpperCase();
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.shortName !== undefined) updateData.shortName = data.shortName.trim();
    if (data.contactName !== undefined) updateData.contactName = data.contactName.trim();
    if (data.contactPhone !== undefined) updateData.contactPhone = data.contactPhone.trim();
    if (data.province !== undefined) updateData.province = data.province?.trim() || null;
    if (data.city !== undefined) updateData.city = data.city?.trim() || null;
    if (data.address !== undefined) updateData.address = data.address.trim();
    if (data.receivingHours !== undefined) updateData.receivingHours = data.receivingHours?.trim() || null;
    if (data.isDefault !== undefined) updateData.isDefault = !!data.isDefault;
    if (data.isActive !== undefined) updateData.isActive = !!data.isActive;
    if (data.sortOrder !== undefined) updateData.sortOrder = Number(data.sortOrder) || 0;
    if (data.note !== undefined) updateData.note = data.note?.trim() || null;

    return prisma.originWarehouse.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteWarehouse(id: string) {
    return prisma.originWarehouse.delete({
      where: { id },
    });
  }

  async setDefaultWarehouse(id: string) {
    await prisma.originWarehouse.updateMany({
      data: { isDefault: false },
    });
    return prisma.originWarehouse.update({
      where: { id },
      data: { isDefault: true },
    });
  }
}
