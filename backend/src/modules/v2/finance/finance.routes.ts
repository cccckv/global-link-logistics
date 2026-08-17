import { FastifyInstance } from 'fastify';
import { FinanceV2Service } from './finance.service';
import { FeeDirection, CurrencyType, AttachmentType } from '@prisma/client';

const financeService = new FinanceV2Service();

export async function financeV2Routes(fastify: FastifyInstance) {
  // Add fee item to waybill
  fastify.post<{
    Params: { id: string };
    Body: {
      feeName: string;
      feeDirection: FeeDirection;
      amount: number;
      currency?: CurrencyType;
      exchangeRate?: number;
      note?: string;
    };
  }>('/waybills/:id/fees', async (request, reply) => {
    try {
      const fee = await financeService.addWaybillFee(request.params.id, request.body);
      return reply.code(201).send({ success: true, data: fee });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // Delete fee item from waybill
  fastify.delete<{
    Params: { feeId: string };
  }>('/fees/:feeId', async (request, reply) => {
    try {
      await financeService.deleteWaybillFee(request.params.feeId);
      return reply.send({ success: true, message: 'Fee deleted' });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // Add attachment to waybill (Unified Attachment Pool)
  fastify.post<{
    Params: { id: string };
    Body: {
      attachmentType: AttachmentType;
      fileUrl: string;
      fileName?: string;
      fileSize?: number;
      fileType?: string;
    };
  }>('/waybills/:id/attachments', async (request, reply) => {
    try {
      const att = await financeService.addWaybillAttachment(request.params.id, request.body);
      return reply.code(201).send({ success: true, data: att });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // Delete attachment
  fastify.delete<{
    Params: { attachmentId: string };
  }>('/attachments/:attachmentId', async (request, reply) => {
    try {
      await financeService.deleteWaybillAttachment(request.params.attachmentId);
      return reply.send({ success: true, message: 'Attachment deleted' });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });
}
