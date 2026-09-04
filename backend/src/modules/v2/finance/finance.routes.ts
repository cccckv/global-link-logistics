import { FastifyInstance } from 'fastify';
import { FinanceV2Service } from './finance.service';
import { FeeDirection, CurrencyType, AttachmentType } from '@prisma/client';
import { authorize } from '../../../lib/auth';
import { exchangeRateService } from './exchange-rate.service';

const financeService = new FinanceV2Service();
const INTERNAL_ROLES = ['ADMIN', 'SALES', 'FINANCE'];

export async function financeV2Routes(fastify: FastifyInstance) {
  // Get today's live benchmark exchange rates
  fastify.get(
    '/exchange-rate/today',
    {
      preHandler: [fastify.authenticate],
    },
    async (_request, reply) => {
      try {
        const rates = await exchangeRateService.getTodayRates();
        return reply.send({ success: true, data: rates });
      } catch (err: any) {
        return reply.code(500).send({ success: false, error: err.message });
      }
    }
  );

  // Add fee item to waybill (Internal only)
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
  }>(
    '/waybills/:id/fees',
    {
      preHandler: [fastify.authenticate, authorize(INTERNAL_ROLES)],
    },
    async (request, reply) => {
      try {
        const fee = await financeService.addWaybillFee(request.params.id, request.body);
        return reply.code(201).send({ success: true, data: fee });
      } catch (err: any) {
        return reply.code(500).send({ success: false, error: err.message });
      }
    }
  );

  // Delete fee item from waybill (Internal only)
  fastify.delete<{
    Params: { feeId: string };
  }>(
    '/fees/:feeId',
    {
      preHandler: [fastify.authenticate, authorize(INTERNAL_ROLES)],
    },
    async (request, reply) => {
      try {
        await financeService.deleteWaybillFee(request.params.feeId);
        return reply.send({ success: true, message: 'Fee deleted' });
      } catch (err: any) {
        return reply.code(500).send({ success: false, error: err.message });
      }
    }
  );

  // Add attachment to waybill (Internal only)
  fastify.post<{
    Params: { id: string };
    Body: {
      attachmentType: AttachmentType;
      fileUrl: string;
      fileName?: string;
      fileSize?: number;
      fileType?: string;
    };
  }>(
    '/waybills/:id/attachments',
    {
      preHandler: [fastify.authenticate, authorize(INTERNAL_ROLES)],
    },
    async (request, reply) => {
      try {
        const att = await financeService.addWaybillAttachment(request.params.id, request.body);
        return reply.code(201).send({ success: true, data: att });
      } catch (err: any) {
        return reply.code(500).send({ success: false, error: err.message });
      }
    }
  );

  // Delete attachment (Internal only)
  fastify.delete<{
    Params: { attachmentId: string };
  }>(
    '/attachments/:attachmentId',
    {
      preHandler: [fastify.authenticate, authorize(INTERNAL_ROLES)],
    },
    async (request, reply) => {
      try {
        await financeService.deleteWaybillAttachment(request.params.attachmentId);
        return reply.send({ success: true, message: 'Attachment deleted' });
      } catch (err: any) {
        return reply.code(500).send({ success: false, error: err.message });
      }
    }
  );
}
