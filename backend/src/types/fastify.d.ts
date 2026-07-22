import { FastifyRequest } from 'fastify';
import type { Server as SocketIOServer } from 'socket.io';
import { JWTPayload } from '../lib/jwt';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
    io: SocketIOServer;
  }

  interface FastifyRequest {
    user?: JWTPayload;
  }
}
