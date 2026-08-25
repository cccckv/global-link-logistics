import { FastifyInstance } from 'fastify';
import { ShipmentType } from '@prisma/client';
import { TemplateGeneratorService, TemplateType } from './template-generator.service';
import { CustomerImportService } from './customer-import.service';
import { WaybillImportService } from './waybill-import.service';
import { authorize } from '../../../lib/auth';

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
      const result = await customerImportService.importCustomers(buffer, {
        skipExisting: skipExisting !== 'false',
      });

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
      const operatorId = (request as any).user?.id;

      const result = await waybillImportService.importWaybills(buffer, type, operatorId);

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
}
