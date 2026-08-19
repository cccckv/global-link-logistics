import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CustomerImportOptions {
  skipExisting?: boolean; // 遇到已存在唛头：true 为跳过，false 为覆盖更新
}

export interface ImportErrorDetail {
  row: number;
  userMark: string;
  reason: string;
}

export interface CustomerImportResult {
  total: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  errors: ImportErrorDetail[];
}

export class CustomerImportService {
  /**
   * 解析并批量导入客户档案
   */
  async importCustomers(
    fileBuffer: Buffer,
    options: CustomerImportOptions = { skipExisting: true }
  ): Promise<CustomerImportResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('未在 Excel 文件中找到有效的工作表');
    }

    const errors: ImportErrorDetail[] = [];
    let successCount = 0;
    let skippedCount = 0;

    // 1. 扫描表头行（第1行），建立列索引映射
    const headerRow = worksheet.getRow(1);
    const colMap = this.mapHeaderColumns(headerRow);

    if (!colMap.clientCode) {
      throw new Error('Excel 表头中缺少必填列【客户唛头/编码】');
    }

    const rowsToProcess: Array<{
      rowNumber: number;
      clientCode: string;
      name: string;
      phone?: string;
      email?: string;
      defaultWarehouse?: string;
      destinationCountry?: string;
      destinationPort?: string;
      note?: string;
    }> = [];

    // 2. 遍历数据行（从第2行开始）
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const rawCode = this.getCellValue(row.getCell(colMap.clientCode));
      const clientCode = rawCode ? String(rawCode).trim() : '';

      if (!clientCode) {
        // 如果整行都为空，则忽略不作为错误
        const hasAnyValue = row.values && (row.values as any[]).some((v) => v !== null && v !== undefined && String(v).trim() !== '');
        if (hasAnyValue) {
          errors.push({
            row: rowNumber,
            userMark: '',
            reason: '客户唛头/编码不能为空',
          });
        }
        return;
      }

      const rawName = colMap.name ? this.getCellValue(row.getCell(colMap.name)) : '';
      const name = rawName && String(rawName).trim() ? String(rawName).trim() : clientCode;

      const phone = colMap.phone ? this.getCellValue(row.getCell(colMap.phone)) : undefined;
      const email = colMap.email ? this.getCellValue(row.getCell(colMap.email)) : undefined;
      const defaultWarehouse = colMap.defaultWarehouse ? this.getCellValue(row.getCell(colMap.defaultWarehouse)) : undefined;
      const destinationCountry = colMap.destinationCountry ? this.getCellValue(row.getCell(colMap.destinationCountry)) : undefined;
      const destinationPort = colMap.destinationPort ? this.getCellValue(row.getCell(colMap.destinationPort)) : undefined;
      const note = colMap.note ? this.getCellValue(row.getCell(colMap.note)) : undefined;

      rowsToProcess.push({
        rowNumber,
        clientCode,
        name,
        phone: phone ? String(phone).trim() : undefined,
        email: email ? String(email).trim() : undefined,
        defaultWarehouse: defaultWarehouse ? String(defaultWarehouse).trim() : undefined,
        destinationCountry: destinationCountry ? String(destinationCountry).trim() : undefined,
        destinationPort: destinationPort ? String(destinationPort).trim() : undefined,
        note: note ? String(note).trim() : undefined,
      });
    });

    // 3. 逐条入库执行
    for (const item of rowsToProcess) {
      try {
        const existing = await prisma.customer.findUnique({
          where: { clientCode: item.clientCode },
        });

        if (existing) {
          if (options.skipExisting !== false) {
            // 跳过已存在
            skippedCount++;
            continue;
          } else {
            // 覆盖更新
            await prisma.customer.update({
              where: { id: existing.id },
              data: {
                name: item.name || existing.name,
                phone: item.phone !== undefined ? item.phone : existing.phone,
                email: item.email !== undefined ? item.email : existing.email,
                defaultWarehouse: item.defaultWarehouse !== undefined ? item.defaultWarehouse : existing.defaultWarehouse,
                destinationCountry: item.destinationCountry !== undefined ? item.destinationCountry : existing.destinationCountry,
                destinationPort: item.destinationPort !== undefined ? item.destinationPort : existing.destinationPort,
                note: item.note !== undefined ? item.note : existing.note,
              },
            });
            successCount++;
          }
        } else {
          // 新增客户
          await prisma.customer.create({
            data: {
              clientCode: item.clientCode,
              name: item.name,
              phone: item.phone,
              email: item.email,
              defaultWarehouse: item.defaultWarehouse,
              destinationCountry: item.destinationCountry,
              destinationPort: item.destinationPort,
              note: item.note,
            },
          });
          successCount++;
        }
      } catch (err: any) {
        errors.push({
          row: item.rowNumber,
          userMark: item.clientCode,
          reason: err.message || '数据库写入失败',
        });
      }
    }

    const total = rowsToProcess.length + errors.filter((e) => !rowsToProcess.some((r) => r.rowNumber === e.row)).length;

    return {
      total,
      successCount,
      skippedCount,
      failedCount: errors.length,
      errors,
    };
  }

  /**
   * 智能识别表头各列
   */
  private mapHeaderColumns(headerRow: ExcelJS.Row): Record<string, number> {
    const map: Record<string, number> = {};

    headerRow.eachCell((cell, colNumber) => {
      const text = String(cell.value || '').trim();

      if (text.includes('唛头') || text.includes('编码') || text.includes('客户代码')) {
        map.clientCode = colNumber;
      } else if (text.includes('姓名') || text.includes('名称') || text.includes('企业名')) {
        map.name = colNumber;
      } else if (text.includes('电话') || text.includes('手机')) {
        map.phone = colNumber;
      } else if (text.includes('邮箱') || text.includes('mail')) {
        map.email = colNumber;
      } else if (text.includes('起运仓') || text.includes('仓库')) {
        map.defaultWarehouse = colNumber;
      } else if (text.includes('目的国') || text.includes('国家')) {
        map.destinationCountry = colNumber;
      } else if (text.includes('目的港') || text.includes('港口')) {
        map.destinationPort = colNumber;
      } else if (text.includes('备注')) {
        map.note = colNumber;
      }
    });

    return map;
  }

  private getCellValue(cell: ExcelJS.Cell): any {
    if (!cell || cell.value === null || cell.value === undefined) return '';
    if (typeof cell.value === 'object') {
      if ('text' in cell.value) return (cell.value as any).text;
      if ('result' in cell.value) return (cell.value as any).result;
    }
    return cell.value;
  }
}
