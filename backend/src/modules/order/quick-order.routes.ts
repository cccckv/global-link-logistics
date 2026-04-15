import { FastifyInstance } from 'fastify';
import { QuickOrderService } from './quick-order.service';
import { getUserFromRequest } from '../../lib/jwt';
import { authorize } from '../../lib/auth';
import { QuickOrderType, QuickOrderStatus } from '@prisma/client';

const service = new QuickOrderService();

interface CreateQuickOrderBody {
  orderType: QuickOrderType;
  warehouse?: string;
  destination: string;
  note?: string;
  userMark?: string;
  mark?: string;
  originPort?: string;
  destinationPort?: string;
  
  pickupAddress?: {
    name: string;
    company?: string;
    phone: string;
    region?: string;
    address: string;
  };
  
  recipientAddress: {
    name: string;
    company?: string;
    phone: string;
    region?: string;
    address: string;
  };
  
  declarations?: Array<{
    trackingNumber?: string;
    productName: string;
    length?: number;
    width?: number;
    height?: number;
    weight: number;
    cnyUnitPrice?: number;
    phpUnitPrice?: number;
    channelUnitPricePhp?: number;
  }>;
  
  containers?: Array<{
    containerType: 'GP_20' | 'GP_40' | 'HQ_40' | 'HQ_45';
    quantity: number;
    weight?: number;
    productsJson?: string;
  }>;
}

interface QueryParams {
  orderType?: QuickOrderType;
  status?: QuickOrderStatus;
  startDate?: string;
  endDate?: string;
  page?: string;
  limit?: string;
  searchType?: 'trackingNumber' | 'orderNumber' | 'productName' | 'warehouseNumber';
  keyword?: string;
  mark?: string;
}

