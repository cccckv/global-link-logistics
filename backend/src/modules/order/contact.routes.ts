import { FastifyInstance } from 'fastify';
import { ContactService } from './contact.service';
import { getUserFromRequest } from '../../lib/jwt';
import { authorize } from '../../lib/auth';

const service = new ContactService();

export async function contactRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/recipient',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const user = getUserFromRequest(request);
      const addresses = await service.getRecipientAddresses(user.userId);
      return { data: addresses };
    }
  );

  fastify.get(
    '/overseas',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const user = getUserFromRequest(request);
      const addresses = await service.getOverseasAddresses(user.userId);
      return { data: addresses };
    }
  );

  fastify.get<{ Querystring: { forUserId: string } }>(
    '/overseas/by-user',
    { preHandler: [fastify.authenticate, authorize(['ADMIN'])] },
    async (request, reply) => {
      const { forUserId } = request.query;
      if (!forUserId) {
        return reply.code(400).send({ error: 'forUserId is required' });
      }
      const addresses = await service.getOverseasAddresses(forUserId);
      return { data: addresses };
    }
  );

  fastify.put<{ Params: { id: string } }>(
    '/recipient/:id/set-default',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const user = getUserFromRequest(request);
        const { id } = request.params;
        const address = await service.setDefaultRecipientAddress(user.userId, id);
        return address;
      } catch (error: any) {
        fastify.log.error(error);
        return reply.code(404).send({ error: error.message });
      }
    }
  );

  fastify.put<{ Params: { id: string } }>(
    '/overseas/:id/set-default',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const user = getUserFromRequest(request);
        const { id } = request.params;
        const address = await service.setDefaultOverseasAddress(user.userId, id);
        return address;
      } catch (error: any) {
        fastify.log.error(error);
        return reply.code(404).send({ error: error.message });
      }
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/recipient/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const user = getUserFromRequest(request);
        const { id } = request.params;
        await service.deleteRecipientAddress(user.userId, id);
        return { message: 'Address deleted successfully' };
      } catch (error: any) {
        fastify.log.error(error);
        return reply.code(404).send({ error: error.message });
      }
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/overseas/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const user = getUserFromRequest(request);
        const { id } = request.params;
        await service.deleteOverseasAddress(user.userId, id);
        return { message: 'Address deleted successfully' };
      } catch (error: any) {
        fastify.log.error(error);
        return reply.code(404).send({ error: error.message });
      }
    }
  );
}
