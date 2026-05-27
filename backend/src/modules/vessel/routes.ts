import { FastifyInstance } from 'fastify';
import { vesselService } from './service';

export async function vesselRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Querystring: {
      keywords: string;
      max?: number;
    };
  }>('/search', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { keywords, max } = request.query;

    if (!keywords || !keywords.trim()) {
      return reply.code(400).send({
        success: false,
        error: 'MISSING_KEYWORDS',
        message: '请提供查询关键字（船名、呼号、MMSI或IMO）',
      });
    }

    try {
      const results = await vesselService.searchVessels(keywords.trim(), max);

      return reply.send({
        success: true,
        total: results.length,
        data: results,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to search vessels');

      if (error instanceof Error) {
        if (error.message === 'Vessel not found') {
          return reply.send({
            success: true,
            total: 0,
            data: [],
          });
        }
        if (error.message === 'Rate limit exceeded') {
          return reply.code(429).send({
            success: false,
            error: 'RATE_LIMIT',
            message: 'API请求频率超限，请稍后再试',
          });
        }
        if (error.message === 'Request timeout') {
          return reply.code(504).send({
            success: false,
            error: 'TIMEOUT',
            message: '请求超时，请稍后重试',
          });
        }
      }

      return reply.code(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
        message: '服务器内部错误',
      });
    }
  });

  fastify.get<{
    Querystring: {
      mmsi: string;
    };
  }>('/position', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { mmsi } = request.query;

    if (!mmsi || !mmsi.trim()) {
      return reply.code(400).send({
        success: false,
        error: 'MISSING_MMSI',
        message: '请提供MMSI编号',
      });
    }

    if (!/^\d{9}$/.test(mmsi.trim())) {
      return reply.code(400).send({
        success: false,
        error: 'INVALID_MMSI',
        message: 'MMSI格式错误，应为9位数字',
      });
    }

    try {
      const vesselData = await vesselService.getVesselPositionByMmsi(mmsi.trim());

      return reply.send({
        success: true,
        data: vesselData,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to fetch vessel position');

      if (error instanceof Error) {
        if (error.message === 'Vessel not found') {
          return reply.code(404).send({
            success: false,
            error: 'VESSEL_NOT_FOUND',
            message: '未找到该船舶信息',
          });
        }
        if (error.message === 'Rate limit exceeded') {
          return reply.code(429).send({
            success: false,
            error: 'RATE_LIMIT',
            message: 'API请求频率超限，请稍后再试',
          });
        }
        if (error.message === 'Request timeout') {
          return reply.code(504).send({
            success: false,
            error: 'TIMEOUT',
            message: '请求超时，请稍后重试',
          });
        }
      }

      return reply.code(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
        message: '服务器内部错误',
      });
    }
  });
}
