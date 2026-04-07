import { FastifyRequest, FastifyReply } from 'fastify';
import { JWTPayload } from './jwt';

/**
 * Role-based authorization middleware
 * 
 * @param allowedRoles - Array of allowed user roles (e.g., ['ADMIN'])
 * @returns Fastify preHandler function
 * 
 * @example
 * fastify.get('/admin-only', {
 *   preHandler: [fastify.authenticate, authorize(['ADMIN'])]
 * }, async (request, reply) => { ... })
 */
export function authorize(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as JWTPayload;

    if (!user) {
      return reply.code(401).send({ error: '未登录' });
    }

    if (!user.userRole || !allowedRoles.includes(user.userRole)) {
      return reply.code(403).send({ error: '权限不足：此功能仅限管理员使用' });
    }
  };
}
