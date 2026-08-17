import { FastifyInstance } from 'fastify';
import { ContainerV2Service, CreateContainerInput } from './container.service';
import { ContainerStatus, ContainerFeeSubject, FeeDirection, CurrencyType } from '@prisma/client';

const containerService = new ContainerV2Service();

export async function containerV2Routes(fastify: FastifyInstance) {
  // List containers
  fastify.get<{
    Querystring: {
      status?: ContainerStatus;
      search?: string;
      originPort?: string;
      destinationPort?: string;
      page?: number;
      limit?: number;
    };
  }>('/', async (request, reply) => {
    try {
      const res = await containerService.getContainers(request.query);
      return reply.send({ success: true, ...res });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // Get container details
  fastify.get<{
    Params: { id: string };
  }>('/:id', async (request, reply) => {
    try {
      const container = await containerService.getContainerById(request.params.id);
      if (!container) {
        return reply.code(404).send({ success: false, error: 'Container not found' });
      }
      return reply.send({ success: true, data: container });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // Create container
  fastify.post<{
    Body: CreateContainerInput;
  }>('/', async (request, reply) => {
    try {
      const created = await containerService.createContainer(request.body);
      return reply.code(201).send({ success: true, data: created });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.code(400).send({ success: false, error: '柜号已存在' });
      }
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // Update container
  fastify.patch<{
    Params: { id: string };
    Body: any;
  }>('/:id', async (request, reply) => {
    try {
      const updated = await containerService.updateContainer(request.params.id, request.body);
      return reply.send({ success: true, data: updated });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // Add container fee
  fastify.post<{
    Params: { id: string };
    Body: {
      feeSubject: ContainerFeeSubject;
      feeDirection?: FeeDirection;
      amount: number;
      currency?: CurrencyType;
      exchangeRate?: number;
      note?: string;
    };
  }>('/:id/fees', async (request, reply) => {
    try {
      const fee = await containerService.addContainerFee(request.params.id, request.body);
      return reply.code(201).send({ success: true, data: fee });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // Delete container fee
  fastify.delete<{
    Params: { id: string; feeId: string };
  }>('/fees/:feeId', async (request, reply) => {
    try {
      await containerService.deleteContainerFee(request.params.feeId);
      return reply.send({ success: true, message: 'Fee deleted' });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // Delete container
  fastify.delete<{
    Params: { id: string };
  }>('/:id', async (request, reply) => {
    try {
      await containerService.deleteContainer(request.params.id);
      return reply.send({ success: true, message: 'Container deleted' });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });
}
