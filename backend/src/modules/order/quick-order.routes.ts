import { FastifyInstance } from 'fastify';
import { QuickOrderService } from './quick-order.service';
import { getUserFromRequest } from '../../lib/jwt';
import { authorize } from '../../lib/auth';
import { PrismaClient, Prisma, QuickOrderType, QuickOrderStatus } from '@prisma/client';

const prisma = new PrismaClient();

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
  voyageNumber?: string;
  markUserId?: string;
  receivedAt?: string;
  receiptUrl?: string;
  receiptFileName?: string;
  carPickupReceivable?: number;
  carPickupActual?: number;

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
    quantity: number;
    length?: number;
    width?: number;
    height?: number;
    weight: number;
    cnyUnitPrice?: number;
    phpUnitPrice?: number;
    channelUnitPricePhp?: number;
    channelUnitPriceCny?: number;
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
            channelUnitPriceCny: d.channelUnitPriceCny?.toNumber(),
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
          voyageNumber: order.voyageNumber,
          createdAt: order.createdAt.toISOString(),
          updatedAt: order.updatedAt?.toISOString(),
          receivedAt: order.receivedAt?.toISOString(),
          recipientAddress: order.recipientAddress ? {
            ...order.recipientAddress,
            createdAt: order.recipientAddress.createdAt.toISOString(),
            updatedAt: order.recipientAddress.updatedAt.toISOString(),
          } : undefined,
          declarations: order.declarations?.map(d => ({
            id: d.id,
            trackingNumber: d.trackingNumber,
            productName: d.productName,
            quantity: d.quantity,
            length: d.length?.toNumber(),
            width: d.width?.toNumber(),
            height: d.height?.toNumber(),
            weight: d.weight.toNumber(),
            cnyUnitPrice: d.cnyUnitPrice?.toNumber(),
            phpUnitPrice: d.phpUnitPrice?.toNumber(),
            channelUnitPricePhp: d.channelUnitPricePhp?.toNumber(),
            channelUnitPriceCny: d.channelUnitPriceCny?.toNumber(),
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
        voyageNumber: order.voyageNumber,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        receivedAt: order.receivedAt?.toISOString(),
        recipientAddress: order.recipientAddress ? {
          ...order.recipientAddress,
          createdAt: order.recipientAddress.createdAt.toISOString(),
          updatedAt: order.recipientAddress.updatedAt.toISOString(),
        } : undefined,

        overseasAddress: order.overseasAddress ? {
          ...order.overseasAddress,
          createdAt: order.overseasAddress.createdAt.toISOString(),
          updatedAt: order.overseasAddress.updatedAt.toISOString(),
        } : undefined,
        
        declarations: order.declarations.map(d => ({
          id: d.id,
          trackingNumber: d.trackingNumber,
          productName: d.productName,
          quantity: d.quantity,
          length: d.length?.toNumber(),
          width: d.width?.toNumber(),
          height: d.height?.toNumber(),
          weight: d.weight.toNumber(),
          cnyUnitPrice: d.cnyUnitPrice?.toNumber(),
          phpUnitPrice: d.phpUnitPrice?.toNumber(),
          channelUnitPricePhp: d.channelUnitPricePhp?.toNumber(),
          channelUnitPriceCny: d.channelUnitPriceCny?.toNumber(),
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
          voucherType: v.voucherType,
          uploadedAt: v.uploadedAt.toISOString(),
        })) || [],
        
        paymentCollection: order.paymentCollections?.[0] ? (() => {
          const pc = order.paymentCollections[0];
          return {
            id: pc.id,
            orderId: pc.orderId,
            totalPieces: pc.totalPieces,
            totalVolume: pc.totalVolume?.toNumber() ?? null,
            totalWeight: pc.totalWeight?.toNumber() ?? null,
            receivableAmount: pc.receivableAmount.toNumber(),
            payableAmount: pc.payableAmount.toNumber(),
            receivableCurrency: pc.receivableCurrency,
            payableCurrency: pc.payableCurrency,
            carPickupReceivable: pc.carPickupReceivable?.toNumber() ?? null,
            carPickupActual: pc.carPickupActual?.toNumber() ?? null,
          };
        })() : null,
      };
    }
  );

  fastify.put<{
    Params: { id: string };
    Body: { declarations: Array<{
      id?: string;
      trackingNumber?: string;
      productName: string;
      quantity: number;
      length?: number;
      width?: number;
      height?: number;
      weight: number;
      cnyUnitPrice?: number;
      phpUnitPrice?: number;
      channelUnitPricePhp?: number;
      channelUnitPriceCny?: number;
    }> };
  }>(
    '/:id/declarations',
    { preHandler: [fastify.authenticate, authorize(['ADMIN'])] },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const { declarations } = request.body;
        await prisma.orderDeclaration.deleteMany({ where: { orderId: id } });
        await prisma.orderDeclaration.createMany({
          data: declarations.map(d => ({ orderId: id, ...d })),
        });
        const updated = await prisma.orderDeclaration.findMany({ where: { orderId: id } });

        const order = await prisma.quickOrder.findUnique({ where: { id }, select: { orderType: true } });
        if (order) {
          const isSeaLcl = order.orderType === 'SEA_LCL';
          const totalPieces = declarations.reduce((s, d) => s + (d.quantity || 1), 0);
          const totalWeight = declarations.reduce((s, d) => s + (d.weight || 0) * (d.quantity || 1), 0);
          const totalVolume = declarations.reduce((s, d) => {
            if (d.length && d.width && d.height) return s + (d.length * d.width * d.height / 1_000_000) * (d.quantity || 1);
            return s;
          }, 0);
          const receivableUsePhp = declarations.some(d => !!d.phpUnitPrice);
          const payableUsePhp = declarations.some(d => !!d.channelUnitPricePhp);
          const receivableAmount = declarations.reduce((s, d) => {
            const price = receivableUsePhp ? (d.phpUnitPrice || 0) : (d.cnyUnitPrice || 0);
            const factor = isSeaLcl
              ? (d.length && d.width && d.height ? (d.length * d.width * d.height / 1_000_000) : 0)
              : (d.weight || 0);
            return s + price * factor * (d.quantity || 1);
          }, 0);
          const payableAmount = declarations.reduce((s, d) => {
            const price = payableUsePhp ? (d.channelUnitPricePhp || 0) : (d.channelUnitPriceCny || 0);
            const factor = isSeaLcl
              ? (d.length && d.width && d.height ? (d.length * d.width * d.height / 1_000_000) : 0)
              : (d.weight || 0);
            return s + price * factor * (d.quantity || 1);
          }, 0);
          await prisma.orderPaymentCollection.upsert({
            where: { orderId: id },
            update: {
              totalPieces,
              totalWeight: new Prisma.Decimal(totalWeight),
              totalVolume: totalVolume > 0 ? new Prisma.Decimal(totalVolume) : null,
              receivableAmount: new Prisma.Decimal(receivableAmount),
              payableAmount: new Prisma.Decimal(payableAmount),
              receivableCurrency: receivableUsePhp ? 'PHP' : 'CNY',
              payableCurrency: payableUsePhp ? 'PHP' : 'CNY',
            },
            create: {
              orderId: id,
              totalPieces,
              totalWeight: new Prisma.Decimal(totalWeight),
              totalVolume: totalVolume > 0 ? new Prisma.Decimal(totalVolume) : null,
              receivableAmount: new Prisma.Decimal(receivableAmount),
              payableAmount: new Prisma.Decimal(payableAmount),
              receivableCurrency: receivableUsePhp ? 'PHP' : 'CNY',
              payableCurrency: payableUsePhp ? 'PHP' : 'CNY',
            },
          });
        }

        return updated.map(d => ({
          ...d,
          length: d.length?.toNumber(),
          width: d.width?.toNumber(),
          height: d.height?.toNumber(),
          weight: d.weight.toNumber(),
          cnyUnitPrice: d.cnyUnitPrice?.toNumber(),
          phpUnitPrice: d.phpUnitPrice?.toNumber(),
          channelUnitPricePhp: d.channelUnitPricePhp?.toNumber(),
          channelUnitPriceCny: d.channelUnitPriceCny?.toNumber(),
        }));
      } catch (error: any) {
        fastify.log.error(error);
        return reply.code(500).send({ error: error.message });
      }
    }
  );

  fastify.patch<{ 
    Params: { id: string };
    Body: { 
      status?: QuickOrderStatus;
      note?: string;
      voyageNumber?: string;
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

  fastify.post<{
    Params: { id: string };
    Body: { fileUrl: string; fileName?: string; fileType?: string; voucherType?: string };
  }>(
    '/:id/vouchers',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const user = getUserFromRequest(request);
        const { id } = request.params;
        const { fileUrl, fileName, fileType, voucherType } = request.body;
        const order = await prisma.quickOrder.findFirst({ where: { id, userId: user.userId }, select: { id: true } });
        if (!order) return reply.code(404).send({ error: 'Order not found' });
        const voucher = await prisma.orderPaymentVoucher.create({
          data: { orderId: id, fileUrl, fileName, fileType, voucherType: (voucherType as any) || 'PAYMENT' },
        });
        return reply.code(201).send({
          id: voucher.id,
          fileUrl: voucher.fileUrl,
          fileName: voucher.fileName,
          fileType: voucher.fileType,
          voucherType: voucher.voucherType,
          uploadedAt: voucher.uploadedAt.toISOString(),
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.code(500).send({ error: error.message });
      }
    }
  );
}
