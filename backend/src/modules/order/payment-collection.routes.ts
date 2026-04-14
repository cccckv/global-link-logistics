import { FastifyInstance } from 'fastify';
import { PaymentCollectionService } from './payment-collection.service';
import { authorize } from '../../lib/auth';

const service = new PaymentCollectionService();

interface QueryParams {
  orderId?: string;
  declarationId?: string;
  page?: string;
  limit?: string;
}

interface UpdatePaymentCollectionBody {
  channelUnitPricePhp?: number;
  receivableFreightAmount?: number;
  receivableOtherAmount?: number;
  actualReceivedAmount?: number;
  channelFreightCost?: number;
  channelOtherCost?: number;
  profit?: number;
}

interface BatchUpdateBody {
  updates: Array<{
    declarationId: string;
    channelUnitPricePhp?: number;
    receivableFreightAmount?: number;
    receivableOtherAmount?: number;
    actualReceivedAmount?: number;
    channelFreightCost?: number;
    channelOtherCost?: number;
    profit?: number;
  }>;
}

interface AddVoucherBody {
  fileUrl: string;
  fileName?: string;
}

export async function paymentCollectionRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: QueryParams }>(
    '/',
    {
      preHandler: [fastify.authenticate, authorize(['ADMIN'])],
    },
    async (request) => {
      const query = request.query;
      
      const filters = {
        orderId: query.orderId,
        declarationId: query.declarationId,
        page: query.page ? parseInt(query.page) : undefined,
        limit: query.limit ? parseInt(query.limit) : undefined,
      };
      
      const result = await service.findAll(filters);
      
      return {
        data: result.data.map((collection: any) => ({
          id: collection.id,
          orderId: collection.orderId,
          declarationId: collection.declarationId,
          channelUnitPricePhp: collection.channelUnitPricePhp.toNumber(),
          receivableFreightAmount: collection.receivableFreightAmount?.toNumber() || 0,
          receivableOtherAmount: collection.receivableOtherAmount?.toNumber() || 0,
          actualReceivedAmount: collection.actualReceivedAmount?.toNumber() || 0,
          channelFreightCost: collection.channelFreightCost?.toNumber() || 0,
          channelOtherCost: collection.channelOtherCost?.toNumber() || 0,
          profit: collection.profit?.toNumber() || 0,
          createdAt: collection.createdAt.toISOString(),
          updatedAt: collection.updatedAt.toISOString(),
          order: collection.order ? {
            id: collection.order.id,
            orderNumber: collection.order.orderNumber,
            orderType: collection.order.orderType,
            status: collection.order.status,
            createdAt: collection.order.createdAt.toISOString(),
          } : null,
          declaration: collection.declaration ? {
            id: collection.declaration.id,
            productName: collection.declaration.productName,
            weight: collection.declaration.weight.toNumber(),
            trackingNumber: collection.declaration.trackingNumber,
          } : null,
        })),
        pagination: result.pagination,
      };
    }
  );

  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [fastify.authenticate, authorize(['ADMIN'])],
    },
    async (request, reply) => {
      const { id } = request.params;
      
      const collection = await service.findOne(id);
      
      if (!collection) {
        return reply.code(404).send({ error: 'Payment collection not found' });
      }
      
      return {
        id: collection.id,
        orderId: collection.orderId,
        declarationId: collection.declarationId,
        channelUnitPricePhp: collection.channelUnitPricePhp.toNumber(),
        receivableFreightAmount: collection.receivableFreightAmount?.toNumber() || 0,
        receivableOtherAmount: collection.receivableOtherAmount?.toNumber() || 0,
        actualReceivedAmount: collection.actualReceivedAmount?.toNumber() || 0,
        channelFreightCost: collection.channelFreightCost?.toNumber() || 0,
        channelOtherCost: collection.channelOtherCost?.toNumber() || 0,
        profit: collection.profit?.toNumber() || 0,
        createdAt: collection.createdAt.toISOString(),
        updatedAt: collection.updatedAt.toISOString(),
        order: collection.order ? {
          id: collection.order.id,
          orderNumber: collection.order.orderNumber,
          orderType: collection.order.orderType,
          status: collection.order.status,
          destination: collection.order.destination,
          createdAt: collection.order.createdAt.toISOString(),
          user: collection.order.user,
        } : null,
        declaration: collection.declaration,
      };
    }
  );

  fastify.patch<{ 
    Params: { id: string };
    Body: UpdatePaymentCollectionBody;
  }>(
    '/:id',
    {
      preHandler: [fastify.authenticate, authorize(['ADMIN'])],
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const data = request.body;
        
        const updated = await service.update(id, data);
        
        return {
          id: updated.id,
          channelUnitPricePhp: updated.channelUnitPricePhp.toNumber(),
          receivableFreightAmount: updated.receivableFreightAmount?.toNumber() || 0,
          receivableOtherAmount: updated.receivableOtherAmount?.toNumber() || 0,
          actualReceivedAmount: updated.actualReceivedAmount?.toNumber() || 0,
          channelFreightCost: updated.channelFreightCost?.toNumber() || 0,
          channelOtherCost: updated.channelOtherCost?.toNumber() || 0,
          profit: updated.profit?.toNumber() || 0,
          updatedAt: updated.updatedAt.toISOString(),
        };
      } catch (error: any) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: 'Failed to update payment collection',
          message: error.message,
        });
      }
    }
  );

  fastify.post<{ 
    Params: { orderId: string };
    Body: BatchUpdateBody;
  }>(
    '/batch/:orderId',
    {
      preHandler: [fastify.authenticate, authorize(['ADMIN'])],
    },
    async (request, reply) => {
      try {
        const { orderId } = request.params;
        const { updates } = request.body;
        
        const results = await service.batchUpdateByOrder(orderId, updates);
        
        return {
          message: 'Batch update successful',
          count: results.length,
          data: results.map((r: any) => ({
            id: r.id,
            declarationId: r.declaration?.id,
            productName: r.declaration?.productName,
            channelUnitPricePhp: r.channelUnitPricePhp.toNumber(),
            actualReceivedAmount: r.actualReceivedAmount?.toNumber() || 0,
            profit: r.profit?.toNumber() || 0,
          })),
        };
      } catch (error: any) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: 'Failed to batch update',
          message: error.message,
        });
      }
    }
  );

  fastify.post<{ 
    Params: { orderId: string };
    Body: AddVoucherBody;
  }>(
    '/vouchers/:orderId',
    {
      preHandler: [fastify.authenticate, authorize(['ADMIN'])],
    },
    async (request, reply) => {
      try {
        const { orderId } = request.params;
        const { fileUrl, fileName } = request.body;
        
        const voucher = await service.addVoucher(orderId, fileUrl, fileName);
        
        return reply.code(201).send({
          id: voucher.id,
          fileUrl: voucher.fileUrl,
          fileName: voucher.fileName,
          uploadedAt: voucher.uploadedAt.toISOString(),
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: 'Failed to add voucher',
          message: error.message,
        });
      }
    }
  );

  fastify.delete<{ Params: { voucherId: string } }>(
    '/vouchers/:voucherId',
    {
      preHandler: [fastify.authenticate, authorize(['ADMIN'])],
    },
    async (request, reply) => {
      try {
        const { voucherId } = request.params;
        
        await service.deleteVoucher(voucherId);
        
        return {
          message: 'Voucher deleted successfully',
        };
      } catch (error: any) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: 'Failed to delete voucher',
          message: error.message,
        });
      }
    }
  );
}
