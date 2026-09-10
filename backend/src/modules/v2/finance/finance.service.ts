import { PrismaClient, FeeDirection, CurrencyType, AttachmentType, WaybillStatus, ShipmentType } from '@prisma/client';
import { calculateWaybillFinancials } from '../waybill/waybill.service';
import { convertAmountToCny } from '../import/dictionary-validator.service';

const prisma = new PrismaClient();

export interface FinanceWorkbenchQueryParams {
  status?: string; // 'DELIVERED' | 'ALL' | etc.
  settlementFilter?: 'ALL' | 'UNSETTLED_RECEIVABLE' | 'UNSETTLED_PAYABLE' | 'ALL_SETTLED' | 'HAS_UNSETTLED';
  orderType?: ShipmentType | 'ALL';
  search?: string;
  startDate?: string;
  endDate?: string;
  dateType?: 'signedDate' | 'inboundDate' | 'loadingDate' | 'createdAt';
  page?: number | string;
  limit?: number | string;
}

export class FinanceV2Service {
  /**
   * 财务核算与对账工作台数据聚合接口：
   * 1. 严格遵守 Prisma 分页整型强转规则；
   * 2. 默认只查询已结单（DELIVERED）运单，支持状态切换；
   * 3. 聚合款项细颗粒度结算进度与顶部多币种折合 KPI。
   */
  async getFinanceWorkbenchData(params: FinanceWorkbenchQueryParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Number(params.limit) || 15);
    const skip = Math.max(0, (page - 1) * limit);

    const where: any = {};

    // 准入门槛过滤：默认已结单 DELIVERED
    if (params.status && params.status !== 'ALL') {
      where.status = params.status as WaybillStatus;
    } else if (!params.status) {
      where.status = 'DELIVERED';
    }

    // 运输方式
    if (params.orderType && params.orderType !== 'ALL') {
      where.orderType = params.orderType as ShipmentType;
    }

