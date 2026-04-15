import { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { authorize } from '../../lib/auth';

const prisma = new PrismaClient();

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

const CONTENT_TYPE_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

function sanitizeExt(filename: string, mimeType: string) {
  const ext = path.extname(filename).toLowerCase();
  if (ext && Object.keys(CONTENT_TYPE_MAP).includes(ext)) {
    return ext === '.jpeg' ? '.jpg' : ext;
  }
  return EXTENSION_MAP[mimeType] || '';
}

export async function uploadRoutes(fastify: FastifyInstance) {
  fastify.post('/upload', {
    preHandler: [fastify.authenticate, authorize(['ADMIN'])],
  }, async (request, reply) => {
    const file = await request.file();

    if (!file) {
      return reply.code(400).send({ error: '未找到上传文件' });
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return reply.code(400).send({ error: '不支持的文件类型' });
    }

    const buffer = await file.toBuffer();
    if (buffer.length > MAX_FILE_SIZE) {
      return reply.code(400).send({ error: '文件大小不能超过10MB' });
    }

    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const ext = sanitizeExt(file.filename, file.mimetype);

    if (!ext) {
      return reply.code(400).send({ error: '无法识别文件扩展名' });
    }

    const uploadDir = path.join(process.cwd(), 'uploads', 'payment-vouchers', year, month);
    await fs.mkdir(uploadDir, { recursive: true });

    const filename = `${randomUUID()}${ext}`;
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, buffer);

    const fileUrl = `/api/uploads/payment-vouchers/${year}/${month}/${filename}`;

    return reply.code(201).send({
      fileUrl,
      fileName: file.filename,
      fileType: file.mimetype,
      fileSize: buffer.length,
    });
  });

  fastify.get('/uploads/payment-vouchers/:year/:month/:filename', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: '请先登录' });
    }

    const { year, month, filename } = request.params as {
      year: string;
      month: string;
      filename: string;
    };

    if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month)) {
      return reply.code(400).send({ error: '路径参数错误' });
    }

    const safeFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'uploads', 'payment-vouchers', year, month, safeFilename);

    try {
      await fs.access(filePath);
    } catch {
      return reply.code(404).send({ error: '文件不存在' });
    }

    const requestUrl = `/api/uploads/payment-vouchers/${year}/${month}/${safeFilename}`;
    const voucher = await prisma.orderPaymentVoucher.findFirst({
      where: { fileUrl: requestUrl },
      include: { order: true },
    });

    if (!voucher) {
      return reply.code(404).send({ error: '凭证记录不存在' });
    }

    const user = request.user as { userId: string; userRole: string };
    const isAdmin = user.userRole === 'ADMIN';
    const isOwner = voucher.order.userId === user.userId;

    if (!isAdmin && !isOwner) {
      return reply.code(403).send({ error: '无权访问此凭证' });
    }

    const ext = path.extname(safeFilename).toLowerCase();
    const contentType = CONTENT_TYPE_MAP[ext] || 'application/octet-stream';

    reply.type(contentType);
    return reply.send(createReadStream(filePath));
  });

  // Plan A: Voucher access by ID (hides internal path)
  fastify.get('/vouchers/:voucherId', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: '请先登录' });
    }

    const { voucherId } = request.params as { voucherId: string };

    const voucher = await prisma.orderPaymentVoucher.findUnique({
      where: { id: voucherId },
      include: { order: true },
    });

    if (!voucher) {
      return reply.code(404).send({ error: '凭证不存在' });
    }

    const user = request.user as { userId: string; userRole: string };
    const isAdmin = user.userRole === 'ADMIN';
    const isOwner = voucher.order.userId === user.userId;

    if (!isAdmin && !isOwner) {
      return reply.code(403).send({ error: '无权访问此凭证' });
    }

    const rawPath = voucher.fileUrl;
    const pathname = rawPath.startsWith('http')
      ? new URL(rawPath).pathname
      : rawPath;
    const relativePath = pathname.replace(/^\/api\//, '');
    const filePath = path.join(process.cwd(), relativePath);

    let stat;
    try {
      stat = await fs.stat(filePath);
    } catch {
      return reply.code(404).send({ error: '文件不存在' });
    }

    if (!stat.isFile() || stat.size === 0) {
      return reply.code(404).send({ error: '文件为空或不存在' });
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPE_MAP[ext] || voucher.fileType || 'application/octet-stream';

    const etag = `W/"${voucherId}-${stat.size}-${stat.mtimeMs}"`;
    const ifNoneMatch = request.headers['if-none-match'];

    if (ifNoneMatch === etag) {
      return reply.code(304).send();
    }

    reply.header('Content-Length', stat.size);
    reply.header('Cache-Control', 'public, max-age=86400');
    reply.header('ETag', etag);
    reply.type(contentType);
    return reply.send(createReadStream(filePath));
  });
}
