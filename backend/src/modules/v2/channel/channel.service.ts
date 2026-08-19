import { PrismaClient, ChannelCategory } from '@prisma/client';


const prisma = new PrismaClient();

export const DEFAULT_SHIPPING_CHANNELS = [
  // 海运拼箱
  { category: ChannelCategory.SEA_LCL, name: '万海自营拼箱专线', code: 'WH-LCL', isDefault: true, note: '万海自拼自清全链路专线' },
  { category: ChannelCategory.SEA_LCL, name: '中外运拼箱通道', code: 'SINOTRANS', isDefault: false, note: '央企正规报关拼箱' },
  { category: ChannelCategory.SEA_LCL, name: '天帆东南亚散拼', code: 'TF-SEA', isDefault: false, note: '印尼/泰国/马来散货专线' },
  { category: ChannelCategory.SEA_LCL, name: '同行外发分拨', code: 'PEER-FWD', isDefault: false, note: '临时同行调拨' },

  // 空运专线
  { category: ChannelCategory.AIR, name: '菲通货运专线', code: 'FT-AIR', isDefault: true, note: '菲律宾空运特快与带电专线' },
  { category: ChannelCategory.AIR, name: '万海特快航空', code: 'WH-AIR', isDefault: false, note: '自营直达包机专线' },

  // 整柜订舱
  { category: ChannelCategory.FCL_BOOKING, name: '优尼科订舱', code: 'UNICORN', isDefault: true, note: '一级订舱代理' },
  { category: ChannelCategory.FCL_BOOKING, name: '泉州万海订舱部', code: 'QZ-WH', isDefault: false, note: '泉州/厦门直订' },
  { category: ChannelCategory.FCL_BOOKING, name: '中远海运(COSCO)直订', code: 'COSCO', isDefault: false, note: '船司直接订舱' },

  // 整柜报关
  { category: ChannelCategory.FCL_CUSTOMS, name: '中外运报关行', code: 'SINO-CUST', isDefault: true, note: '国内正规出口报关' },
  { category: ChannelCategory.FCL_CUSTOMS, name: '报关资料群(快通)', code: 'FAST-CUST', isDefault: false, note: '合作代理报关' },

  // 整柜清关
  { category: ChannelCategory.FCL_CLEARANCE, name: '菲立亚清关公司', code: 'FLYA-CLR', isDefault: true, note: '马尼拉南港/北港清关专线' },
  { category: ChannelCategory.FCL_CLEARANCE, name: '天帆目的港清关', code: 'TF-CLR', isDefault: false, note: '东南亚多国清关代理' },

  // 整柜拖车
  { category: ChannelCategory.FCL_TRUCKING, name: '厦门联运车队', code: 'XM-TRK', isDefault: true, note: '华南/闽南港口拖车' },
  { category: ChannelCategory.FCL_TRUCKING, name: '优尼科港口集卡', code: 'UNI-TRK', isDefault: false, note: '码头港区短驳与转运' },
];

export interface CreateShippingChannelInput {
  category: ChannelCategory;
  name: string;
  code?: string;
  contactPerson?: string;
  contactPhone?: string;
  isDefault?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  note?: string;
}

export class ChannelV2Service {
  async ensureSeedChannels() {
    const count = await prisma.shippingChannel.count();
    if (count === 0) {
      for (const item of DEFAULT_SHIPPING_CHANNELS) {
        await prisma.shippingChannel.create({
          data: item,
        });
      }
    }
  }

  async getChannels(params?: { category?: ChannelCategory; isActive?: boolean; search?: string }) {
    await this.ensureSeedChannels();
    const where: any = {};

    if (params?.category) {
      where.category = params.category;
    }
    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }
    if (params?.search) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { note: { contains: q, mode: 'insensitive' } },
      ];
    }

    return prisma.shippingChannel.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async getChannelById(id: string) {
    return prisma.shippingChannel.findUnique({ where: { id } });
  }

  async createChannel(data: CreateShippingChannelInput) {
    const name = data.name?.trim();
    if (!name) throw new Error('渠道名称不能为空');

    if (data.isDefault) {
      await prisma.shippingChannel.updateMany({
        where: { category: data.category },
        data: { isDefault: false },
      });
    }

    return prisma.shippingChannel.create({
      data: {
        category: data.category,
        name,
        code: data.code?.trim() || null,
        contactPerson: data.contactPerson?.trim() || null,
        contactPhone: data.contactPhone?.trim() || null,
        isDefault: data.isDefault || false,
        isActive: data.isActive !== undefined ? data.isActive : true,
        sortOrder: data.sortOrder !== undefined ? Number(data.sortOrder) : 0,
        note: data.note?.trim() || null,
      },
    });
  }

  async updateChannel(id: string, data: Partial<CreateShippingChannelInput>) {
    const existing = await prisma.shippingChannel.findUnique({ where: { id } });
    if (!existing) throw new Error('渠道不存在');

    const targetCategory = data.category || existing.category;

    if (data.isDefault) {
      await prisma.shippingChannel.updateMany({
        where: { category: targetCategory, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return prisma.shippingChannel.update({
      where: { id },
      data: {
        ...(data.category && { category: data.category }),
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.code !== undefined && { code: data.code?.trim() || null }),
        ...(data.contactPerson !== undefined && { contactPerson: data.contactPerson?.trim() || null }),
        ...(data.contactPhone !== undefined && { contactPhone: data.contactPhone?.trim() || null }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.sortOrder !== undefined && { sortOrder: Number(data.sortOrder) }),
        ...(data.note !== undefined && { note: data.note?.trim() || null }),
      },
    });
  }

  async toggleActive(id: string) {
    const existing = await prisma.shippingChannel.findUnique({ where: { id } });
    if (!existing) throw new Error('渠道不存在');
    return prisma.shippingChannel.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });
  }

  async deleteChannel(id: string) {
    return prisma.shippingChannel.delete({ where: { id } });
  }
}

