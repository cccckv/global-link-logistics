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

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: user.userId,
      },
    });

    if (!order) {
      return reply.code(404).send({ error: 'Order not found' });
    }

    const existingPayment = await prisma.payment.findUnique({
      where: { orderId },
    });

    if (existingPayment && existingPayment.status === 'COMPLETED') {
      return reply.code(400).send({ error: 'Order already paid' });
    }

    const payment = await prisma.payment.upsert({
      where: { orderId },
      create: {
        orderId,
        userId: user.userId,
        amount: order.totalAmount,
        currency: order.currency,
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
