import { FastifyRequest } from 'fastify';

export interface JWTPayload {
  userId: string;
  email: string;
  phone: string;
  userType: string;
  userRole: string;
}

export async function authenticate(request: FastifyRequest) {
  try {
    await request.jwtVerify();
  } catch (err) {
    throw new Error('Authentication required');
  }
}

export function getUserFromRequest(request: FastifyRequest): JWTPayload {
  return request.user as JWTPayload;
}
