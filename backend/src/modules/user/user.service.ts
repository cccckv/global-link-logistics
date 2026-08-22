import { PrismaClient, UserRoleEnum } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export interface ListUsersParams {
  search?: string;
  userRole?: UserRoleEnum;
  page?: number;
  limit?: number;
}

export interface CreateUserData {
  name: string;
  phone: string;
  password: string;
  userRole: UserRoleEnum;
  shippingMarks?: string[];
  email?: string;
  company?: string;
}

export interface UpdateUserData {
  name?: string;
  phone?: string;
  password?: string;
  userRole?: UserRoleEnum;
  shippingMarks?: string[];
  email?: string;
  company?: string;
}

export class UserService {
  async listUsers(params: ListUsersParams = {}) {
    const { search, userRole, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (userRole) {
      where.userRole = userRole;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { shippingMarks: { has: search.trim() } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          userRole: true,
          shippingMarks: true,
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

    const passwordHash = await bcrypt.hash(data.password, 10);

    // 只有普通用户允许关联唛头；内部人员强制为空数组
    let sanitizedShippingMarks: string[] = [];
    if (data.userRole === UserRoleEnum.USER && Array.isArray(data.shippingMarks)) {
      sanitizedShippingMarks = Array.from(
        new Set(data.shippingMarks.map((m) => m.trim()).filter(Boolean))
      );
    }

    const user = await prisma.user.create({
      data: {
        name: data.name.trim(),
        phone: data.phone.trim(),
        passwordHash,
        userRole: data.userRole,
        shippingMarks: sanitizedShippingMarks,
        userType: data.userRole === UserRoleEnum.USER ? 'CUSTOMER' : 'EMPLOYEE',
      },
      select: {
        id: true,
        name: true,
        phone: true,
        userRole: true,
        shippingMarks: true,
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

    const updateData: any = {};

    if (data.name) updateData.name = data.name.trim();
    if (data.phone) updateData.phone = data.phone.trim();
    if (data.userRole) {
      updateData.userRole = data.userRole;
      updateData.userType = data.userRole === UserRoleEnum.USER ? 'CUSTOMER' : 'EMPLOYEE';
    }

    // 处理 shippingMarks
    const targetRole = data.userRole || existingUser.userRole;
    if (targetRole === UserRoleEnum.USER) {
      if (data.shippingMarks !== undefined) {
        updateData.shippingMarks = Array.from(
          new Set(data.shippingMarks.map((m) => m.trim()).filter(Boolean))
        );
      }
    } else {
      // 内部角色清空唛头
      updateData.shippingMarks = [];
    }

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
        userRole: true,
        shippingMarks: true,
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
