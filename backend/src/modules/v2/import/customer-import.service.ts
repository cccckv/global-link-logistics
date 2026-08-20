import ExcelJS from 'exceljs';
import { PrismaClient, AddressType } from '@prisma/client';

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

interface ParsedConsigneeAddress {
  name: string;
  phone: string;
  company?: string;
  country?: string;
  region?: string;
  address: string;
  isDefault: boolean;
}

interface GroupedCustomerData {
  clientCode: string;
  firstRowNumber: number;
  name: string;
  phone?: string;
  email?: string;
  defaultWarehouse?: string;
  destinationCountry?: string;
  destinationPort?: string;
  note?: string;
  addresses: ParsedConsigneeAddress[];
}

export class CustomerImportService {
  /**
   * 解析并批量导入客户档案 (支持单客户多海外收件人 1:N)
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

    // 2. 遍历数据行，按 clientCode 进行分组聚合
    const groupedMap = new Map<string, GroupedCustomerData>();
    let lastClientCode = '';

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const rawCode = this.getCellValue(row.getCell(colMap.clientCode));
      let clientCode = rawCode ? String(rawCode).trim() : '';

      // 允许后续行留空继承上一行的 clientCode（多行多地址场景）
      if (!clientCode && lastClientCode) {
        const hasConsigneeData =
          (colMap.consigneeName && !!this.getCellValue(row.getCell(colMap.consigneeName))) ||
          (colMap.consigneeAddress && !!this.getCellValue(row.getCell(colMap.consigneeAddress)));
        if (hasConsigneeData) {
          clientCode = lastClientCode;
        }
      }

      if (!clientCode) {
        const hasAnyValue =
          row.values &&
          (row.values as any[]).some((v) => v !== null && v !== undefined && String(v).trim() !== '');
        if (hasAnyValue) {
          errors.push({
            row: rowNumber,
            userMark: '',
            reason: '客户唛头/编码不能为空',
          });
        }
        return;
      }

      lastClientCode = clientCode;

      const rawName = colMap.name ? this.getCellValue(row.getCell(colMap.name)) : '';
      const name = rawName && String(rawName).trim() ? String(rawName).trim() : '';

      const phone = colMap.phone ? String(this.getCellValue(row.getCell(colMap.phone)) || '').trim() : undefined;
      const email = colMap.email ? String(this.getCellValue(row.getCell(colMap.email)) || '').trim() : undefined;
      const defaultWarehouse = colMap.defaultWarehouse
        ? String(this.getCellValue(row.getCell(colMap.defaultWarehouse)) || '').trim()
        : undefined;
      const destinationCountry = colMap.destinationCountry
        ? String(this.getCellValue(row.getCell(colMap.destinationCountry)) || '').trim()
        : undefined;
      const destinationPort = colMap.destinationPort
        ? String(this.getCellValue(row.getCell(colMap.destinationPort)) || '').trim()
        : undefined;
      const note = colMap.note ? String(this.getCellValue(row.getCell(colMap.note)) || '').trim() : undefined;

      // 海外收件人各列
      const consigneeName = colMap.consigneeName
        ? String(this.getCellValue(row.getCell(colMap.consigneeName)) || '').trim()
        : '';
      const consigneePhone = colMap.consigneePhone
        ? String(this.getCellValue(row.getCell(colMap.consigneePhone)) || '').trim()
        : '';
      const consigneeCompany = colMap.consigneeCompany
        ? String(this.getCellValue(row.getCell(colMap.consigneeCompany)) || '').trim()
        : undefined;
      const consigneeAddress = colMap.consigneeAddress
        ? String(this.getCellValue(row.getCell(colMap.consigneeAddress)) || '').trim()
        : '';
      const rawIsDefault = colMap.isDefault
        ? String(this.getCellValue(row.getCell(colMap.isDefault)) || '').trim()
        : '';
      const isDefault = rawIsDefault === '是' || rawIsDefault === 'true' || rawIsDefault === '1' || rawIsDefault === 'Y';

      let targetGroup = groupedMap.get(clientCode);
      if (!targetGroup) {
        targetGroup = {
          clientCode,
          firstRowNumber: rowNumber,
          name: name || clientCode,
          phone: phone || undefined,
          email: email || undefined,
          defaultWarehouse: defaultWarehouse || undefined,
          destinationCountry: destinationCountry || undefined,
          destinationPort: destinationPort || undefined,
          note: note || undefined,
          addresses: [],
        };
        groupedMap.set(clientCode, targetGroup);
      } else {
        // 首行优先保护主信息
        if (!targetGroup.name && name) targetGroup.name = name;
        if (!targetGroup.phone && phone) targetGroup.phone = phone;
        if (!targetGroup.email && email) targetGroup.email = email;
        if (!targetGroup.defaultWarehouse && defaultWarehouse) targetGroup.defaultWarehouse = defaultWarehouse;
        if (!targetGroup.destinationCountry && destinationCountry) targetGroup.destinationCountry = destinationCountry;
        if (!targetGroup.destinationPort && destinationPort) targetGroup.destinationPort = destinationPort;
        if (!targetGroup.note && note) targetGroup.note = note;
      }

      // 如果当前行包含收件人信息，则加入 addresses
      if (consigneeName || consigneePhone || consigneeAddress) {
        targetGroup.addresses.push({
          name: consigneeName || targetGroup.name || clientCode,
          phone: consigneePhone || targetGroup.phone || '000000',
          company: consigneeCompany,
          country: destinationCountry || targetGroup.destinationCountry || '菲律宾',
          region: destinationPort || targetGroup.destinationPort || '马尼拉南港',
          address: consigneeAddress || '自提',
          isDefault,
        });
      }
    });

    // 3. 逐个客户执行入库
    for (const group of groupedMap.values()) {
      try {
        // 修正默认收件人：若无任何一行显式设为默认，则第 1 个地址自动作为默认
        if (group.addresses.length > 0) {
          const hasExplicitDefault = group.addresses.some((a) => a.isDefault);
          if (!hasExplicitDefault) {
            group.addresses[0].isDefault = true;
          }

          // 默认收件人单向驱动客户常用路线
          const defaultAddr = group.addresses.find((a) => a.isDefault) || group.addresses[0];
          if (defaultAddr) {
            if (!group.destinationCountry && defaultAddr.country) {
              group.destinationCountry = defaultAddr.country;
            }
            if (!group.destinationPort && defaultAddr.region) {
              group.destinationPort = defaultAddr.region;
            }
          }
        }

        const existing = await prisma.customer.findUnique({
          where: { clientCode: group.clientCode },
          include: { addresses: true },
        });

        let customerId: string;

        if (existing) {
          if (options.skipExisting !== false) {
            // 跳过已存在客户
            skippedCount++;
            continue;
          } else {
            // 覆盖更新客户主表
            const updated = await prisma.customer.update({
              where: { id: existing.id },
              data: {
                name: group.name || existing.name,
                phone: group.phone !== undefined ? group.phone : existing.phone,
                email: group.email !== undefined ? group.email : existing.email,
                defaultWarehouse:
                  group.defaultWarehouse !== undefined ? group.defaultWarehouse : existing.defaultWarehouse,
                destinationCountry:
                  group.destinationCountry !== undefined ? group.destinationCountry : existing.destinationCountry,
                destinationPort:
                  group.destinationPort !== undefined ? group.destinationPort : existing.destinationPort,
                note: group.note !== undefined ? group.note : existing.note,
              },
            });
            customerId = updated.id;
            successCount++;
          }
        } else {
          // 创建新客户
          const created = await prisma.customer.create({
            data: {
              clientCode: group.clientCode,
              name: group.name,
              phone: group.phone,
              email: group.email,
              defaultWarehouse: group.defaultWarehouse,
              destinationCountry: group.destinationCountry,
              destinationPort: group.destinationPort,
              note: group.note,
            },
          });
          customerId = created.id;
          successCount++;
        }

        // 4. 处理海外收件人地址簿 (带电话归一化防重)
        if (group.addresses.length > 0) {
          const currentAddresses = await prisma.customerAddress.findMany({
            where: { customerId },
          });

          const willSetDefault = group.addresses.some((a) => a.isDefault);
          if (willSetDefault) {
            await prisma.customerAddress.updateMany({
              where: { customerId },
              data: { isDefault: false },
            });
          }

          for (const addr of group.addresses) {
            const normNewPhone = this.normalizePhone(addr.phone);

            // 在已有地址中查找是否已存在同电话同地址
            const duplicate = currentAddresses.find(
              (ca) =>
                this.normalizePhone(ca.phone) === normNewPhone &&
                ca.address.trim().toLowerCase() === addr.address.trim().toLowerCase()
            );

            if (duplicate) {
              if (addr.isDefault && !duplicate.isDefault) {
                await prisma.customerAddress.update({
                  where: { id: duplicate.id },
                  data: { isDefault: true },
                });
              }
              continue;
            }

            // 检查是否为同电话但地址微调
            const samePhoneAddr = currentAddresses.find(
              (ca) => this.normalizePhone(ca.phone) === normNewPhone
            );

            if (samePhoneAddr) {
              await prisma.customerAddress.update({
                where: { id: samePhoneAddr.id },
                data: {
                  name: addr.name || samePhoneAddr.name,
                  company: addr.company || samePhoneAddr.company,
                  address: addr.address,
                  country: addr.country || samePhoneAddr.country,
                  region: addr.region || samePhoneAddr.region,
                  isDefault: addr.isDefault,
                },
              });
            } else {
              // 全新地址，新建入库
              await prisma.customerAddress.create({
                data: {
                  customerId,
                  addressType: AddressType.OVERSEAS_RECIPIENT,
                  name: addr.name,
                  phone: addr.phone,
                  company: addr.company,
                  country: addr.country,
                  region: addr.region,
                  address: addr.address,
                  isDefault: addr.isDefault,
                },
              });
            }
          }
        }
      } catch (err: any) {
        errors.push({
          row: group.firstRowNumber,
          userMark: group.clientCode,
          reason: err.message || '数据库写入失败',
        });
      }
    }

    const total =
      groupedMap.size +
      errors.filter((e) => !Array.from(groupedMap.values()).some((g) => g.firstRowNumber === e.row)).length;

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
      } else if (text.includes('是否默认') || text.includes('默认收件') || text.includes('默认')) {
        map.isDefault = colNumber;
      } else if (text.includes('海外') || text.includes('收件') || text.includes('收货')) {
        if (text.includes('电话') || text.includes('WhatsApp') || text.includes('手机')) {
          map.consigneePhone = colNumber;
        } else if (text.includes('公司')) {
          map.consigneeCompany = colNumber;
        } else if (text.includes('地址') || text.includes('派送') || text.includes('门牌')) {
          map.consigneeAddress = colNumber;
        } else if (text.includes('人') || text.includes('姓名') || text.includes('联系')) {
          map.consigneeName = colNumber;
        }
      } else if (text.includes('客户姓名') || text.includes('企业名') || text.includes('客户名称') || text.includes('姓名')) {
        map.name = colNumber;
      } else if (text.includes('客户联系电话') || text.includes('客户电话') || text.includes('联系电话') || text.includes('电话') || text.includes('手机')) {
        map.phone = colNumber;
      } else if (text.includes('邮箱') || text.includes('mail')) {
        map.email = colNumber;
      } else if (text.includes('起运仓') || text.includes('仓库')) {
        map.defaultWarehouse = colNumber;
      } else if (text.includes('目的国') || text.includes('国家')) {
        map.destinationCountry = colNumber;
      } else if (text.includes('目的港') || text.includes('港口') || text.includes('地区')) {
        map.destinationPort = colNumber;
      } else if (text.includes('备注')) {
        map.note = colNumber;
      }
    });

    return map;
  }

  /**
   * 电话号码归一化（保留纯数字用于比对）
   */
  private normalizePhone(phone?: string): string {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
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