    // 综合搜索
    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { waybillNo: { contains: q, mode: 'insensitive' } },
        { userMark: { contains: q, mode: 'insensitive' } },
        { expressNo: { contains: q, mode: 'insensitive' } },
        { containerMaster: { containerNo: { contains: q, mode: 'insensitive' } } },
      ];
    }

    // 时间范围
    if (params.startDate || params.endDate) {
      const dateField = params.dateType || 'signedDate';
      where[dateField] = {};
      if (params.startDate) {
        where[dateField].gte = new Date(params.startDate);
      }
      if (params.endDate) {
        const endD = new Date(params.endDate);
        endD.setHours(23, 59, 59, 999);
        where[dateField].lte = endD;
      }
    }

    // 先拉取满足基础过滤条件的数据用于计算结清进度与分页
    const [rawWaybills, totalFilteredCount] = await Promise.all([
      prisma.waybill.findMany({
        where,
        skip,
        take: limit,
        orderBy: { signedDate: 'desc' },
        include: {
          items: true,
          fees: {
            orderBy: { createdAt: 'asc' },
          },
          attachments: true,
          containerMaster: {
            select: { containerNo: true, vesselVoyage: true, blNumber: true },
          },
          customer: {
            select: { name: true, phone: true },
          },
        },
      }),
      prisma.waybill.count({ where }),
    ]);

    // 逐单计算细颗粒度结清进度
    const enrichedList = rawWaybills.map((wb) => {
      // 应收项分析 (主运费 + 附加应收杂费)
      const hasFreightRecv = Number(wb.receivableAmount || 0) > 0 || Number(wb.rawReceivableAmount || 0) > 0;
      const feeReceivables = wb.fees.filter((f) => f.feeDirection === 'RECEIVABLE');
      const totalRecvItemsCount = (hasFreightRecv ? 1 : 0) + feeReceivables.length;
      const settledRecvItemsCount =
        (hasFreightRecv && wb.isFreightSettled ? 1 : 0) + feeReceivables.filter((f) => f.isPaid).length;

      // 应付项分析 (附加应付杂费)
      const feePayables = wb.fees.filter((f) => f.feeDirection === 'PAYABLE');
      const totalPayItemsCount = feePayables.length;
      const settledPayItemsCount = feePayables.filter((f) => f.isPaid).length;

      // 未结金额计算 (CNY)
      let uncollectedRecvCny = 0;
      if (hasFreightRecv && !wb.isFreightSettled) {
        const feeRecvSum = feeReceivables.reduce((acc, curr) => acc + Number(curr.amountInCny || 0), 0);
        const baseRecv = Math.max(0, Number(wb.receivableAmount || 0) - feeRecvSum);
        uncollectedRecvCny += baseRecv;
      }
      for (const f of feeReceivables) {
        if (!f.isPaid) {
          uncollectedRecvCny += Number(f.amountInCny || 0);
        }
      }

      let unpaidPayCny = 0;
      for (const f of feePayables) {
        if (!f.isPaid) {
          unpaidPayCny += Number(f.amountInCny || 0);
        }
      }

      const recvComplete = totalRecvItemsCount > 0 ? settledRecvItemsCount >= totalRecvItemsCount : true;
      const payComplete = totalPayItemsCount > 0 ? settledPayItemsCount >= totalPayItemsCount : true;
      const allSettled = recvComplete && payComplete;

      return {
        ...wb,
        financialProgress: {
          receivable: {
            totalItems: totalRecvItemsCount,
            settledItems: settledRecvItemsCount,
            isComplete: recvComplete,
            uncollectedCny: Math.round(uncollectedRecvCny * 100) / 100,
          },
          payable: {
            totalItems: totalPayItemsCount,
            settledItems: settledPayItemsCount,
            isComplete: payComplete,
            unpaidCny: Math.round(unpaidPayCny * 100) / 100,
          },
          isAllSettled: allSettled,
        },
      };
    });

    // 针对结清过滤器做二次内存过滤 (若指定了结清状态筛选)
    let filteredList = enrichedList;
    if (params.settlementFilter && params.settlementFilter !== 'ALL') {
      if (params.settlementFilter === 'UNSETTLED_RECEIVABLE') {
        filteredList = enrichedList.filter((item) => !item.financialProgress.receivable.isComplete);
      } else if (params.settlementFilter === 'UNSETTLED_PAYABLE') {
        filteredList = enrichedList.filter((item) => !item.financialProgress.payable.isComplete);
      } else if (params.settlementFilter === 'ALL_SETTLED') {
        filteredList = enrichedList.filter((item) => item.financialProgress.isAllSettled);
      } else if (params.settlementFilter === 'HAS_UNSETTLED') {
        filteredList = enrichedList.filter((item) => !item.financialProgress.isAllSettled);
      }
    }

    // 统计当前准入条件下的全局多币种与人民币汇总指标 (KPI)
    const allMatching = await prisma.waybill.findMany({
      where,
      select: {
        receivableAmount: true,
        payableAmount: true,
        profitAmount: true,
        rawReceivableAmount: true,
        settlementCurrency: true,
        isFreightSettled: true,
        fees: {
          select: {
            feeDirection: true,
            amount: true,
            currency: true,
            amountInCny: true,
            isPaid: true,
          },
        },
      },
    });

    let kpiTotalReceivableCny = 0;
    let kpiTotalPayableCny = 0;
    let kpiTotalProfitCny = 0;
    let kpiUncollectedReceivableCny = 0;
    let kpiUnpaidPayableCny = 0;

    // 原币统计
    let kpiRawReceivablePhp = 0;
    let kpiRawReceivableUsd = 0;

    for (const item of allMatching) {
      const rec = Number(item.receivableAmount || 0);
      const pay = Number(item.payableAmount || 0);
      const profit = Number(item.profitAmount || 0);

      kpiTotalReceivableCny += rec;
      kpiTotalPayableCny += pay;
      kpiTotalProfitCny += profit;

      if (item.settlementCurrency === 'PHP') {
        kpiRawReceivablePhp += Number(item.rawReceivableAmount || 0);
      } else if (item.settlementCurrency === 'USD') {
        kpiRawReceivableUsd += Number(item.rawReceivableAmount || 0);
      }

      // 未结应收
      const feeRecv = item.fees.filter((f) => f.feeDirection === 'RECEIVABLE');
      if (rec > 0 && !item.isFreightSettled) {
        const feeRecvSum = feeRecv.reduce((acc, curr) => acc + Number(curr.amountInCny || 0), 0);
        kpiUncollectedReceivableCny += Math.max(0, rec - feeRecvSum);
      }
      for (const f of feeRecv) {
        if (!f.isPaid) {
          kpiUncollectedReceivableCny += Number(f.amountInCny || 0);
        }
      }

      // 未结应付
      for (const f of item.fees) {
        if (f.feeDirection === 'PAYABLE' && !f.isPaid) {
          kpiUnpaidPayableCny += Number(f.amountInCny || 0);
        }
      }
    }

    // 毛利率除零保护
    const profitMargin =
      kpiTotalReceivableCny > 0.0001
        ? Number(((kpiTotalProfitCny / kpiTotalReceivableCny) * 100).toFixed(2))
        : 0;

    return {
      success: true,
      data: filteredList,
      pagination: {
        total: totalFilteredCount,
        page,
        limit,
        totalPages: Math.ceil(totalFilteredCount / limit),
      },
      kpi: {
        totalReceivableCny: Math.round(kpiTotalReceivableCny * 100) / 100,
        totalPayableCny: Math.round(kpiTotalPayableCny * 100) / 100,
        totalProfitCny: Math.round(kpiTotalProfitCny * 100) / 100,
        profitMargin,
        uncollectedReceivableCny: Math.round(kpiUncollectedReceivableCny * 100) / 100,
        unpaidPayableCny: Math.round(kpiUnpaidPayableCny * 100) / 100,
        rawReceivablePhp: Math.round(kpiRawReceivablePhp * 100) / 100,
        rawReceivableUsd: Math.round(kpiRawReceivableUsd * 100) / 100,
        totalOrdersCount: totalFilteredCount,
      },
    };
  }

  /**
   * 附加杂费条目结清 / 反结清切换
   */
  async toggleFeeSettlement(
    feeId: string,
    data: {
      isPaid: boolean;
      paidBy?: string;
      paymentMethod?: string;
      paymentNote?: string;
    }
  ) {
    const fee = await prisma.waybillFee.findUnique({ where: { id: feeId } });
    if (!fee) throw new Error('费用条目不存在');

    const updated = await prisma.waybillFee.update({
      where: { id: feeId },
      data: {
        isPaid: data.isPaid,
        paidAt: data.isPaid ? new Date() : null,
        paidBy: data.isPaid ? data.paidBy || '财务' : null,
        paymentMethod: data.isPaid ? data.paymentMethod || fee.paymentMethod : null,
        paymentNote: data.paymentNote,
      },
    });

    return updated;
  }

  /**
   * 主运费 / 包干款结清 / 反结清切换
   */
  async toggleFreightSettlement(
    waybillId: string,
    data: {
      isSettled: boolean;
      settledBy?: string;
      paymentMethod?: string;
      paymentNote?: string;
    }
  ) {
    const waybill = await prisma.waybill.findUnique({ where: { id: waybillId } });
    if (!waybill) throw new Error('运单不存在');

    const updated = await prisma.waybill.update({
      where: { id: waybillId },
      data: {
        isFreightSettled: data.isSettled,
        freightSettledAt: data.isSettled ? new Date() : null,
        freightSettledBy: data.isSettled ? data.settledBy || '财务' : null,
        freightPaymentMethod: data.isSettled ? data.paymentMethod || waybill.freightPaymentMethod : null,
        freightPaymentNote: data.paymentNote,
      },
    });

    return updated;
  }

  /**
   * 财务修改款项 (仅未结清条目允许编辑，保存后自动触发重算)
   */
  async updateWaybillFee(
    feeId: string,
    data: {
      feeName?: string;
      amount?: number;
      currency?: CurrencyType;
      exchangeRate?: number;
      note?: string;
    }
  ) {
    const fee = await prisma.waybillFee.findUnique({ where: { id: feeId } });
    if (!fee) throw new Error('费用条目不存在');
    if (fee.isPaid) throw new Error('已结清条目已被锁定，如需修改请先撤销结清');

    const waybill = await prisma.waybill.findUnique({
      where: { id: fee.waybillId },
      select: { usdRate: true, phpRate: true },
    });

    const curr = (data.currency || fee.currency || 'CNY').toUpperCase();
    let effectiveRate = Number(fee.exchangeRate || 1.0);
    if (data.exchangeRate && Number(data.exchangeRate) > 0) {
      effectiveRate = Number(data.exchangeRate);
    } else if (curr === 'USD') {
      effectiveRate = waybill?.usdRate && Number(waybill.usdRate) > 0 ? Number(waybill.usdRate) : 7.20;
    } else if (curr === 'PHP') {
      effectiveRate = waybill?.phpRate && Number(waybill.phpRate) > 0 ? Number(waybill.phpRate) : 8.00;
    }

    const amt = data.amount !== undefined ? Number(data.amount) : Number(fee.amount);
    const { amountInCny } = convertAmountToCny(amt, curr, effectiveRate);

    const updated = await prisma.waybillFee.update({
      where: { id: feeId },
      data: {
        feeName: data.feeName || fee.feeName,
        amount: amt,
        currency: (curr as CurrencyType) || 'CNY',
        exchangeRate: effectiveRate,
        amountInCny,
        note: data.note !== undefined ? data.note : fee.note,
      },
    });

    // 重算运单总账与毛利
    await this.recalculateWaybillTotals(fee.waybillId);

    return updated;
  }

  async addWaybillFee(
    waybillId: string,
    data: {
      feeName: string;
      feeDirection: FeeDirection;
      amount: number;
      currency?: CurrencyType;
      exchangeRate?: number;
      note?: string;
    }
  ) {
    const waybill = await prisma.waybill.findUnique({
      where: { id: waybillId },
      select: { usdRate: true, phpRate: true },
    });

    const curr = (data.currency || 'CNY').toUpperCase();
    let effectiveRate = 1.0;
    if (data.exchangeRate && Number(data.exchangeRate) > 0) {
      effectiveRate = Number(data.exchangeRate);
    } else if (curr === 'USD') {
      effectiveRate = waybill?.usdRate && Number(waybill.usdRate) > 0 ? Number(waybill.usdRate) : 7.20;
    } else if (curr === 'PHP') {
      effectiveRate = waybill?.phpRate && Number(waybill.phpRate) > 0 ? Number(waybill.phpRate) : 8.00;
    }

    const { amountInCny } = convertAmountToCny(Number(data.amount || 0), curr, effectiveRate);

    const fee = await prisma.waybillFee.create({
      data: {
        waybillId,
        feeName: data.feeName,
        feeDirection: data.feeDirection,
        amount: data.amount,
        currency: (curr as CurrencyType) || 'CNY',
        exchangeRate: effectiveRate,
        amountInCny,
        note: data.note,
      },
    });

    // Recalculate waybill summary
    await this.recalculateWaybillTotals(waybillId);

    return fee;
  }

  async deleteWaybillFee(feeId: string) {
    const fee = await prisma.waybillFee.findUnique({ where: { id: feeId } });
    if (!fee) return null;
    if (fee.isPaid) throw new Error('已结清条目已被锁定，严禁直接删除');

    const waybillId = fee.waybillId;
    await prisma.waybillFee.delete({ where: { id: feeId } });
    await this.recalculateWaybillTotals(waybillId);
    return true;
  }

  async addWaybillAttachment(
    waybillId: string,
    data: {
      attachmentType: AttachmentType;
      fileUrl: string;
      fileName?: string;
      fileSize?: number;
      fileType?: string;
    }
  ) {
    return prisma.waybillAttachment.create({
      data: {
        waybillId,
        attachmentType: data.attachmentType || 'OTHER',
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileSize: data.fileSize,
        fileType: data.fileType,
      },
    });
  }

  async deleteWaybillAttachment(attachmentId: string) {
    return prisma.waybillAttachment.delete({ where: { id: attachmentId } });
  }

  private async recalculateWaybillTotals(waybillId: string) {
    const waybill = await prisma.waybill.findUnique({
      where: { id: waybillId },
      include: { items: true, fees: true },
    });
    if (!waybill) return;

    const financials = calculateWaybillFinancials({
      orderType: waybill.orderType,
      isFixedPrice: waybill.isFixedPrice,
      fixedPriceAmount: waybill.fixedPriceAmount ? Number(waybill.fixedPriceAmount) : undefined,
      settlementCurrency: waybill.settlementCurrency,
      currentReceivableAmount: waybill.receivableAmount ? Number(waybill.receivableAmount) : undefined,
      usdRate: waybill.usdRate ? Number(waybill.usdRate) : undefined,
      phpRate: waybill.phpRate ? Number(waybill.phpRate) : undefined,
      items: waybill.items as any,
      fees: waybill.fees as any,
    });

    await prisma.waybill.update({
      where: { id: waybillId },
      data: {
        receivableAmount: financials.receivableAmount,
        payableAmount: financials.payableAmount,
        profitAmount: financials.profitAmount,
        rawReceivableAmount: financials.rawReceivableAmount,
      },
    });
  }
}
