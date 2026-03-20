import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { getUserFromRequest } from '../../lib/jwt';

const prisma = new PrismaClient();

export async function orderRoutes(fastify: FastifyInstance) {
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const user = getUserFromRequest(request);
    
    const orders = await prisma.order.findMany({
      where: { userId: user.userId },
      include: {
        shipment: true,
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const mappedOrders = orders.map(order => ({
      orderId: order.id,
      userId: order.userId,
      senderName: order.senderName,
      senderPhone: order.senderPhone,
      senderAddress: order.senderAddress,
      receiverName: order.receiverName,
      receiverPhone: order.receiverPhone,
      receiverAddress: order.receiverAddress,
      receiverCountry: order.receiverCountry,
      weight: order.weight,
      shipmentType: order.shipmentType,
      status: order.status,
      totalAmount: order.totalAmount,
      currency: order.currency,
      createdAt: order.createdAt.toISOString(),
      shipment: order.shipment ? {
        shipmentId: order.shipment.id,
        trackingNumber: order.shipment.trackingNumber,
        carrier: order.shipment.carrier,
        estimatedDelivery: order.shipment.estimatedArrival?.toISOString(),
        actualDelivery: order.shipment.arrivalDate?.toISOString(),
        currentLocation: order.shipment.currentLocation,
        currentLat: order.shipment.currentLat,
        currentLng: order.shipment.currentLng,
        events: [],
      } : undefined,
      payment: order.payment,
    }));

    return mappedOrders;
  });

  fastify.get<{
    Params: { id: string };
  }>('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = getUserFromRequest(request);
    const { id } = request.params;

    const order = await prisma.order.findFirst({
      where: {
        id,
        userId: user.userId,
      },
      include: {
        shipment: {
          include: {
            events: {
              orderBy: { timestamp: 'desc' },
            },
          },
        },
        payment: true,
      },
    });

    if (!order) {
      return reply.code(404).send({ error: 'Order not found' });
    }

    const mappedOrder = {
      orderId: order.id,
      userId: order.userId,
      senderName: order.senderName,
      senderPhone: order.senderPhone,
      senderAddress: order.senderAddress,
      receiverName: order.receiverName,
      receiverPhone: order.receiverPhone,
      receiverAddress: order.receiverAddress,
      receiverCountry: order.receiverCountry,
      weight: order.weight,
      shipmentType: order.shipmentType,
      status: order.status,
      totalAmount: order.totalAmount,
      currency: order.currency,
      createdAt: order.createdAt.toISOString(),
      shipment: order.shipment ? {
        shipmentId: order.shipment.id,
        trackingNumber: order.shipment.trackingNumber,
        carrier: order.shipment.carrier,
        estimatedDelivery: order.shipment.estimatedArrival?.toISOString(),
        actualDelivery: order.shipment.arrivalDate?.toISOString(),
        currentLocation: order.shipment.currentLocation,
        currentLat: order.shipment.currentLat,
        currentLng: order.shipment.currentLng,
        events: order.shipment.events.map(e => ({
          eventId: e.id,
          status: e.status,
          location: e.location,
          description: e.description,
          timestamp: e.timestamp.toISOString(),
          lat: e.lat,
          lng: e.lng,
        })),
      } : undefined,
      payment: order.payment,
    };

    return mappedOrder;
  });

  fastify.post<{
    Body: {
      senderName: string;
      senderPhone: string;
      senderAddress: string;
      receiverName: string;
      receiverPhone: string;
      receiverAddress: string;
      receiverCountry: string;
      weight: number;
      shipmentType: 'SEA' | 'AIR' | 'EXPRESS';
    };
  }>('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = getUserFromRequest(request);
    const data = request.body;

    const orderNumber = `GL${Date.now()}${Math.floor(Math.random() * 1000)}`;
    
    let totalAmount = 0;
    if (data.shipmentType === 'SEA') {
      totalAmount = data.weight * 5;
    } else if (data.shipmentType === 'AIR') {
      totalAmount = data.weight * 15;
    } else {
      totalAmount = data.weight * 25;
    }

    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId: user.userId,
        senderName: data.senderName,
        senderPhone: data.senderPhone,
        senderAddress: data.senderAddress,
        senderCity: '',
        senderCountry: '',
        senderPostal: '',
        receiverName: data.receiverName,
        receiverPhone: data.receiverPhone,
        receiverAddress: data.receiverAddress,
        receiverCity: '',
        receiverCountry: data.receiverCountry,
        receiverPostal: '',
        weight: data.weight,
        shipmentType: data.shipmentType,
        totalAmount,
        currency: 'USD',
        status: 'PENDING',
      },
    });

    const mappedOrder = {
      orderId: order.id,
      userId: order.userId,
      senderName: order.senderName,
      senderPhone: order.senderPhone,
      senderAddress: order.senderAddress,
      receiverName: order.receiverName,
      receiverPhone: order.receiverPhone,
      receiverAddress: order.receiverAddress,
      receiverCountry: order.receiverCountry,
      weight: order.weight,
      shipmentType: order.shipmentType,
      status: order.status,
      totalAmount: order.totalAmount,
      currency: order.currency,
      createdAt: order.createdAt.toISOString(),
    };

    return reply.code(201).send(mappedOrder);
  });
}
