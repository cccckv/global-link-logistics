import { FastifyInstance } from 'fastify';
import { ChannelV2Service } from './channel.service';

export async function channelV2Routes(fastify: FastifyInstance) {
  const service = new ChannelV2Service();

  // GET /api/v2/channel-mappings
  fastify.get('/channel-mappings', async (request, reply) => {
    const query = request.query as { customsType?: string };
    const mappings = await service.getMappings(query.customsType);
    return { success: true, data: mappings };
  });

  // POST /api/v2/channel-mappings
  fastify.post('/channel-mappings', async (request, reply) => {
    const body = request.body as { customsType: string; forwarderChannel: string; note?: string };
    if (!body.customsType || !body.forwarderChannel) {
      return reply.status(400).send({ success: false, error: '报关通道与承运服务商均不能为空' });
    }
    const mapping = await service.addMapping(body);
    return reply.status(201).send({ success: true, data: mapping });
  });

  // DELETE /api/v2/channel-mappings/:id
  fastify.delete('/channel-mappings/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await service.deleteMapping(id);
    return { success: true, message: '关联映射已删除' };
  });
}
