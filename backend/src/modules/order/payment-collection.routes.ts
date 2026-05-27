import { FastifyInstance } from 'fastify';
import { PaymentCollectionService } from './payment-collection.service';
import { authorize } from '../../lib/auth';

const service = new PaymentCollectionService();

interface QueryParams {
  orderId?: string;
  page?: string;
  limit?: string;
}

interface UpsertBody {
  totalPieces: number;
  totalVolume?: number;
  totalWeight?: number;
  receivableAmount: number;
  payableAmount: number;
  receivableCurrency?: string;
  payableCurrency?: string;
  carPickupReceivable?: number;
  carPickupActual?: number;
}

interface AddVoucherBody {
  fileUrl: string;
  fileName?: string;
  fileType?: string;
}

function serializeCollection(c: any) {
  return {
    id: c.id,
    orderId: c.orderId,
    totalPieces: c.totalPieces,
    totalVolume: c.totalVolume?.toNumber() ?? null,
    totalWeight: c.totalWeight?.toNumber() ?? null,
    receivableAmount: c.receivableAmount.toNumber(),
    payableAmount: c.payableAmount.toNumber(),
    receivableCurrency: c.receivableCurrency,
    payableCurrency: c.payableCurrency,
    carPickupReceivable: c.carPickupReceivable?.toNumber() ?? null,
    carPickupActual: c.carPickupActual?.toNumber() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    order: c.order ? {
      id: c.order.id,
      orderNumber: c.order.orderNumber,
      orderType: c.order.orderType,
      status: c.order.status,
      destination: c.order.destination,
      warehouse: c.order.warehouse,
      userMark: c.order.userMark,
      mark: c.order.mark,
      createdAt: c.order.createdAt.toISOString(),
      user: c.order.user,
    } : null,
  };
}

export async function paymentCollectionRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: QueryParams }>(
    '/',
    { preHandler: [fastify.authenticate, authorize(['ADMIN'])] },
    async (request) => {
      const { orderId, page, limit } = request.query;
      const result = await service.findAll({
        orderId,
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
      });
      return {
        data: result.data.map(serializeCollection),
        pagination: result.pagination,
      };
    }
  );

  fastify.get<{ Params: { orderId: string } }>(
    '/order/:orderId',
    { preHandler: [fastify.authenticate, authorize(['ADMIN'])] },
    async (request, reply) => {
      const collection = await service.findByOrderId(request.params.orderId);
      if (!collection) return reply.code(404).send({ error: 'Not found' });
      return serializeCollection(collection);
    }
  );

  fastify.put<{ Params: { orderId: string }; Body: UpsertBody }>(
    '/order/:orderId',
    { preHandler: [fastify.authenticate, authorize(['ADMIN'])] },
    async (request, reply) => {
      try {
        const result = await service.upsert(request.params.orderId, request.body);
        return serializeCollection(result);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.code(500).send({ error: error.message });
      }
    }
  );

  fastify.post<{ Params: { orderId: string }; Body: AddVoucherBody }>(
    '/vouchers/:orderId',
    { preHandler: [fastify.authenticate, authorize(['ADMIN'])] },
    async (request, reply) => {
      try {
        const { orderId } = request.params;
        const { fileUrl, fileName, fileType } = request.body;
        const voucher = await service.addVoucher(orderId, fileUrl, fileName, fileType);
        return reply.code(201).send({
          id: voucher.id,
          fileUrl: voucher.fileUrl,
          fileName: voucher.fileName,
          uploadedAt: voucher.uploadedAt.toISOString(),
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.code(500).send({ error: error.message });
      }
    }
  );

  fastify.delete<{ Params: { voucherId: string } }>(
    '/vouchers/:voucherId',
    { preHandler: [fastify.authenticate, authorize(['ADMIN'])] },
    async (request, reply) => {
      try {
        await service.deleteVoucher(request.params.voucherId);
        return { message: 'Deleted' };
      } catch (error: any) {
        fastify.log.error(error);
        return reply.code(500).send({ error: error.message });
      }
    }
  );
}
