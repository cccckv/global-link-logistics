import { FastifyInstance } from 'fastify';
import { userService } from './user.service';
import { authorize } from '../../lib/auth';
import { UserRoleEnum } from '@prisma/client';

const ALLOWED_ROLES = ['ADMIN', 'SALES', 'FINANCE', 'USER'];

export async function userRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    {
      preHandler: [fastify.authenticate, authorize(['ADMIN'])],
    },
    async (request, reply) => {
      try {
        const query = (request.query || {}) as {
          search?: string;
          userRole?: UserRoleEnum;
          page?: string | number;
          limit?: string | number;
        };

        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));

        const result = await userService.listUsers({
          search: query.search,
          userRole: query.userRole,
          page,
          limit,
        });

        return reply.send({
          success: true,
          data: result.users,
          pagination: result.pagination,
        });
      } catch (error: any) {
        return reply.code(500).send({
          success: false,
          error: error.message || '获取用户列表失败',
        });
      }
    }
  );

  fastify.post(
    '/',
    {
      preHandler: [fastify.authenticate, authorize(['ADMIN'])],
    },
    async (request, reply) => {
      try {
        const { name, phone, password, userRole, shippingMarks } = request.body as {
          name: string;
          phone: string;
          password: string;
          userRole: UserRoleEnum;
          shippingMarks?: string[];
        };

        if (!name || !phone || !password || !userRole) {
          return reply.code(400).send({
            success: false,
            error: '缺少必填字段：姓名(name), 手机号(phone), 密码(password), 角色(userRole)',
          });
        }

        if (!ALLOWED_ROLES.includes(userRole)) {
          return reply.code(400).send({
            success: false,
            error: `userRole 必须是 ${ALLOWED_ROLES.join(' / ')} 之一`,
          });
        }

        const user = await userService.createUser({
          name,
          phone,
          password,
          userRole,
          shippingMarks,
        });

        return reply.code(201).send({
          success: true,
          data: user,
          message: '用户创建成功',
        });
      } catch (error: any) {
        return reply.code(400).send({
          success: false,
          error: error.message || '创建用户失败',
        });
      }
    }
  );

  fastify.put(
    '/:id',
    {
      preHandler: [fastify.authenticate, authorize(['ADMIN'])],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { name, phone, password, userRole, shippingMarks } = request.body as {
          name?: string;
          phone?: string;
          password?: string;
          userRole?: UserRoleEnum;
          shippingMarks?: string[];
        };

        if (userRole && !ALLOWED_ROLES.includes(userRole)) {
          return reply.code(400).send({
            success: false,
            error: `userRole 必须是 ${ALLOWED_ROLES.join(' / ')} 之一`,
          });
        }

        const user = await userService.updateUser(id, {
          name,
          phone,
          password,
          userRole,
          shippingMarks,
        });

        return reply.send({
          success: true,
          data: user,
          message: '用户信息已更新',
        });
      } catch (error: any) {
        return reply.code(400).send({
          success: false,
          error: error.message || '更新用户失败',
        });
      }
    }
  );

  fastify.delete(
    '/:id',
    {
      preHandler: [fastify.authenticate, authorize(['ADMIN'])],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        const result = await userService.deleteUser(id);

        return reply.send({
          success: true,
          message: result.message,
        });
      } catch (error: any) {
        return reply.code(400).send({
          success: false,
          error: error.message || '删除用户失败',
        });
      }
    }
  );
}
