import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import socketio from 'fastify-socket.io';
import { authRoutes } from './modules/auth/routes';
import { quickOrderRoutes } from './modules/order/quick-order.routes';
import { contactRoutes } from './modules/order/contact.routes';
import { paymentCollectionRoutes } from './modules/order/payment-collection.routes';
import { uploadRoutes } from './modules/order/upload.routes';
import { trackingRoutes } from './modules/tracking/routes';
import { paymentRoutes } from './modules/payment/routes';
import { userRoutes } from './modules/user/user.routes';
import { vesselRoutes } from './modules/vessel/routes';
import { customerV2Routes } from './modules/v2/customer/customer.routes';
import { waybillV2Routes } from './modules/v2/waybill/waybill.routes';
import { containerV2Routes } from './modules/v2/container/container.routes';
import { financeV2Routes } from './modules/v2/finance/finance.routes';
import { channelV2Routes } from './modules/v2/channel/channel.routes';
import { originWarehouseV2Routes } from './modules/v2/origin-warehouse/origin-warehouse.routes';
import { uploadV2Routes } from './modules/v2/upload/upload.routes';
import { importV2Routes } from './modules/v2/import/import.routes';
import { authenticate } from './lib/jwt';

type SocketLike = {
  id: string;
  join(room: string): void;
  on(event: 'subscribe', handler: (trackingNumber: string) => void): void;
  on(event: 'disconnect', handler: () => void): void;
};

type FastifyWithIo = typeof fastify & {
  io: {
    on(event: 'connection', handler: (socket: SocketLike) => void): void;
  };
};

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

async function start() {
  try {
    await fastify.register(cors, {
      origin: true,
      credentials: true,
    });

    await fastify.register(jwt, {
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      sign: { expiresIn: '1d' },
    });

    fastify.decorate('authenticate', authenticate);

    await fastify.register(socketio, {
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || '*',
        credentials: true,
      },
    });

    (fastify as FastifyWithIo).io.on('connection', (socket) => {
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
    await fastify.register(quickOrderRoutes, { prefix: '/api/orders/quick' });
    await fastify.register(contactRoutes, { prefix: '/api/contacts' });
    await fastify.register(paymentCollectionRoutes, { prefix: '/api/payment-collections' });
    await fastify.register(multipart, {
      limits: { fileSize: 10 * 1024 * 1024 },
    });
    await fastify.register(uploadRoutes, { prefix: '/api' });
    await fastify.register(trackingRoutes, { prefix: '/api/tracking' });
    await fastify.register(paymentRoutes, { prefix: '/api/payments' });
    await fastify.register(userRoutes, { prefix: '/api/users' });
    await fastify.register(vesselRoutes, { prefix: '/api/vessel' });

    // V2 Refactored Logistics Routes
    await fastify.register(customerV2Routes, { prefix: '/api/v2/customers' });
    await fastify.register(waybillV2Routes, { prefix: '/api/v2/waybills' });
    await fastify.register(containerV2Routes, { prefix: '/api/v2/containers' });
    await fastify.register(financeV2Routes, { prefix: '/api/v2/finance' });
    await fastify.register(channelV2Routes, { prefix: '/api/v2/channels' });
    await fastify.register(originWarehouseV2Routes, { prefix: '/api/v2/origin-warehouses' });
    await fastify.register(uploadV2Routes, { prefix: '/api/v2' });
    await fastify.register(importV2Routes, { prefix: '/api/v2/import' });

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
// restarted at 2026/8/21 13:48:06
