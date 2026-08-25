import { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { randomUUID } from 'crypto';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
]);

const CONTENT_TYPE_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.txt': 'text/plain',
};

const EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'text/plain': '.txt',
};

function sanitizeExt(filename: string, mimeType: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext && Object.keys(CONTENT_TYPE_MAP).includes(ext)) {
    return ext === '.jpeg' ? '.jpg' : ext;
  }
  return EXTENSION_MAP[mimeType] || '.bin';
}

export async function uploadV2Routes(fastify: FastifyInstance) {
  // 1. Upload local file (images, pdfs, docs)
  fastify.post('/upload', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const file = await request.file();
      if (!file) {
        return reply.code(400).send({ success: false, error: '未检测到上传的文件' });
      }

      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        return reply.code(400).send({ success: false, error: '不支持的文件类型，仅支持图片、PDF及常见文档' });
      }

      const buffer = await file.toBuffer();
      if (buffer.length > 20 * 1024 * 1024) {
        return reply.code(400).send({ success: false, error: '文件大小不能超过 20MB' });
      }

      const now = new Date();
      const year = String(now.getFullYear());
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const ext = sanitizeExt(file.filename, file.mimetype);

      const uploadDir = path.join(process.cwd(), 'uploads', 'v2', year, month);
      await fs.mkdir(uploadDir, { recursive: true });

      const filename = `${Date.now()}_${randomUUID().slice(0, 8)}${ext}`;
      const filePath = path.join(uploadDir, filename);
      await fs.writeFile(filePath, buffer);

      const fileUrl = `/api/v2/uploads/${year}/${month}/${filename}`;

      return reply.code(201).send({
        success: true,
        data: {
          fileUrl,
          fileName: file.filename,
          fileType: file.mimetype,
          size: buffer.length,
        },
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.code(500).send({ success: false, error: err.message || '文件上传失败' });
    }
  });

  // 2. Serve static uploaded file directly
  fastify.get('/uploads/:year/:month/:filename', async (request, reply) => {
    const { year, month, filename } = request.params as {
      year: string;
      month: string;
      filename: string;
    };

    if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month)) {
      return reply.code(400).send({ error: '路径参数错误' });
    }

    const safeFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'uploads', 'v2', year, month, safeFilename);

    try {
      await fs.access(filePath);
    } catch {
      return reply.code(404).send({ error: '文件不存在或已被移除' });
    }

    const ext = path.extname(safeFilename).toLowerCase();
    const contentType = CONTENT_TYPE_MAP[ext] || 'application/octet-stream';

    reply.type(contentType);
    return reply.send(createReadStream(filePath));
  });
}
