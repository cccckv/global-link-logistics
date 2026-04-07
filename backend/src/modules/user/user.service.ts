import { PrismaClient, UserRoleEnum } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export interface ListUsersParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateUserData {
  name: string;
  phone: string;
  password: string;
  userRole: UserRoleEnum;
  email?: string;
}

export interface UpdateUserData {
  name?: string;
  phone?: string;
  password?: string;
  userRole?: UserRoleEnum;
  email?: string;
}

export class UserService {
  async listUsers(params: ListUsersParams = {}) {
    const { search, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          userRole: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createUser(data: CreateUserData) {
    const existingPhone = await prisma.user.findUnique({
      where: { phone: data.phone },
    });

    if (existingPhone) {
      throw new Error('该手机号已被使用');
    }

    const existingName = await prisma.user.findFirst({
      where: { name: data.name },
    });

    if (existingName) {
      throw new Error('该用户唛头已被使用');
    }

    if (data.email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingEmail) {
        throw new Error('该邮箱已被使用');
      }
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        passwordHash,
        userRole: data.userRole,
        userType: 'CUSTOMER',
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        userRole: true,
        createdAt: true,
      },
    });

    return user;
  }

  async updateUser(userId: string, data: UpdateUserData) {
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new Error('用户不存在');
    }

    if (existingUser.deletedAt) {
      throw new Error('无法修改已删除的用户');
    }

    if (data.phone && data.phone !== existingUser.phone) {
      const phoneExists = await prisma.user.findUnique({
        where: { phone: data.phone },
      });

      if (phoneExists) {
        throw new Error('该手机号已被使用');
      }
    }

    if (data.name && data.name !== existingUser.name) {
      const nameExists = await prisma.user.findFirst({
        where: { name: data.name },
      });

      if (nameExists) {
        throw new Error('该用户唛头已被使用');
      }
    }

    if (data.email && data.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (emailExists) {
        throw new Error('该邮箱已被使用');
      }
    }

    const updateData: any = {};

    if (data.name) updateData.name = data.name;
    if (data.phone) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.userRole) updateData.userRole = data.userRole;
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        userRole: true,
        updatedAt: true,
      },
    });

    return user;
  }

  async deleteUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    if (user.deletedAt) {
      throw new Error('该用户已被删除');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });

    return { message: '用户已删除' };
  }
}

export const userService = new UserService();
