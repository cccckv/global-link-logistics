import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import socketio from '@fastify/socket.io';
import { authRoutes } from './modules/auth/routes';
import { orderRoutes } from './modules/order/routes';
import { trackingRoutes } from './modules/tracking/routes';
import { paymentRoutes } from './modules/payment/routes';
import { authenticate } from './lib/jwt';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

async function start() {
  try {
    await fastify.register(cors, {
      origin: process.env.CORS_ORIGIN?.split(',') || '*',
      credentials: true,
    });

    await fastify.register(jwt, {
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    });

    fastify.decorate('authenticate', authenticate);

    await fastify.register(socketio, {
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || '*',
        credentials: true,
      },
    });

    fastify.io.on('connection', (socket) => {
      fastify.log.info(`Socket connected: ${socket.id}`);

      socket.on('subscribe', (trackingNumber: string) => {
        socket.join(`shipment:${trackingNumber}`);
        fastify.log.info(`Socket ${socket.id} subscribed to ${trackingNumber}`);
      });

      socket.on('disconnect', () => {
        fastify.log.info(`Socket disconnected: ${socket.id}`);
      });
    });

    await fastify.register(authRoutes, { prefix: '/api/auth' });
    await fastify.register(orderRoutes, { prefix: '/api/orders' });
    await fastify.register(trackingRoutes, { prefix: '/api/tracking' });
    await fastify.register(paymentRoutes, { prefix: '/api/payments' });

    fastify.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    const port = Number(process.env.BACKEND_PORT) || 3000;
    const host = process.env.BACKEND_HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    
    fastify.log.info(`Server listening on http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
