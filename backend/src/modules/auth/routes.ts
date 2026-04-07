import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { JWTPayload } from '../../lib/jwt';
import { generateCode, sendSMS, isValidPhone } from '../../lib/sms';

const prisma = new PrismaClient();

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post<{
    Body: { phone: string };
  }>('/send-code', async (request, reply) => {
    const { phone } = request.body;

    if (!phone || !isValidPhone(phone)) {
      return reply.code(400).send({ error: '请输入有效的手机号' });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.verificationCode.create({
      data: {
        phone,
        code,
        type: 'REGISTER',
        expiresAt,
      },
    });

    await sendSMS(phone, code, 'REGISTER');

    return { message: '验证码已发送', expiresIn: 300 };
  });

  fastify.post<{
    Body: { phone: string; code: string; password: string; name?: string };
  }>('/register', async (request, reply) => {
    const { phone, code, password, name } = request.body;

    if (!phone || !code || !password) {
      return reply.code(400).send({ error: '缺少必填字段' });
    }

    if (!isValidPhone(phone)) {
      return reply.code(400).send({ error: '请输入有效的手机号' });
    }

    const verification = await prisma.verificationCode.findFirst({
      where: {
        phone,
        code,
        type: 'REGISTER',
        verified: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      return reply.code(400).send({ error: '验证码无效或已过期' });
    }

    const existingPhone = await prisma.user.findUnique({ where: { phone } });
    if (existingPhone) {
      return reply.code(400).send({ error: '该手机号已注册' });
    }

    if (name) {
      const existingName = await prisma.user.findFirst({ where: { name } });
      if (existingName) {
        return reply.code(400).send({ error: '该用户名已被使用' });
      }
    }

    await prisma.verificationCode.update({
      where: { id: verification.id },
      data: { verified: true },
    });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        phone,
        passwordHash,
        name: name || `用户${phone.slice(-4)}`,
        userType: 'CUSTOMER',
      },
      select: {
        id: true,
        phone: true,
        name: true,
        userType: true,
        userRole: true,
      },
    });

    const token = fastify.jwt.sign({
      userId: user.id,
      email: user.phone,
      phone: user.phone,
      userType: user.userType,
      userRole: user.userRole,
    } as JWTPayload);

    return { token, user };
  });

  fastify.post<{
    Body: { phone: string; password: string };
  }>('/login', async (request, reply) => {
    const { phone, password } = request.body;

    if (!phone || !password) {
      return reply.code(400).send({ error: '请输入用户名/手机号和密码' });
    }

    let user = await prisma.user.findUnique({ where: { phone } });
    
    if (!user) {
      user = await prisma.user.findFirst({ where: { name: phone } });
    }
    
    if (!user) {
      return reply.code(401).send({ error: '用户名/手机号或密码错误' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return reply.code(401).send({ error: '用户名/手机号或密码错误' });
    }

    const token = fastify.jwt.sign({
      userId: user.id,
      email: user.phone,
      phone: user.phone,
      userType: user.userType,
      userRole: user.userRole,
    } as JWTPayload);

    return {
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        userType: user.userType,
        userRole: user.userRole,
      },
    };
  });

  fastify.post<{
    Body: { phone: string };
  }>('/forgot-password/send-code', async (request, reply) => {
    const { phone } = request.body;

    if (!phone || !isValidPhone(phone)) {
      return reply.code(400).send({ error: '请输入有效的手机号' });
    }

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return reply.code(404).send({ error: '该手机号未注册' });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.verificationCode.create({
      data: {
        phone,
        code,
        type: 'RESET_PASSWORD',
        expiresAt,
      },
    });

    await sendSMS(phone, code, 'RESET_PASSWORD');

    return { message: '验证码已发送', expiresIn: 300 };
  });

  fastify.post<{
    Body: { phone: string; code: string; newPassword: string };
  }>('/forgot-password/reset', async (request, reply) => {
    const { phone, code, newPassword } = request.body;

    if (!phone || !code || !newPassword) {
      return reply.code(400).send({ error: '缺少必填字段' });
    }

    const verification = await prisma.verificationCode.findFirst({
      where: {
        phone,
        code,
        type: 'RESET_PASSWORD',
        verified: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      return reply.code(400).send({ error: '验证码无效或已过期' });
    }

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return reply.code(404).send({ error: '用户不存在' });
    }

    await prisma.verificationCode.update({
      where: { id: verification.id },
      data: { verified: true },
    });

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return { message: '密码重置成功' };
  });

  fastify.get('/me', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const payload = request.user as JWTPayload;
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        phone: true,
        name: true,
        userType: true,
        userRole: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return { user };
  });
}
