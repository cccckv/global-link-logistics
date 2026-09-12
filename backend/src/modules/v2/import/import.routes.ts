import { FastifyInstance } from 'fastify';
import { ShipmentType, PrismaClient } from '@prisma/client';
import { TemplateGeneratorService, TemplateType } from './template-generator.service';
import { CustomerImportService } from './customer-import.service';
import { WaybillImportService } from './waybill-import.service';
import { authorize } from '../../../lib/auth';
import { JWTPayload } from '../../../lib/jwt';

const prisma = new PrismaClient();
const INTERNAL_ROLES = ['ADMIN', 'SALES', 'FINANCE'];

export async function importV2Routes(fastify: FastifyInstance) {
  const templateService = new TemplateGeneratorService();
  const customerImportService = new CustomerImportService();
  const waybillImportService = new WaybillImportService();

  const internalHandler = { preHandler: [fastify.authenticate, authorize(INTERNAL_ROLES)] };

  // 1. 下载导入模板
  fastify.get('/template', async (request, reply) => {
    const { type = 'SEA_LCL' } = request.query as { type?: TemplateType };

    try {
      const buffer = await templateService.generateTemplate(type);
      const filename = templateService.getTemplateFileName(type);
      const encodedFilename = encodeURIComponent(filename);

      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`)
        .send(buffer);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.code(400).send({ success: false, error: err.message || '生成模板失败' });
    }
  });

  // 2. 批量导入客户档案 (Internal only)
  fastify.post('/customer', internalHandler, async (request, reply) => {
    const { skipExisting = 'true' } = request.query as { skipExisting?: string };

    try {
      const file = await request.file();
      if (!file) {
        return reply.code(400).send({ success: false, error: '请上传 Excel 模板文件' });
      }

      const buffer = await file.toBuffer();
      const user = (request as any).user as JWTPayload;
      const operatorId = user?.userId;
      const operatorName = user?.name || user?.phone || '管理员';
      const fileName = file.filename;

      const result = await customerImportService.importCustomers(
        buffer,
        {
          skipExisting: skipExisting !== 'false',
        },
        operatorId,
        fileName,
        operatorName
      );

      return reply.code(200).send({
        success: true,
        message: `批量导入处理完成：成功 ${result.successCount} 户，跳过 ${result.skippedCount} 户，异常 ${result.failedCount} 户`,
        data: result,
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.code(500).send({ success: false, error: err.message || '导入客户档案失败' });
    }
  });

  // 3. 批量导入订单 (Internal only)
  fastify.post('/waybill', internalHandler, async (request, reply) => {
    const { type = 'SEA_LCL' } = request.query as { type?: ShipmentType };

    try {
      const file = await request.file();
      if (!file) {
        return reply.code(400).send({ success: false, error: '请上传 Excel 模板文件' });
      }

      const buffer = await file.toBuffer();
      const user = (request as any).user as JWTPayload;
      const operatorId = user?.userId;
      const operatorName = user?.name || user?.phone || '管理员';
      const fileName = file.filename;

      const result = await waybillImportService.importWaybills(buffer, type, operatorId, fileName, operatorName);

      return reply.code(200).send({
        success: true,
        message: `批量导入处理完成：成功入库 ${result.successCount} 票，异常跳过 ${result.failedCount} 票`,
        data: result,
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.code(500).send({ success: false, error: err.message || '批量导入运单失败' });
    }
  });

  // 4. 查询批量导入日志列表 (Internal only)
  fastify.get('/logs', internalHandler, async (request, reply) => {
    const query = request.query as { type?: string; page?: string; limit?: string };
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.type && query.type !== 'ALL') {
      where.importType = query.type;
    }

    try {
      const [total, logs] = await Promise.all([
        prisma.importLog.count({ where }),
        prisma.importLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
      ]);

      const formattedLogs = logs.map((log) => ({
        id: log.id,
        importType: log.importType,
        fileName: log.fileName,
        totalCount: log.totalCount,
        successCount: log.successCount,
        failedCount: log.failedCount,
        errors: log.detailsJson ? JSON.parse(log.detailsJson) : [],
        successWaybills: log.successWaybills ? JSON.parse(log.successWaybills) : [],
        operatorId: log.operatorId,
        operatorName: log.operatorName,
        createdAt: log.createdAt,
      }));

      return reply.code(200).send({
        success: true,
        data: {
          total,
          page,
          limit,
          logs: formattedLogs,
        },
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.code(500).send({ success: false, error: err.message || '获取导入日志失败' });
    }
  });

  // 5. 获取单条导入日志详情 (Internal only)
  fastify.get('/logs/:id', internalHandler, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const log = await prisma.importLog.findUnique({
        where: { id },
      });

      if (!log) {
        return reply.code(404).send({ success: false, error: '未找到该导入日志记录' });
      }

      return reply.code(200).send({
        success: true,
        data: {
          id: log.id,
          importType: log.importType,
          fileName: log.fileName,
          totalCount: log.totalCount,
          successCount: log.successCount,
          failedCount: log.failedCount,
          errors: log.detailsJson ? JSON.parse(log.detailsJson) : [],
          successWaybills: log.successWaybills ? JSON.parse(log.successWaybills) : [],
          operatorId: log.operatorId,
          operatorName: log.operatorName,
          createdAt: log.createdAt,
        },
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.code(500).send({ success: false, error: err.message || '获取导入日志详情失败' });
    }
  });
}
