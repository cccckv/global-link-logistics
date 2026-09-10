import { FastifyInstance } from 'fastify';
import { FinanceV2Service, FinanceWorkbenchQueryParams } from './finance.service';
import { FeeDirection, CurrencyType, AttachmentType } from '@prisma/client';
import { authorize } from '../../../lib/auth';
import { exchangeRateService } from './exchange-rate.service';

const financeService = new FinanceV2Service();
const INTERNAL_ROLES = ['ADMIN', 'SALES', 'FINANCE'];
const FINANCE_ROLES = ['ADMIN', 'FINANCE'];

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

  // 财务核算与对账工作台数据聚合接口 (INTERNAL 均可查，业务员只读)
  fastify.get<{
    Querystring: FinanceWorkbenchQueryParams;
  }>(
    '/workbench',
    {
      preHandler: [fastify.authenticate, authorize(INTERNAL_ROLES)],
    },
    async (request, reply) => {
      try {
        const res = await financeService.getFinanceWorkbenchData(request.query);
        return reply.send(res);
      } catch (err: any) {
        return reply.code(500).send({ success: false, error: err.message });
      }
    }
  );

  // 款项条目结清 / 反结清操作 (FINANCE / ADMIN 专属)
  fastify.post<{
    Params: { feeId: string };
    Body: {
      isPaid: boolean;
      paymentMethod?: string;
      paymentNote?: string;
    };
  }>(
    '/fees/:feeId/settle',
    {
      preHandler: [fastify.authenticate, authorize(FINANCE_ROLES)],
    },
    async (request, reply) => {
      try {
        const currentUserName = (request.user as any)?.name || (request.user as any)?.phone || '财务';
        const updated = await financeService.toggleFeeSettlement(request.params.feeId, {
          ...request.body,
          paidBy: currentUserName,
        });
        return reply.send({ success: true, data: updated });
      } catch (err: any) {
        return reply.code(400).send({ success: false, error: err.message });
      }
    }
  );

  // 主运费 / 包干款结清 / 反结清操作 (FINANCE / ADMIN 专属)
  fastify.post<{
    Params: { id: string };
    Body: {
      isSettled: boolean;
      paymentMethod?: string;
      paymentNote?: string;
    };
  }>(
    '/waybills/:id/settle-freight',
    {
      preHandler: [fastify.authenticate, authorize(FINANCE_ROLES)],
    },
    async (request, reply) => {
      try {
        const currentUserName = (request.user as any)?.name || (request.user as any)?.phone || '财务';
        const updated = await financeService.toggleFreightSettlement(request.params.id, {
          ...request.body,
          settledBy: currentUserName,
        });
        return reply.send({ success: true, data: updated });
      } catch (err: any) {
        return reply.code(400).send({ success: false, error: err.message });
      }
    }
  );

  // 财务修改款项金额与汇率 (FINANCE / ADMIN 专属)
  fastify.put<{
    Params: { feeId: string };
    Body: {
      feeName?: string;
      amount?: number;
      currency?: CurrencyType;
      exchangeRate?: number;
      note?: string;
    };
  }>(
    '/fees/:feeId',
    {
      preHandler: [fastify.authenticate, authorize(FINANCE_ROLES)],
    },
    async (request, reply) => {
      try {
        const updated = await financeService.updateWaybillFee(request.params.feeId, request.body);
        return reply.send({ success: true, data: updated });
      } catch (err: any) {
        return reply.code(400).send({ success: false, error: err.message });
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
      containerFeeSubject?: any;
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
