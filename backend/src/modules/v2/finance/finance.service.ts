import { PrismaClient, FeeDirection, CurrencyType, AttachmentType } from '@prisma/client';

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

    let baseRecv = 0;
    let basePay = 0;

    waybill.items.forEach(item => {
      const qty = item.quantity || 1;
      const recvPrice = Number(item.receivableUnitPrice) || 0;
      const payPrice = Number(item.payableUnitPrice) || 0;

      if (waybill.orderType === 'AIR') {
        const wt = Number(item.unitWeight) || 0;
        baseRecv += recvPrice * wt * qty;
        basePay += payPrice * wt * qty;
      } else {
        const vol = Number(item.receivableVolume) || 0;
        const payVol = Number(item.payableVolume) || 0;
        baseRecv += recvPrice * vol;
        basePay += payPrice * payVol;
      }
    });

    let finalRecv = waybill.isFixedPrice && waybill.receivableAmount ? Number(waybill.receivableAmount) : baseRecv;
    let finalPay = basePay;

    waybill.fees.forEach(fee => {
      const cny = Number(fee.amountInCny) || 0;
      if (fee.feeDirection === 'RECEIVABLE') {
        finalRecv += cny;
      } else {
        finalPay += cny;
      }
    });

    await prisma.waybill.update({
      where: { id: waybillId },
      data: {
        receivableAmount: finalRecv,
        payableAmount: finalPay,
        profitAmount: finalRecv - finalPay,
      },
    });
  }
}
