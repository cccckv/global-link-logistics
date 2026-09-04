import { PrismaClient, FeeDirection, CurrencyType, AttachmentType } from '@prisma/client';
import { calculateWaybillFinancials } from '../waybill/waybill.service';
import { convertAmountToCny } from '../import/dictionary-validator.service';

const prisma = new PrismaClient();

export class FinanceV2Service {
  async addWaybillFee(waybillId: string, data: {
    feeName: string;
    feeDirection: FeeDirection;
    amount: number;
    currency?: CurrencyType;
    exchangeRate?: number;
    note?: string;
  }) {
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

    const waybillId = fee.waybillId;
    await prisma.waybillFee.delete({ where: { id: feeId } });
    await this.recalculateWaybillTotals(waybillId);
    return true;
  }

  async addWaybillAttachment(waybillId: string, data: {
    attachmentType: AttachmentType;
    fileUrl: string;
    fileName?: string;
    fileSize?: number;
    fileType?: string;
  }) {
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
