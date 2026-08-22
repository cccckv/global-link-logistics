import { FastifyInstance } from 'fastify';
import { WaybillV2Service, CreateWaybillInput, sanitizeWaybillForCustomer } from './waybill.service';
import { ShipmentType, WaybillStatus } from '@prisma/client';
import { authorize } from '../../../lib/auth';
import { JWTPayload } from '../../../lib/jwt';

const waybillService = new WaybillV2Service();
const INTERNAL_ROLES = ['ADMIN', 'SALES', 'FINANCE'];

export async function waybillV2Routes(fastify: FastifyInstance) {
  // List waybills with filters & customer isolation
  fastify.get<{
    Querystring: {
      orderType?: ShipmentType;
      status?: WaybillStatus;
      search?: string;
      containerId?: string;
      containerNo?: string;
      userMark?: string;
      originWarehouse?: string;
      destinationCountry?: string;
      destinationPort?: string;
      forwarderChannel?: string;
      customsType?: string;
      unassignedOnly?: boolean | string;
      overseasKeyword?: string;
      dateType?: 'createdAt' | 'inboundDate' | 'loadingDate' | 'sailingDate' | 'eta' | 'signedDate';
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    };
  }>(
    '/',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const user = request.user as JWTPayload;
        const queryParams: any = { ...request.query };

        // 普通用户数据隔离拦截
        if (user && user.userRole === 'USER') {
          const allowedMarks = user.shippingMarks || [];
          if (allowedMarks.length === 0) {
            return reply.send({
              success: true,
              data: [],
              pagination: { total: 0, page: 1, limit: Number(queryParams.limit) || 20, totalPages: 0 },
              counts: { ALL: 0, DRAFT: 0, INBOUND: 0, LOADED: 0, IN_TRANSIT: 0, CUSTOMS: 0, DISPATCHING: 0, DELIVERED: 0 },
            });
          }

          // 强制限定在用户绑定的唛头列表中
          queryParams.userMarks = allowedMarks;
        }

        const res = await waybillService.getWaybills(queryParams);

        // 如果是普通用户，对列表结果进行脱敏过滤 (移除同行渠道、应付成本等)
        if (user && user.userRole === 'USER') {
          const sanitizedData = res.data.map(sanitizeWaybillForCustomer);

          return reply.send({
            success: true,
            data: sanitizedData,
            pagination: res.pagination,
            counts: res.counts,
          });
        }

        return reply.send({ success: true, ...res });
      } catch (err: any) {
        return reply.code(500).send({ success: false, error: err.message });
      }
    }
  );

  // Get waybill details (with customer data isolation and desensitization)
  fastify.get<{
    Params: { id: string };
  }>(
    '/:id',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const user = request.user as JWTPayload;
        const waybill = await waybillService.getWaybillById(request.params.id);
        if (!waybill) {
          return reply.code(404).send({ success: false, error: '运单未找到' });
        }

        // 普通用户唛头归属校验与脱敏
        if (user && user.userRole === 'USER') {
          const allowedMarks = user.shippingMarks || [];
          if (!allowedMarks.includes(waybill.userMark)) {
            return reply.code(403).send({ success: false, error: '权限不足：无权查看该运单' });
          }
          return reply.send({ success: true, data: sanitizeWaybillForCustomer(waybill) });
        }

        return reply.send({ success: true, data: waybill });
      } catch (err: any) {
        return reply.code(500).send({ success: false, error: err.message });
      }
    }
  );

  // Create new waybill (Internal only)
  fastify.post<{
    Body: CreateWaybillInput;
  }>(
    '/',
    {
      preHandler: [fastify.authenticate, authorize(INTERNAL_ROLES)],
    },
    async (request, reply) => {
      try {
        const waybill = await waybillService.createWaybill(request.body);
        return reply.code(201).send({ success: true, data: waybill });
      } catch (err: any) {
        return reply.code(500).send({ success: false, error: err.message });
      }
    }
  );

  // Update waybill (Internal only)
  const updateWaybillHandler = async (request: any, reply: any) => {
    try {
      const updated = await waybillService.updateWaybill(request.params.id, request.body as any);
      return reply.send({ success: true, data: updated });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  };

  const updatePreHandler = { preHandler: [fastify.authenticate, authorize(INTERNAL_ROLES)] };

  fastify.patch('/:id', updatePreHandler, updateWaybillHandler);
  fastify.put('/:id', updatePreHandler, updateWaybillHandler);
  fastify.post('/:id/update', updatePreHandler, updateWaybillHandler);
  fastify.post('/:id', updatePreHandler, updateWaybillHandler);

  // Batch assign container (Internal only)
  fastify.post<{
    Body: {
      waybillIds: string[];
      containerId: string;
      loadingDate?: string;
    };
  }>(
    '/batch-assign-container',
    {
      preHandler: [fastify.authenticate, authorize(INTERNAL_ROLES)],
    },
    async (request, reply) => {
      try {
        const { waybillIds, containerId, loadingDate } = request.body;
        const res = await waybillService.batchAssignContainer(waybillIds, containerId, loadingDate);
        return reply.send({ success: true, updatedCount: res.count });
      } catch (err: any) {
        return reply.code(500).send({ success: false, error: err.message });
      }
    }
  );

  // Delete waybill (Internal only)
  fastify.delete<{
    Params: { id: string };
  }>(
    '/:id',
    {
      preHandler: [fastify.authenticate, authorize(INTERNAL_ROLES)],
    },
    async (request, reply) => {
      try {
        await waybillService.deleteWaybill(request.params.id);
        return reply.send({ success: true, message: 'Waybill deleted' });
      } catch (err: any) {
        return reply.code(500).send({ success: false, error: err.message });
      }
    }
  );
}