export async function quickOrderRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: CreateQuickOrderBody }>(
    '/',
    {
      preHandler: [fastify.authenticate, authorize(['ADMIN'])],
    },
    async (request, reply) => {
      try {
        const user = getUserFromRequest(request);
        const data = request.body;
        
        const order = await service.create(user.userId, data);
        
        return reply.code(201).send({
          orderId: order.id,
          orderNumber: order.orderNumber,
          orderType: order.orderType,
          status: order.status,
          destination: order.destination,
          createdAt: order.createdAt.toISOString(),
          pickupAddress: order.pickupAddress,
          recipientAddress: order.recipientAddress,
          declarations: order.declarations.map(d => ({
            ...d,
            length: d.length?.toNumber(),
            width: d.width?.toNumber(),
            height: d.height?.toNumber(),
            weight: d.weight.toNumber(),
            cnyUnitPrice: d.cnyUnitPrice?.toNumber(),
            phpUnitPrice: d.phpUnitPrice?.toNumber(),
            channelUnitPricePhp: d.channelUnitPricePhp?.toNumber(),
          })),
          containers: order.containers.map(c => ({
            ...c,
            weight: c.weight?.toNumber(),
          })),
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.code(500).send({ 
          error: 'Failed to create order',
          message: error.message 
        });
      }
    }
  );

  fastify.get<{ Querystring: QueryParams }>(
    '/',
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const user = getUserFromRequest(request);
      const query = request.query;
      
      const filters = {
        orderType: query.orderType,
        status: query.status,
        startDate: query.startDate,
        endDate: query.endDate,
        page: query.page ? parseInt(query.page) : undefined,
        limit: query.limit ? parseInt(query.limit) : undefined,
        searchType: query.searchType,
        keyword: query.keyword,
        mark: query.mark,
      };
      
      const result = await service.findAll(user.userId, filters);
      
      return {
        data: result.data.map(order => ({
          orderId: order.id,
          orderNumber: order.orderNumber,
          orderType: order.orderType,
          status: order.status,
          destination: order.destination,
          warehouse: order.warehouse,
          note: order.note,
          userMark: order.userMark,
          mark: order.mark,
          originPort: order.originPort,
          destinationPort: order.destinationPort,
          createdAt: order.createdAt.toISOString(),
          updatedAt: order.updatedAt?.toISOString(),
          pickupAddress: order.pickupAddress ? {
            ...order.pickupAddress,
            createdAt: order.pickupAddress.createdAt.toISOString(),
            updatedAt: order.pickupAddress.updatedAt.toISOString(),
          } : undefined,
          recipientAddress: order.recipientAddress ? {
            ...order.recipientAddress,
            createdAt: order.recipientAddress.createdAt.toISOString(),
            updatedAt: order.recipientAddress.updatedAt.toISOString(),
          } : undefined,
          declarations: order.declarations?.map(d => ({
            id: d.id,
            trackingNumber: d.trackingNumber,
            productName: d.productName,
            length: d.length?.toNumber(),
            width: d.width?.toNumber(),
            height: d.height?.toNumber(),
            weight: d.weight.toNumber(),
            cnyUnitPrice: d.cnyUnitPrice?.toNumber(),
            phpUnitPrice: d.phpUnitPrice?.toNumber(),
            channelUnitPricePhp: d.channelUnitPricePhp?.toNumber(),
          })),
          containers: order.containers?.map(c => ({
            id: c.id,
            containerType: c.containerType,
            quantity: c.quantity,
            weight: c.weight?.toNumber(),
            productsJson: c.productsJson,
          })),
          shipment: order.shipment ? {
            shipmentId: order.shipment.id,
            trackingNumber: order.shipment.trackingNumber,
            carrier: order.shipment.carrier,
            currentLocation: order.shipment.currentLocation,
          } : null,
          payment: order.payment ? {
            paymentId: order.payment.id,
            status: order.payment.status,
            amount: order.payment.amount.toNumber(),
          } : null,
        })),
        pagination: result.pagination,
      };
    }
  );

  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const user = getUserFromRequest(request);
      const { id } = request.params;
      
      const order = await service.findOne(id, user.userId);
      
      if (!order) {
        return reply.code(404).send({ error: 'Order not found' });
      }
      
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        status: order.status,
        warehouse: order.warehouse,
        destination: order.destination,
        note: order.note,
        userMark: order.userMark,
        mark: order.mark,
        originPort: order.originPort,
        destinationPort: order.destinationPort,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        
        pickupAddress: order.pickupAddress ? {
          ...order.pickupAddress,
          createdAt: order.pickupAddress.createdAt.toISOString(),
          updatedAt: order.pickupAddress.updatedAt.toISOString(),
        } : undefined,
        recipientAddress: order.recipientAddress ? {
          ...order.recipientAddress,
          createdAt: order.recipientAddress.createdAt.toISOString(),
          updatedAt: order.recipientAddress.updatedAt.toISOString(),
        } : undefined,
        
        declarations: order.declarations.map(d => ({
          id: d.id,
          trackingNumber: d.trackingNumber,
          productName: d.productName,
          length: d.length?.toNumber(),
          width: d.width?.toNumber(),
          height: d.height?.toNumber(),
          weight: d.weight.toNumber(),
          cnyUnitPrice: d.cnyUnitPrice?.toNumber(),
          phpUnitPrice: d.phpUnitPrice?.toNumber(),
        })),
        
        containers: order.containers.map(c => ({
          id: c.id,
          containerType: c.containerType,
          quantity: c.quantity,
          weight: c.weight?.toNumber(),
          productsJson: c.productsJson,
        })),
        
        shipment: order.shipment ? {
          shipmentId: order.shipment.id,
          trackingNumber: order.shipment.trackingNumber,
          carrier: order.shipment.carrier,
          originPort: order.shipment.originPort,
          destinationPort: order.shipment.destinationPort,
          estimatedArrival: order.shipment.estimatedArrival?.toISOString(),
          currentLocation: order.shipment.currentLocation,
          currentLat: order.shipment.currentLat,
          currentLng: order.shipment.currentLng,
          events: order.shipment.events.map(e => ({
            eventId: e.id,
            status: e.status,
            description: e.description,
            location: e.location,
            lat: e.lat,
            lng: e.lng,
            timestamp: e.timestamp.toISOString(),
          })),
        } : null,
        
        payment: order.payment ? {
          paymentId: order.payment.id,
          amount: order.payment.amount.toNumber(),
          currency: order.payment.currency,
          status: order.payment.status,
          paidAt: order.payment.paidAt?.toISOString(),
        } : null,
        
        batchTask: order.batchTask ? {
          taskId: order.batchTask.id,
          status: order.batchTask.status,
          fileName: order.batchTask.fileName,
        } : null,
        
        paymentVouchers: order.paymentVouchers?.map(v => ({
          id: v.id,
          fileUrl: v.fileUrl,
          fileName: v.fileName,
          fileType: v.fileType,
          fileSize: v.fileSize,
          uploadedAt: v.uploadedAt.toISOString(),
        })) || [],
        
        paymentCollections: order.paymentCollections?.map(pc => ({
          id: pc.id,
          orderId: pc.orderId,
          declarationId: pc.declarationId,
          channelUnitPricePhp: pc.channelUnitPricePhp.toNumber(),
          receivableFreightAmount: pc.receivableFreightAmount.toNumber(),
          receivableOtherAmount: pc.receivableOtherAmount?.toNumber(),
          actualReceivedAmount: pc.actualReceivedAmount.toNumber(),
          channelFreightCost: pc.channelFreightCost?.toNumber(),
          channelOtherCost: pc.channelOtherCost?.toNumber(),
          profit: pc.profit?.toNumber(),
        })) || [],
      };
    }
  );

  fastify.patch<{ 
    Params: { id: string };
    Body: { 
      status?: QuickOrderStatus;
      note?: string;
    };
  }>(
    '/:id',
    {
      preHandler: [fastify.authenticate, authorize(['ADMIN'])],
    },
    async (request, reply) => {
      try {
        const user = getUserFromRequest(request);
        const { id } = request.params;
        const data = request.body;
        
        const order = await service.update(id, user.userId, data);
        
        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          note: order.note,
          updatedAt: order.updatedAt.toISOString(),
        };
      } catch (error: any) {
        fastify.log.error(error);
        return reply.code(error.message === 'Order not found' ? 404 : 500).send({
          error: error.message,
        });
      }
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [fastify.authenticate, authorize(['ADMIN'])],
    },
    async (request, reply) => {
      try {
        const user = getUserFromRequest(request);
        const { id } = request.params;
        
        const order = await service.cancel(id, user.userId);
        
        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          message: 'Order cancelled successfully',
        };
      } catch (error: any) {
        fastify.log.error(error);
        return reply.code(error.message === 'Order not found' ? 404 : 400).send({
          error: error.message,
        });
      }
    }
  );

  fastify.get(
    '/counts',
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const user = getUserFromRequest(request);
      const counts = await service.getStatusCounts(user.userId);
      
      return counts;
    }
  );
}
