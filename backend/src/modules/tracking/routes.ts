import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function trackingRoutes(fastify: FastifyInstance) {
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
