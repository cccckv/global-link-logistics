import { FastifyInstance } from 'fastify';
import { ContactService } from './contact.service';
import { getUserFromRequest } from '../../lib/jwt';

const service = new ContactService();

export async function contactRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/pickup',
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const user = getUserFromRequest(request);
      const addresses = await service.getPickupAddresses(user.userId);
      return { data: addresses };
    }
  );

  fastify.get(
    '/recipient',
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const user = getUserFromRequest(request);
      const addresses = await service.getRecipientAddresses(user.userId);
      return { data: addresses };
    }
  );

  fastify.put<{ Params: { id: string } }>(
    '/pickup/:id/set-default',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const user = getUserFromRequest(request);
        const { id } = request.params;
        const address = await service.setDefaultPickupAddress(user.userId, id);
        return address;
      } catch (error: any) {
        fastify.log.error(error);
        return reply.code(404).send({ error: error.message });
      }
    }
  );

  fastify.put<{ Params: { id: string } }>(
    '/recipient/:id/set-default',
    {
      preHandler: [fastify.authenticate],
    },
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

  fastify.delete<{ Params: { id: string } }>(
    '/pickup/:id',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const user = getUserFromRequest(request);
        const { id } = request.params;
        await service.deletePickupAddress(user.userId, id);
        return { message: 'Address deleted successfully' };
      } catch (error: any) {
        fastify.log.error(error);
        return reply.code(404).send({ error: error.message });
      }
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/recipient/:id',
    {
      preHandler: [fastify.authenticate],
    },
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
}
