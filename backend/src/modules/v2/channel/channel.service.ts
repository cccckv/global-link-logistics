import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const DEFAULT_CHANNEL_MAPPINGS = [
  { customsType: '普货双清', forwarderChannel: '万海自营专线', note: '万海自营东南亚散拼' },
  { customsType: '普货双清', forwarderChannel: '中外运', note: '中外运拼箱正规通道' },
  { customsType: '普货双清', forwarderChannel: '天帆东南亚', note: '印尼泰国马来散货专线' },
  { customsType: '普货双清', forwarderChannel: '同行外发分拨', note: '其他同行调拨' },

  { customsType: '退税报关', forwarderChannel: '中外运', note: '中外运正规退税报关' },
  { customsType: '退税报关', forwarderChannel: '万海自营专线', note: '万海自营退税通道' },

  { customsType: '敏感特货', forwarderChannel: '菲通货运', note: '菲律宾空运特快与带电敏感' },
  { customsType: '敏感特货', forwarderChannel: '万海特货通道', note: '海运特种敏感专柜' },

  { customsType: '一般贸易买单', forwarderChannel: '中外运', note: '买单报关' },
  { customsType: '一般贸易买单', forwarderChannel: '万海自营专线', note: '万海买单申报' },
];

export class ChannelV2Service {
  async ensureSeedMappings() {
    const count = await prisma.channelMapping.count();
    if (count === 0) {
      for (const m of DEFAULT_CHANNEL_MAPPINGS) {
        await prisma.channelMapping.upsert({
          where: {
            customsType_forwarderChannel: {
              customsType: m.customsType,
              forwarderChannel: m.forwarderChannel,
            },
          },
          update: {},
          create: m,
        });
      }
    }
  }

  async getMappings(customsType?: string) {
    await this.ensureSeedMappings();
    const where: any = {};
    if (customsType) where.customsType = customsType;

    return prisma.channelMapping.findMany({
      where,
      orderBy: [{ customsType: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async addMapping(data: { customsType: string; forwarderChannel: string; note?: string }) {
    return prisma.channelMapping.upsert({
      where: {
        customsType_forwarderChannel: {
          customsType: data.customsType.trim(),
          forwarderChannel: data.forwarderChannel.trim(),
        },
      },
      update: { note: data.note?.trim() },
      create: {
        customsType: data.customsType.trim(),
        forwarderChannel: data.forwarderChannel.trim(),
        note: data.note?.trim(),
      },
    });
  }

  async deleteMapping(id: string) {
    return prisma.channelMapping.delete({ where: { id } });
  }
}
