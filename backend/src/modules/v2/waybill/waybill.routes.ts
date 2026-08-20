import { FastifyInstance } from 'fastify';
import { WaybillV2Service, CreateWaybillInput } from './waybill.service';
import { ShipmentType, WaybillStatus } from '@prisma/client';

const waybillService = new WaybillV2Service();

export async function waybillV2Routes(fastify: FastifyInstance) {
  // List waybills with filters
  fastify.get<{
    Querystring: {
      orderType?: ShipmentType;
      status?: WaybillStatus;
      search?: string;
      containerId?: string;
      userMark?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    };
  }>('/', async (request, reply) => {
    try {
      const res = await waybillService.getWaybills(request.query);
      return reply.send({ success: true, ...res });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // Get waybill details
  fastify.get<{
    Params: { id: string };
  }>('/:id', async (request, reply) => {
    try {
      const waybill = await waybillService.getWaybillById(request.params.id);
      if (!waybill) {
        return reply.code(404).send({ success: false, error: 'Waybill not found' });
      }
      return reply.send({ success: true, data: waybill });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // Create new waybill
  fastify.post<{
    Body: CreateWaybillInput;
  }>('/', async (request, reply) => {
    try {
      const waybill = await waybillService.createWaybill(request.body);
      return reply.code(201).send({ success: true, data: waybill });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // Update waybill (Support PATCH, PUT and POST for proxy compatibility)
  const updateWaybillHandler = async (request: any, reply: any) => {
    try {
      const updated = await waybillService.updateWaybill(request.params.id, request.body as any);
      return reply.send({ success: true, data: updated });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  };

  fastify.patch('/:id', updateWaybillHandler);
  fastify.put('/:id', updateWaybillHandler);
  fastify.post('/:id/update', updateWaybillHandler);
  fastify.post('/:id', updateWaybillHandler);

  // Batch assign container
  fastify.post<{
    Body: {
      waybillIds: string[];
      containerId: string;
      loadingDate?: string;
    };
  }>('/batch-assign-container', async (request, reply) => {
    try {
      const { waybillIds, containerId, loadingDate } = request.body;
      const res = await waybillService.batchAssignContainer(waybillIds, containerId, loadingDate);
      return reply.send({ success: true, updatedCount: res.count });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // Delete waybill
  fastify.delete<{
    Params: { id: string };
  }>('/:id', async (request, reply) => {
    try {
      await waybillService.deleteWaybill(request.params.id);
      return reply.send({ success: true, message: 'Waybill deleted' });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });
}
