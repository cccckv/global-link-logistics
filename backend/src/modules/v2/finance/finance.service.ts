import { PrismaClient, FeeDirection, CurrencyType, AttachmentType } from '@prisma/client';
import { calculateWaybillFinancials } from '../waybill/waybill.service';

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
    const rate = data.exchangeRate || 1.0;
    const cny = data.amount * rate;

    const fee = await prisma.waybillFee.create({
      data: {
        waybillId,
        feeName: data.feeName,
        feeDirection: data.feeDirection,
        amount: data.amount,
        currency: data.currency || 'CNY',
        exchangeRate: rate,
        amountInCny: cny,
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
      currentReceivableAmount: waybill.receivableAmount ? Number(waybill.receivableAmount) : undefined,
      items: waybill.items as any,
      fees: waybill.fees as any,
    });


    await prisma.waybill.update({
      where: { id: waybillId },
      data: {
        receivableAmount: financials.receivableAmount,
        payableAmount: financials.payableAmount,
        profitAmount: financials.profitAmount,
      },
    });
  }
}
