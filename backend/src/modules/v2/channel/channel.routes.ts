import { FastifyInstance } from 'fastify';
import { ChannelV2Service, CreateShippingChannelInput } from './channel.service';
import { ChannelCategory } from '@prisma/client';

export async function channelV2Routes(fastify: FastifyInstance) {
  const service = new ChannelV2Service();

  // GET /api/v2/channels
  fastify.get('/', async (request) => {
    const query = request.query as {

      category?: ChannelCategory;
      isActive?: string;
      search?: string;
    };
    const isActive = query.isActive !== undefined ? query.isActive === 'true' : undefined;
    const channels = await service.getChannels({
      category: query.category,
      isActive,
      search: query.search,
    });
    return { success: true, data: channels };
  });

  // GET /api/v2/channels/:id
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const channel = await service.getChannelById(id);
    if (!channel) {
      return reply.status(404).send({ success: false, error: '渠道未找到' });
    }
    return { success: true, data: channel };
  });

  // POST /api/v2/channels
  fastify.post('/', async (request, reply) => {
    try {
      const body = request.body as CreateShippingChannelInput;
      if (!body.category || !body.name) {
        return reply.status(400).send({ success: false, error: '渠道所属分类与名称均为必填项' });
      }
      const channel = await service.createChannel(body);
      return reply.status(201).send({ success: true, data: channel });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message });
    }
  });

  // PUT /api/v2/channels/:id
  fastify.put('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Partial<CreateShippingChannelInput>;
      const channel = await service.updateChannel(id, body);
      return { success: true, data: channel };
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message });
    }
  });

  // PATCH /api/v2/channels/:id/toggle
  fastify.patch('/:id/toggle', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const channel = await service.toggleActive(id);
      return { success: true, data: channel };
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message });
    }
  });

  // DELETE /api/v2/channels/:id
  fastify.delete('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await service.deleteChannel(id);
      return { success: true, message: '渠道已删除' };
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message });
    }
  });
}

