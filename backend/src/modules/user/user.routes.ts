import { FastifyInstance } from 'fastify';
import { userService } from './user.service';
import { authorize } from '../../lib/auth';
import { UserRoleEnum } from '@prisma/client';

export async function userRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    {
      preHandler: [fastify.authenticate, authorize(['ADMIN'])],
    },
    async (request, reply) => {
      try {
        const { search, page, limit } = request.query as {
          search?: string;
          page?: string;
          limit?: string;
        };

        const result = await userService.listUsers({
          search,
          page: page ? parseInt(page) : undefined,
          limit: limit ? parseInt(limit) : undefined,
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
        const { name, phone, password, userRole, email } = request.body as {
          name: string;
          phone: string;
          password: string;
          userRole: UserRoleEnum;
          email?: string;
        };

        if (!name || !phone || !password || !userRole) {
          return reply.code(400).send({
            success: false,
            error: '缺少必填字段：name, phone, password, userRole',
          });
        }

        if (!['ADMIN', 'USER'].includes(userRole)) {
          return reply.code(400).send({
            success: false,
            error: 'userRole 必须是 ADMIN 或 USER',
          });
        }

        const user = await userService.createUser({
          name,
          phone,
          password,
          userRole,
          email,
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
        const { name, phone, password, userRole, email } = request.body as {
          name?: string;
          phone?: string;
          password?: string;
          userRole?: UserRoleEnum;
          email?: string;
        };

        if (userRole && !['ADMIN', 'USER'].includes(userRole)) {
          return reply.code(400).send({
            success: false,
            error: 'userRole 必须是 ADMIN 或 USER',
          });
        }

        const user = await userService.updateUser(id, {
          name,
          phone,
          password,
          userRole,
          email,
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
