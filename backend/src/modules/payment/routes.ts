import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { getUserFromRequest } from '../../lib/jwt';

const prisma = new PrismaClient();

export async function paymentRoutes(fastify: FastifyInstance) {
  fastify.post<{
    Body: {
      orderId: string;
    };
  }>('/create-intent', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = getUserFromRequest(request);
    const { orderId } = request.body;

    const order = await prisma.quickOrder.findFirst({
      where: {
        id: orderId,
        userId: user.userId,
      },
      include: {
        payment: true,
        paymentCollections: true,
      },
    });

    if (!order) {
      return reply.code(404).send({ error: 'Order not found' });
    }

    const existingPayment = await prisma.payment.findUnique({
      where: { quickOrderId: order.id },
    });

    if (existingPayment && existingPayment.status === 'COMPLETED') {
      return reply.code(400).send({ error: 'Order already paid' });
    }

    const collection = order.paymentCollections[0];

    if (!collection) {
      return reply.code(400).send({ error: 'No payable amount found for this order' });
    }

    const payment = await prisma.payment.upsert({
      where: { quickOrderId: order.id },
      create: {
        quickOrderId: order.id,
        userId: user.userId,
        amount: collection.payableAmount,
        currency: collection.payableCurrency,
        status: 'PENDING',
      },
      update: {
        status: 'PENDING',
      },
    });

    const clientSecret = `pi_mock_${payment.id}`;

    return { clientSecret, paymentId: payment.id };
  });

  fastify.post('/webhook', async (request, reply) => {
    const event = request.body as any;

    fastify.log.info({ event }, 'Payment webhook received');

    return reply.code(200).send({ received: true });
  });
}
