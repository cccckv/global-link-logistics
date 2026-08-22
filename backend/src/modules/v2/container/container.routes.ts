import { FastifyInstance } from 'fastify';
import { ContainerV2Service, CreateContainerInput } from './container.service';
import { ContainerStatus, ContainerFeeSubject, FeeDirection, CurrencyType } from '@prisma/client';
import { authorize } from '../../../lib/auth';

const containerService = new ContainerV2Service();
const INTERNAL_ROLES = ['ADMIN', 'SALES', 'FINANCE'];

export async function containerV2Routes(fastify: FastifyInstance) {
  // List containers (Internal only)
  fastify.get<{
    Querystring: {
      status?: ContainerStatus;
      search?: string;
      originPort?: string;
      destinationPort?: string;
      page?: number;
      limit?: number;
    };
  }>(
    '/',
    {
      preHandler: [fastify.authenticate, authorize(INTERNAL_ROLES)],
    },
    async (request, reply) => {
      try {
        const res = await containerService.getContainers(request.query);
        return reply.send({ success: true, ...res });
      } catch (err: any) {
        return reply.code(500).send({ success: false, error: err.message });
      }
    }
  );

  // Get container details (Internal only)
  fastify.get<{
    Params: { id: string };
  }>(
    '/:id',
    {
      preHandler: [fastify.authenticate, authorize(INTERNAL_ROLES)],
    },
    async (request, reply) => {
      try {
        const container = await containerService.getContainerById(request.params.id);
        if (!container) {
          return reply.code(404).send({ success: false, error: 'Container not found' });
        }
        return reply.send({ success: true, data: container });
      } catch (err: any) {
        return reply.code(500).send({ success: false, error: err.message });
      }
    }
  );

  // Create container (Internal only)
  fastify.post<{
    Body: CreateContainerInput;
  }>(
    '/',
    {
      preHandler: [fastify.authenticate, authorize(INTERNAL_ROLES)],
    },
    async (request, reply) => {
      try {
        const created = await containerService.createContainer(request.body);
        return reply.code(201).send({ success: true, data: created });
      } catch (err: any) {
        if (err.code === 'P2002') {
          return reply.code(400).send({ success: false, error: '柜号已存在' });
        }
        return reply.code(500).send({ success: false, error: err.message });
      }
    }
  );

  // Update container (Support PATCH, PUT and POST for proxy compatibility) (Internal only)
  const updateContainerHandler = async (request: any, reply: any) => {
    try {
      const updated = await containerService.updateContainer(request.params.id, request.body as any);
      return reply.send({ success: true, data: updated });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  };

  const internalHandler = { preHandler: [fastify.authenticate, authorize(INTERNAL_ROLES)] };

  fastify.patch('/:id', internalHandler, updateContainerHandler);
  fastify.put('/:id', internalHandler, updateContainerHandler);
  fastify.post('/:id/update', internalHandler, updateContainerHandler);
  fastify.post('/:id', internalHandler, updateContainerHandler);

  // Add container fee (Internal only)
  fastify.post<{
    Params: { id: string };
    Body: {
      feeSubject: ContainerFeeSubject;
      amount: number;
      currency?: CurrencyType;
      exchangeRate?: number;
      feeDirection?: FeeDirection;
      note?: string;
    };
  }>(
    '/:id/fees',
    internalHandler,
    async (request, reply) => {
      try {
        const fee = await containerService.addContainerFee(request.params.id, request.body);
        return reply.code(201).send({ success: true, data: fee });
      } catch (err: any) {
        return reply.code(500).send({ success: false, error: err.message });
      }
    }
  );

  // Delete container fee (Internal only)
  fastify.delete<{
    Params: { feeId: string };
  }>(
    '/fees/:feeId',
    internalHandler,
    async (request, reply) => {
      try {
        await containerService.deleteContainerFee(request.params.feeId);
        return reply.send({ success: true, message: 'Fee deleted' });
      } catch (err: any) {
        return reply.code(500).send({ success: false, error: err.message });
      }
    }
  );

  // Delete container (Internal only)
  fastify.delete<{
    Params: { id: string };
  }>(
    '/:id',
    internalHandler,
    async (request, reply) => {
      try {
        await containerService.deleteContainer(request.params.id);
        return reply.send({ success: true, message: 'Container deleted' });
      } catch (err: any) {
        return reply.code(500).send({ success: false, error: err.message });
      }
    }
  );
}
