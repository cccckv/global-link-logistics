import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { getUserFromRequest } from '../../lib/jwt';

const prisma = new PrismaClient();

export async function trackingRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Querystring: {
      orderId?: string;
      receiverPhone?: string;
      trackingNumber?: string;
    };
  }>('/search', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = getUserFromRequest(request);
    const { orderId, receiverPhone, trackingNumber } = request.query;

    if (!orderId && !receiverPhone && !trackingNumber) {
      return reply.code(400).send({ error: '请提供至少一个查询条件' });
    }

    const whereConditions: any[] = [];
    
    if (orderId) {
      whereConditions.push({ id: orderId });
      whereConditions.push({ orderNumber: orderId });
    }
    if (receiverPhone) {
      whereConditions.push({ receiverPhone });
    }
    if (trackingNumber) {
      whereConditions.push({
        shipment: {
          trackingNumber,
        },
      });
    }

    const whereClause = {
      senderPhone: user.phone,
      ...(whereConditions.length > 0 && { OR: whereConditions }),
    };
    
    fastify.log.info({ whereClause, orderId, receiverPhone, trackingNumber }, 'Tracking search query');

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        shipment: {
          include: {
            events: {
              orderBy: { timestamp: 'desc' },
            },
          },
        },
      },
    });

    if (orders.length === 0) {
      return reply.code(404).send({ error: '未找到符合条件的订单' });
    }

    const shipments = orders
      .filter(order => order.shipment)
      .map(order => ({
        shipmentId: order.shipment!.id,
        trackingNumber: order.shipment!.trackingNumber,
        carrier: order.shipment!.carrier,
        currentLocation: order.shipment!.currentLocation,
        currentLat: order.shipment!.currentLat,
        currentLng: order.shipment!.currentLng,
        estimatedArrival: order.shipment!.estimatedArrival?.toISOString(),
        arrivalDate: order.shipment!.arrivalDate?.toISOString(),
        order: {
          orderNumber: order.orderNumber,
          orderId: order.id,
          senderCity: order.senderCity,
          senderCountry: order.senderCountry,
          receiverCity: order.receiverCity,
          receiverCountry: order.receiverCountry,
          receiverName: order.receiverName,
          receiverPhone: order.receiverPhone,
          status: order.status,
          shipmentType: order.shipmentType,
          createdAt: order.createdAt.toISOString(),
        },
        events: order.shipment!.events.map(e => ({
          eventId: e.id,
          status: e.status,
          description: e.description,
          location: e.location,
          lat: e.lat,
          lng: e.lng,
          timestamp: e.timestamp.toISOString(),
        })),
      }));

    return { shipments };
  });

  fastify.get<{
    Params: { trackingNumber: string };
  }>('/:trackingNumber', async (request, reply) => {
    const { trackingNumber } = request.params;

    const shipment = await prisma.shipment.findUnique({
      where: { trackingNumber },
      include: {
        order: {
          select: {
            orderNumber: true,
            senderCity: true,
            senderCountry: true,
            receiverCity: true,
            receiverCountry: true,
            status: true,
            shipmentType: true,
            createdAt: true,
          },
        },
        events: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!shipment) {
      return reply.code(404).send({ error: 'Tracking number not found' });
    }

    return { shipment };
  });

  fastify.post<{
    Body: {
      shipmentId: string;
      status: string;
      description: string;
      location: string;
      lat?: number;
      lng?: number;
      timestamp: string;
    };
  }>('/events', async (request, reply) => {
    const { shipmentId, status, description, location, lat, lng, timestamp } = request.body;

    const event = await prisma.trackingEvent.create({
      data: {
        shipmentId,
        status,
        description,
        location,
        lat,
        lng,
        timestamp: new Date(timestamp),
      },
    });

    fastify.io.to(`shipment:${shipmentId}`).emit('tracking_update', event);

    return reply.code(201).send({ event });
  });
}
