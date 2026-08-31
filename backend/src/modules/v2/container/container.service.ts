import { PrismaClient, ContainerStatus, ContainerFeeSubject, FeeDirection, CurrencyType } from '@prisma/client';
import { parseNullableDate } from '../waybill/waybill.service';

const prisma = new PrismaClient();

export interface CreateContainerInput {
  containerNo: string;
  containerType?: string;
  blNumber?: string;
  carrier?: string;
  vesselVoyage?: string;
  mmsi?: string;
  imo?: string;
  originPort?: string;
  destinationPort?: string;
  bookingChannel?: string;
  customsChannel?: string;
  clearanceChannel?: string;
  truckingChannel?: string;
  truckPlateNo?: string;
  driverName?: string;
  driverPhone?: string;
  truckingDate?: Date | string;
  destArrivedDate?: Date | string;
  loadingDate?: Date | string;
  sailingDate?: Date | string;
  eta?: Date | string;
  clearanceDate?: Date | string;
  inspectStatus?: string;
  note?: string;
}

export class ContainerV2Service {
  async createContainer(data: CreateContainerInput) {
    const createData: any = { ...data };
    if ('loadingDate' in data) createData.loadingDate = parseNullableDate(data.loadingDate) || undefined;
    if ('sailingDate' in data) createData.sailingDate = parseNullableDate(data.sailingDate) || undefined;
    if ('eta' in data) createData.eta = parseNullableDate(data.eta) || undefined;
    if ('clearanceDate' in data) createData.clearanceDate = parseNullableDate(data.clearanceDate) || undefined;
    if ('truckingDate' in data) createData.truckingDate = parseNullableDate(data.truckingDate) || undefined;
    if ('destArrivedDate' in data) createData.destArrivedDate = parseNullableDate(data.destArrivedDate) || undefined;

    return prisma.containerMaster.create({
      data: createData,
    });
  }

