import { FastifyInstance } from 'fastify';
import { OriginWarehouseV2Service, CreateOriginWarehouseInput } from './origin-warehouse.service';
import { authorize } from '../../../lib/auth';

const INTERNAL_ROLES = ['ADMIN', 'SALES', 'FINANCE'];

export async function originWarehouseV2Routes(fastify: FastifyInstance) {
  const service = new OriginWarehouseV2Service();

  // GET /api/v2/origin-warehouses
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request) => {
    const query = request.query as {
      isActive?: string;
      search?: string;
    };
    const isActive = query.isActive !== undefined ? query.isActive === 'true' : undefined;
    const warehouses = await service.listWarehouses({
      isActive,
      search: query.search,
    });
    return { success: true, data: warehouses };
  });

  // GET /api/v2/origin-warehouses/:id
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const warehouse = await service.getWarehouseById(id);
    if (!warehouse) {
      return reply.status(404).send({ success: false, error: '起运仓未找到' });
    }
    return { success: true, data: warehouse };
  });

  const internalHandler = { preHandler: [fastify.authenticate, authorize(INTERNAL_ROLES)] };

  // POST /api/v2/origin-warehouses (Internal only)
  fastify.post('/', internalHandler, async (request, reply) => {
    try {
      const body = request.body as CreateOriginWarehouseInput;
      if (!body.name || !body.code || !body.contactName || !body.contactPhone || !body.address) {
        return reply.status(400).send({
          success: false,
          error: '仓库全称、编码、联系人、联系电话及详细地址均为必填项',
        });
      }
      const warehouse = await service.createWarehouse(body);
      return reply.status(201).send({ success: true, data: warehouse });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.status(400).send({ success: false, error: '仓库标识编码已存在，请使用唯一编码' });
      }
      return reply.status(400).send({ success: false, error: err.message });
    }
  });

  // PUT /api/v2/origin-warehouses/:id (Internal only)
  fastify.put('/:id', internalHandler, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Partial<CreateOriginWarehouseInput>;
      const warehouse = await service.updateWarehouse(id, body);
      return { success: true, data: warehouse };
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.status(400).send({ success: false, error: '仓库标识编码已存在，请使用唯一编码' });
      }
      return reply.status(400).send({ success: false, error: err.message });
    }
  });

  // PUT /api/v2/origin-warehouses/:id/set-default (Internal only)
  fastify.put('/:id/set-default', internalHandler, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const warehouse = await service.setDefaultWarehouse(id);
      return { success: true, data: warehouse };
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message });
    }
  });

  // DELETE /api/v2/origin-warehouses/:id (Internal only)
  fastify.delete('/:id', internalHandler, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await service.deleteWarehouse(id);
      return { success: true, message: '起运仓已删除' };
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message });
    }
  });
}
