import { FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface JWTPayload {
  userId: string;
  email?: string;
  phone: string;
  name?: string;
  userType: string;
  userRole: string;
  shippingMarks?: string[];
}

export async function authenticate(request: FastifyRequest) {
  try {
    await request.jwtVerify();
  } catch {
    const err = Object.assign(new Error('Authentication required'), { statusCode: 401 });
    throw err;
  }

  const payload = request.user as JWTPayload;
  const exists = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true },
  });
  if (!exists) {
    const err = Object.assign(new Error('Session expired, please login again'), { statusCode: 401 });
    throw err;
  }
}

export function getUserFromRequest(request: FastifyRequest): JWTPayload {
  return request.user as JWTPayload;
}