  async getContainers(params?: {
    status?: ContainerStatus;
    search?: string;
    originPort?: string;
    destinationPort?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params?.page) || 1);
    const limit = Math.max(1, Number(params?.limit) || 20);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params?.status) where.status = params.status;
    if (params?.originPort) where.originPort = params.originPort;
    if (params?.destinationPort) where.destinationPort = params.destinationPort;

    if (params?.search) {
      const q = params.search;
      where.OR = [
        { containerNo: { contains: q, mode: 'insensitive' } },
        { blNumber: { contains: q, mode: 'insensitive' } },
        { carrier: { contains: q, mode: 'insensitive' } },
        { vesselVoyage: { contains: q, mode: 'insensitive' } },
        { bookingChannel: { contains: q, mode: 'insensitive' } },
        { clearanceChannel: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.containerMaster.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          fees: true,
          attachments: true,
          _count: { select: { waybills: true } },
          waybills: {
            select: {
              id: true,
              waybillNo: true,
              userMark: true,
              totalPieces: true,
              totalPayableCbm: true,
              totalReceivableCbm: true,
              receivableAmount: true,
              status: true,
            },
          },
        },
      }),
      prisma.containerMaster.count({ where }),
    ]);

    // Status counts
    const statusCounts = await prisma.containerMaster.groupBy({
      by: ['status'],
      _count: { id: true },
    });
    const countsMap = statusCounts.reduce((acc, curr) => {
      acc[curr.status] = curr._count.id;
      return acc;
    }, {} as Record<string, number>);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      counts: countsMap,
    };
  }

  async getContainerById(id: string) {
    return prisma.containerMaster.findUnique({
      where: { id },
      include: {
        fees: { orderBy: { createdAt: 'asc' } },
        attachments: { orderBy: { uploadedAt: 'desc' } },
        waybills: {
          include: {
            items: true,
            fees: true,
          },
        },
      },
    });
  }

  async updateContainer(id: string, data: Partial<CreateContainerInput> & {
    status?: ContainerStatus;
  }) {
    const updateData: any = { ...data };
    if ('loadingDate' in data) updateData.loadingDate = parseNullableDate(data.loadingDate);
    if ('sailingDate' in data) updateData.sailingDate = parseNullableDate(data.sailingDate);
    if ('eta' in data) updateData.eta = parseNullableDate(data.eta);
    if ('clearanceDate' in data) updateData.clearanceDate = parseNullableDate(data.clearanceDate);
    if ('truckingDate' in data) updateData.truckingDate = parseNullableDate(data.truckingDate);
    if ('destArrivedDate' in data) updateData.destArrivedDate = parseNullableDate(data.destArrivedDate);

    // Compute totalShippingDays if both dates exist
    const current = await prisma.containerMaster.findUnique({ where: { id } });
    if (current) {
      const lDate = updateData.loadingDate || current.loadingDate;
      const cDate = updateData.clearanceDate || current.clearanceDate;
      if (lDate && cDate) {
        const diffTime = Math.abs(new Date(cDate).getTime() - new Date(lDate).getTime());
        updateData.totalShippingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }

    // 校验：若试图将货柜修改为 COMPLETED (全部完结)，必须校验柜内所有运单是否都已签收完结 (DELIVERED)
    if (data.status === 'COMPLETED') {
      const containerWithWaybills = await prisma.containerMaster.findUnique({
        where: { id },
        include: {
          waybills: { select: { id: true, waybillNo: true, status: true } },
        },
      });
      if (containerWithWaybills && containerWithWaybills.waybills.length > 0) {
        const uncompletedWaybills = containerWithWaybills.waybills.filter(
          (w) => w.status !== 'DELIVERED'
        );
        if (uncompletedWaybills.length > 0) {
          const sampleNos = uncompletedWaybills.slice(0, 3).map((w) => w.waybillNo).join('、');
          const extra = uncompletedWaybills.length > 3 ? ` 等共 ${uncompletedWaybills.length} 票` : '';
          throw new Error(
            `无法将货柜修改为全部完结：柜内仍有 ${uncompletedWaybills.length} 票运单未签收完结（${sampleNos}${extra}）。必须等待所有运单完成派送签收后方可完结货柜！`
          );
        }
      }
    }

    const updated = await prisma.containerMaster.update({
      where: { id },
      data: updateData,
      include: {
        fees: true,
        waybills: true,
      },
    });

    // Auto sync status to waybills with strict status guards
    if (data.status === 'SAILING') {
      // 推进至在途中: 仅推进处于 LOADED 状态的在柜运单
      await prisma.waybill.updateMany({
        where: { containerId: id, status: 'LOADED' },
        data: { status: 'IN_TRANSIT', sailingDate: updateData.sailingDate || new Date() },
      });
      // 若是从 DISPATCHING 回退至 SAILING，清空柜内运单的清关时间
      await prisma.waybill.updateMany({
        where: { containerId: id, status: 'DISPATCHING' },
        data: { status: 'IN_TRANSIT', clearanceDate: null },
      });
    } else if (data.status === 'CUSTOMS') {
      await prisma.waybill.updateMany({
        where: { containerId: id, status: 'IN_TRANSIT' },
        data: { status: 'CUSTOMS' },
      });
    } else if (data.status === 'DISPATCHING') {
      // 推进至目的港拆派: 仅推进处于 IN_TRANSIT 或 CUSTOMS 的在柜运单 (绝不触碰 DRAFT/INBOUND/DELIVERED)
      await prisma.waybill.updateMany({
        where: { containerId: id, status: { in: ['IN_TRANSIT', 'CUSTOMS'] } },
        data: { status: 'DISPATCHING', clearanceDate: updateData.clearanceDate || new Date() },
      });
    } else if (data.status === 'LOADING') {
      // 货柜回退至装柜中: 柜内处于更高阶段 (在途/清关) 的运单同步回退至 LOADED 并清空开船/清关时间
      await prisma.waybill.updateMany({
        where: { containerId: id, status: { in: ['IN_TRANSIT', 'CUSTOMS', 'DISPATCHING'] } },
        data: { status: 'LOADED', sailingDate: null, clearanceDate: null },
      });
    }

    return updated;
  }

  async addContainerFee(containerId: string, feeData: {
    feeSubject: ContainerFeeSubject;
    feeDirection?: FeeDirection;
    amount: number;
    currency?: CurrencyType;
    exchangeRate?: number;
    note?: string;
  }) {
    const rate = feeData.exchangeRate || 1.0;
    const cny = feeData.amount * rate;
    return prisma.containerFee.create({
      data: {
        containerId,
        feeSubject: feeData.feeSubject,
        feeDirection: feeData.feeDirection || 'PAYABLE',
        amount: feeData.amount,
        currency: feeData.currency || 'CNY',
        exchangeRate: rate,
        amountInCny: cny,
        note: feeData.note,
      },
    });
  }

  async deleteContainerFee(feeId: string) {
    return prisma.containerFee.delete({ where: { id: feeId } });
  }

  async deleteContainer(id: string) {
    // Unlink waybills
    await prisma.waybill.updateMany({
      where: { containerId: id },
      data: { containerId: null, status: 'INBOUND' },
    });

    return prisma.containerMaster.delete({ where: { id } });
  }
}
