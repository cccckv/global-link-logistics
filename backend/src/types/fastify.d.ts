import { FastifyRequest } from 'fastify';
import { JWTPayload } from '../lib/jwt';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
  }

  interface FastifyRequest {
    user?: JWTPayload;
  }
}
