import ExcelJS from 'exceljs';
import { PrismaClient, ShipmentType, WaybillStatus, CurrencyType, FeeDirection, AttachmentType, AddressType } from '@prisma/client';
import { calculateWaybillFinancials } from '../waybill/waybill.service';
import { ImageExtractorService } from './image-extractor.service';
import { ImportErrorDetail } from './customer-import.service';
import { DictionaryValidator } from './dictionary-validator.service';
import {
  OFFICIAL_SEA_LCL_COLUMNS,
  OFFICIAL_AIR_COLUMNS,
  OFFICIAL_SEA_FCL_COLUMNS,
} from './template-generator.service';

const prisma = new PrismaClient();

function generateWaybillNo(type: ShipmentType = 'SEA_LCL'): string {
  const prefix = type === 'AIR' ? 'AWB' : type === 'SEA_FCL' ? 'FCL' : 'LCL';
  const now = new Date();
  const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
  const randomStr = Math.floor(1000 + Math.random() * 9000).toString();
  return `${prefix}${dateStr}${randomStr}`;
}

export interface WaybillImportResult {
  total: number;
  successCount: number;
  failedCount: number;
  successWaybillNos: string[];
  errors: ImportErrorDetail[];
}

interface ParsedItemRow {
  rowNumber: number;
  groupKey: string;
  userMark: string;
  originWarehouse?: string;
  destinationCountry?: string;
  destinationPort?: string;
  expressNo?: string;
  airWaybillNo?: string;
  forwarderChannel?: string;
  customsType?: string;
  overseasName?: string;
  overseasPhone?: string;
  overseasCompany?: string;
  overseasAddress?: string;
  overseasRegion?: string;
  note?: string;

  // Item details
  productName: string;
  quantity: number;
  length?: number;
  width?: number;
  height?: number;
  unitWeight?: number;
  totalWeight?: number;
  payableVolume?: number;
  receivableUnitPrice?: number;
  payableUnitPrice?: number;
  trackingNumber?: string;

  // Fees (Air / FCL)
  internalTruckingFee?: number;
  channelTruckingFee?: number;
  receivableAmount?: number;

  // FCL specific
  containerNo?: string;
  containerType?: string;
  blNumber?: string;
  carrier?: string;
  vesselVoyage?: string;
  originPort?: string;
  bookingChannel?: string;
  customsChannel?: string;
  clearanceChannel?: string;
  truckingFee?: number;
  portFee?: number;
  thcFee?: number;
  clearanceFee?: number;
  loadingDate?: Date;
  sailingDate?: Date;
  eta?: Date;

  // Attached images
  images: Array<{
    fileUrl: string;
    fileName: string;
    fileSize: number;
    attachmentType: AttachmentType;
  }>;
}

interface GroupedWaybill {
  groupKey: string;
  mainRowNumber: number;
  userMark: string;
  originWarehouse?: string;
  destinationCountry?: string;
  destinationPort?: string;
  expressNo?: string;
  airWaybillNo?: string;
  forwarderChannel?: string;
  customsType?: string;
  overseasName?: string;
  overseasPhone?: string;
  overseasCompany?: string;
  overseasAddress?: string;
  overseasRegion?: string;
  note?: string;
  receivableAmount?: number;

  // FCL specific
  containerNo?: string;
  containerType?: string;
  blNumber?: string;
  carrier?: string;
  vesselVoyage?: string;
  originPort?: string;
  bookingChannel?: string;
  customsChannel?: string;
  clearanceChannel?: string;
  truckingFee?: number;
  portFee?: number;
  thcFee?: number;
  clearanceFee?: number;
  loadingDate?: Date;
  sailingDate?: Date;
  eta?: Date;

  items: Array<{
    rowNumber: number;
    productName: string;
    quantity: number;
    length?: number;
    width?: number;
    height?: number;
    unitWeight?: number;
    totalWeight?: number;
    payableVolume?: number;
    receivableUnitPrice?: number;
    payableUnitPrice?: number;
    trackingNumber?: string;
  }>;

  fees: Array<{
    feeName: string;
    feeDirection: FeeDirection;
    amount: number;
  }>;

  attachments: Array<{
    fileUrl: string;
    fileName: string;
    fileSize: number;
    attachmentType: AttachmentType;
  }>;
}

export class WaybillImportService {
  private imageExtractor = new ImageExtractorService();

  /**
   * 批量导入运单入口
   */
  async importWaybills(
    fileBuffer: Buffer,
    orderType: ShipmentType = 'SEA_LCL',
    operatorId?: string
  ): Promise<WaybillImportResult> {
    // 1. 提取所有内嵌图片
    const imageMap = await this.imageExtractor.extractImagesFromWorkbook(fileBuffer);

    // 2. 加载 Excel 工作簿
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('未在 Excel 文件中找到有效的工作表');
    }

    // 3. 映射表头列
    const headerRow = worksheet.getRow(1);
    const colMap = this.mapHeaderColumns(headerRow, orderType);

    const rawRows: ParsedItemRow[] = [];
    const errors: ImportErrorDetail[] = [];

    // 4. 解析数据行
    let lastGroupKey = '';
    let autoSeq = 1;

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const rowValues = row.values as any[];
      const hasAnyValue = rowValues && rowValues.some((v) => v !== null && v !== undefined && String(v).trim() !== '');
      if (!hasAnyValue) return;

      try {
        const parsed = this.parseRowData(row, rowNumber, colMap, orderType, imageMap);
        if (!parsed.groupKey) {
          // 若分组号留空：如果有客户唛头，开启新单；否则继承上一行分组
          if (parsed.userMark) {
            parsed.groupKey = `AUTO_${autoSeq++}`;
          } else if (lastGroupKey) {
            parsed.groupKey = lastGroupKey;
          } else {
            parsed.groupKey = `AUTO_${autoSeq++}`;
          }
        }
        lastGroupKey = parsed.groupKey;
        rawRows.push(parsed);
      } catch (err: any) {
        errors.push({
          row: rowNumber,
          userMark: '',
          reason: err.message || '行数据解析异常',
        });
      }
    });

    if (rawRows.length === 0 && errors.length === 0) {
      return {
        total: 0,
        successCount: 0,
        failedCount: 0,
        successWaybillNos: [],
        errors: [{ row: 2, userMark: '', reason: 'Excel 表格中没有有效的数据行' }],
      };
    }

    // 5. 将明细行聚合成运单 (Group By TempGroupKey)
    const groupedMap = new Map<string, GroupedWaybill>();

    for (const r of rawRows) {
      let g = groupedMap.get(r.groupKey);
      if (!g) {
        g = {
          groupKey: r.groupKey,
          mainRowNumber: r.rowNumber,
          userMark: r.userMark,
          originWarehouse: r.originWarehouse,
          destinationCountry: r.destinationCountry,
          destinationPort: r.destinationPort,
          expressNo: r.expressNo,
          airWaybillNo: r.airWaybillNo,
          forwarderChannel: r.forwarderChannel,
          customsType: r.customsType,
          overseasName: r.overseasName,
          overseasPhone: r.overseasPhone,
          overseasCompany: r.overseasCompany,
          overseasAddress: r.overseasAddress,
          overseasRegion: r.overseasRegion,
          note: r.note,
          receivableAmount: r.receivableAmount,
          containerNo: r.containerNo,
          containerType: r.containerType,
          blNumber: r.blNumber,
          carrier: r.carrier,
          vesselVoyage: r.vesselVoyage,
          originPort: r.originPort,
          bookingChannel: r.bookingChannel,
          customsChannel: r.customsChannel,
          clearanceChannel: r.clearanceChannel,
          truckingFee: r.truckingFee,
          portFee: r.portFee,
          thcFee: r.thcFee,
          clearanceFee: r.clearanceFee,
          loadingDate: r.loadingDate,
          sailingDate: r.sailingDate,
          eta: r.eta,
          items: [],
          fees: [],
          attachments: [],
        };
        groupedMap.set(r.groupKey, g);
      } else {
        // 补充可能留空继承的头部信息
        if (!g.userMark && r.userMark) g.userMark = r.userMark;
        if (!g.originWarehouse && r.originWarehouse) g.originWarehouse = r.originWarehouse;
        if (!g.destinationCountry && r.destinationCountry) g.destinationCountry = r.destinationCountry;
        if (!g.forwarderChannel && r.forwarderChannel) g.forwarderChannel = r.forwarderChannel;
        if (!g.customsType && r.customsType) g.customsType = r.customsType;
        if (!g.overseasName && r.overseasName) g.overseasName = r.overseasName;
        if (!g.overseasPhone && r.overseasPhone) g.overseasPhone = r.overseasPhone;
        if (!g.overseasCompany && r.overseasCompany) g.overseasCompany = r.overseasCompany;
        if (!g.overseasAddress && r.overseasAddress) g.overseasAddress = r.overseasAddress;
        if (!g.overseasRegion && r.overseasRegion) g.overseasRegion = r.overseasRegion;
        if (!g.containerNo && r.containerNo) g.containerNo = r.containerNo;
        if (!g.containerType && r.containerType) g.containerType = r.containerType;
        if (!g.blNumber && r.blNumber) g.blNumber = r.blNumber;
        if (!g.originPort && r.originPort) g.originPort = r.originPort;
        if (!g.bookingChannel && r.bookingChannel) g.bookingChannel = r.bookingChannel;
        if (!g.customsChannel && r.customsChannel) g.customsChannel = r.customsChannel;
        if (!g.clearanceChannel && r.clearanceChannel) g.clearanceChannel = r.clearanceChannel;
      }

      // 添加货物明细
      if (r.productName) {
        g.items.push({
          rowNumber: r.rowNumber,
          productName: r.productName,
          quantity: r.quantity,
          length: r.length,
          width: r.width,
          height: r.height,
          unitWeight: r.unitWeight,
          totalWeight: r.totalWeight,
          payableVolume: r.payableVolume,
          receivableUnitPrice: r.receivableUnitPrice,
          payableUnitPrice: r.payableUnitPrice,
          trackingNumber: r.trackingNumber,
        });
      }

      // 添加费用明细 (空运与整柜各杂费)
      if (r.internalTruckingFee && r.internalTruckingFee > 0) {
        g.fees.push({
          feeName: '内部车费',
          feeDirection: FeeDirection.PAYABLE,
          amount: r.internalTruckingFee,
        });
      }
      if (r.channelTruckingFee && r.channelTruckingFee > 0) {
        g.fees.push({
          feeName: '渠道车费',
          feeDirection: FeeDirection.PAYABLE,
          amount: r.channelTruckingFee,
        });
      }
      if (r.truckingFee && r.truckingFee > 0) {
        g.fees.push({
          feeName: '拖车费用',
          feeDirection: FeeDirection.PAYABLE,
          amount: r.truckingFee,
        });
      }
      if (r.portFee && r.portFee > 0) {
        g.fees.push({
          feeName: '订舱费/港杂',
          feeDirection: FeeDirection.PAYABLE,
          amount: r.portFee,
        });
      }
      if (r.thcFee && r.thcFee > 0) {
        g.fees.push({
          feeName: 'THC超支费',
          feeDirection: FeeDirection.PAYABLE,
          amount: r.thcFee,
        });
      }
      if (r.clearanceFee && r.clearanceFee > 0) {
        g.fees.push({
          feeName: '目的港清关费',
          feeDirection: FeeDirection.PAYABLE,
          amount: r.clearanceFee,
        });
      }

      // 添加图片
      if (r.images && r.images.length > 0) {
        g.attachments.push(...r.images);
      }
    }

    // 6. 批量预查所有客户唛头 (包含默认海外收件人)
    const allUserMarks = Array.from(new Set(Array.from(groupedMap.values()).map((g) => g.userMark).filter(Boolean)));
    const existingCustomers = await prisma.customer.findMany({
      where: { clientCode: { in: allUserMarks } },
      select: {
        id: true,
        clientCode: true,
        destinationCountry: true,
        defaultWarehouse: true,
        destinationPort: true,
        addresses: {
          where: { addressType: AddressType.OVERSEAS_RECIPIENT },
          orderBy: { isDefault: 'desc' },
        },
      },
    });
    const customerMap = new Map(existingCustomers.map((c) => [c.clientCode, c]));
    const dictValidator = new DictionaryValidator();
    await dictValidator.loadMasterData();

    const successWaybillNos: string[] = [];

    // 7. 逐单校验与入库
    for (const g of groupedMap.values()) {
      // 校验唛头
      if (!g.userMark) {
        errors.push({
          row: g.mainRowNumber,
          userMark: '',
          reason: '缺少客户唛头，整单跳过',
        });
        continue;
      }

      const customer = customerMap.get(g.userMark);
      if (!customer) {
        errors.push({
          row: g.mainRowNumber,
          userMark: g.userMark,
          reason: `客户唛头 [${g.userMark}] 在系统中不存在，请先录入客户档案`,
        });
        continue;
      }

      // 字典字段严格精准校验与对齐
      if (g.originWarehouse) {
        const whRes = await dictValidator.validateOriginWarehouse(g.originWarehouse);
        if (!whRes.valid) {
          errors.push({
            row: g.mainRowNumber,
            userMark: g.userMark,
            reason: whRes.errorMessage!,
          });
          continue;
        }
        g.originWarehouse = whRes.standardValue;
      }

      const finalCountry = g.destinationCountry || customer.destinationCountry;
      if (!finalCountry) {
        errors.push({
          row: g.mainRowNumber,
          userMark: g.userMark,
          reason: `缺少目的国家：Excel 未填录，且客户档案 [${g.userMark}] 中未配置默认目的国家，整单跳过`,
        });
        continue;
      }

      const countryRes = dictValidator.validateDestinationCountry(finalCountry);
      if (!countryRes.valid) {
        errors.push({
          row: g.mainRowNumber,
          userMark: g.userMark,
          reason: countryRes.errorMessage!,
        });
        continue;
      }
      g.destinationCountry = countryRes.standardValue!;

      if (g.originPort) {
        const opRes = dictValidator.validateOriginPort(g.originPort);
        if (!opRes.valid) {
          errors.push({
            row: g.mainRowNumber,
            userMark: g.userMark,
            reason: opRes.errorMessage!,
          });
          continue;
        }
        g.originPort = opRes.standardValue;
      }

      if (g.destinationPort) {
        const portRes = dictValidator.validateDestinationPort(g.destinationCountry, g.destinationPort);
        if (!portRes.valid) {
          errors.push({
            row: g.mainRowNumber,
            userMark: g.userMark,
            reason: portRes.errorMessage!,
          });
          continue;
        }
        g.destinationPort = portRes.standardValue;
      }

      if (g.forwarderChannel) {
        const chanRes = await dictValidator.validateForwarderChannel(g.forwarderChannel);
        if (!chanRes.valid) {
          errors.push({
            row: g.mainRowNumber,
            userMark: g.userMark,
            reason: chanRes.errorMessage!,
          });
          continue;
        }
        g.forwarderChannel = chanRes.standardValue;
      }

      if (g.customsType) {
        const custRes = dictValidator.validateCustomsType(g.customsType);
        if (!custRes.valid) {
          errors.push({
            row: g.mainRowNumber,
            userMark: g.userMark,
            reason: custRes.errorMessage!,
          });
          continue;
        }
        g.customsType = custRes.standardValue;
      }

      if (g.containerType) {
        const ctRes = dictValidator.validateContainerType(g.containerType);
        if (!ctRes.valid) {
          errors.push({
            row: g.mainRowNumber,
            userMark: g.userMark,
            reason: ctRes.errorMessage!,
          });
          continue;
        }
        g.containerType = ctRes.standardValue;
      }

      // 校验明细
      if (g.items.length === 0 && orderType !== 'SEA_FCL') {
        errors.push({
          row: g.mainRowNumber,
          userMark: g.userMark,
          reason: '运单申报品名列表为空，整单跳过',
        });
        continue;
      }

      // 整柜特殊校验
      if (orderType === 'SEA_FCL') {
        if (!g.containerNo) {
          errors.push({
            row: g.mainRowNumber,
            userMark: g.userMark,
            reason: '整柜运单缺少集装箱柜号 (containerNo)，整单跳过',
          });
          continue;
        }
        if (!g.receivableAmount || g.receivableAmount <= 0) {
          errors.push({
            row: g.mainRowNumber,
            userMark: g.userMark,
            reason: '整柜运单缺少或协议总报价无效 (整柜协议总报价必须大于 0)，整单跳过',
          });
          continue;
        }
      }

      // 海外收件人必填校验：Excel 填录则优先使用，未填录则必须能从客户档案继承默认收件人；若均无则跳过并提醒
      const defaultConsignee = customer.addresses?.find((a) => a.isDefault) || customer.addresses?.[0];
      const finalOverseasName = (g.overseasName || defaultConsignee?.name || '').trim();
      const finalOverseasPhone = (g.overseasPhone || defaultConsignee?.phone || '').trim();
      const finalOverseasAddress = (g.overseasAddress || defaultConsignee?.address || '').trim();

      if (!finalOverseasName || !finalOverseasPhone || !finalOverseasAddress) {
        const missingFields: string[] = [];
        if (!finalOverseasName) missingFields.push('收件人姓名');
        if (!finalOverseasPhone) missingFields.push('联系电话');
        if (!finalOverseasAddress) missingFields.push('派送地址');

        if (!g.overseasName && !g.overseasPhone && !g.overseasAddress && !defaultConsignee) {
          errors.push({
            row: g.mainRowNumber,
            userMark: g.userMark,
            reason: `缺少海外收件人信息：Excel 未填录，且客户 [${g.userMark}] 档案中未配置默认海外收件人，整单跳过`,
          });
        } else {
          errors.push({
            row: g.mainRowNumber,
            userMark: g.userMark,
            reason: `海外收件人信息不完整（缺少：${missingFields.join('、')}），整单跳过`,
          });
        }
        continue;
      }

      try {
        const waybillNo = await this.saveSingleWaybill(g, orderType, customer, operatorId);
        successWaybillNos.push(waybillNo);
      } catch (err: any) {
        errors.push({
          row: g.mainRowNumber,
          userMark: g.userMark,
          reason: err.message || '运单保存入库失败',
        });
      }
    }

    const totalWaybills = groupedMap.size;
    return {
      total: totalWaybills,
      successCount: successWaybillNos.length,
      failedCount: totalWaybills - successWaybillNos.length,
      successWaybillNos,
      errors,
    };
  }

  /**
   * 持久化单张运单及明细
   */
  private async saveSingleWaybill(
    g: GroupedWaybill,
    orderType: ShipmentType,
    customer: {
      id: string;
      clientCode: string;
      defaultWarehouse?: string | null;
      destinationCountry?: string | null;
      destinationPort?: string | null;
      addresses?: Array<{
        name: string;
        phone: string;
        company?: string | null;
        region?: string | null;
        address: string;
        isDefault: boolean;
      }>;
    },
    operatorId?: string
  ): Promise<string> {
    const waybillNo = generateWaybillNo(orderType);

    // 智能提取海外收件人：Excel 填录则优先覆盖，留空则从客户地址簿继承默认收件人
    const defaultConsignee = customer.addresses?.find((a) => a.isDefault) || customer.addresses?.[0];
    const finalOverseasName = g.overseasName || defaultConsignee?.name || undefined;
    const finalOverseasPhone = g.overseasPhone || defaultConsignee?.phone || undefined;
    const finalOverseasCompany = g.overseasCompany || defaultConsignee?.company || undefined;
    const finalOverseasAddress = g.overseasAddress || defaultConsignee?.address || undefined;
    const finalOverseasRegion =
      g.overseasRegion || defaultConsignee?.region || g.destinationPort || customer.destinationPort || undefined;

    // 计算汇总指标
    let totalPieces = 0;
    let totalPayableCbm = 0;
    let totalReceivableCbm = 0;
    let totalWeightKg = 0;

    const itemsData = g.items.map((item, idx) => {
      totalPieces += item.quantity;
      const qty = item.quantity > 0 ? item.quantity : 1;

      let vol = item.payableVolume ? Number(item.payableVolume) : 0;
      if (!vol && item.length && item.width && item.height) {
        vol = (Number(item.length) * Number(item.width) * Number(item.height) * qty) / 1_000_000;
      }
      totalPayableCbm += vol;
      totalReceivableCbm += vol;

      const wt = item.totalWeight ? Number(item.totalWeight) : (item.unitWeight ? Number(item.unitWeight) * qty : 0);
      totalWeightKg += wt;

      return {
        itemIndex: idx + 1,
        productName: item.productName || '未申报品名',
        quantity: item.quantity,
        length: item.length,
        width: item.width,
        height: item.height,
        unitWeight: item.unitWeight,
        totalWeight: item.totalWeight || (item.unitWeight ? item.unitWeight * qty : undefined),
        payableVolume: vol > 0 ? vol : undefined,
        receivableVolume: vol > 0 ? vol : undefined,
        receivableUnitPrice: item.receivableUnitPrice,
        payableUnitPrice: item.payableUnitPrice,
        trackingNumber: item.trackingNumber,
      };
    });

    // 计算财务数据
    const financials = calculateWaybillFinancials({
      orderType,
      isFixedPrice: orderType === 'SEA_FCL' && !!g.receivableAmount,
      fixedPriceAmount: g.receivableAmount,
      items: itemsData,
      fees: g.fees,
    });

    // 处理 FCL 集装箱关联 (Upsert 保证始终同步最新渠道、起运港与柜型)
    let containerMasterId: string | undefined;
    if (orderType === 'SEA_FCL' && g.containerNo) {
      const contData = {
        containerNo: g.containerNo,
        containerType: g.containerType || undefined,
        blNumber: g.blNumber,
        carrier: g.carrier,
        vesselVoyage: g.vesselVoyage,
        originPort: g.originPort || undefined,
        destinationPort: g.destinationPort || customer.destinationPort || undefined,
        bookingChannel: g.bookingChannel,
        customsChannel: g.customsChannel,
        clearanceChannel: g.clearanceChannel,
        loadingDate: g.loadingDate,
        sailingDate: g.sailingDate,
        eta: g.eta,
      };

      const cont = await prisma.containerMaster.upsert({
        where: { containerNo: g.containerNo },
        create: contData,
        update: {
          containerType: contData.containerType,
          blNumber: contData.blNumber || undefined,
          carrier: contData.carrier || undefined,
          vesselVoyage: contData.vesselVoyage || undefined,
          originPort: contData.originPort || undefined,
          destinationPort: contData.destinationPort || undefined,
          bookingChannel: contData.bookingChannel || undefined,
          customsChannel: contData.customsChannel || undefined,
          clearanceChannel: contData.clearanceChannel || undefined,
          loadingDate: contData.loadingDate || undefined,
          sailingDate: contData.sailingDate || undefined,
          eta: contData.eta || undefined,
        },
      });
      containerMasterId = cont.id;
    }

    // 写入数据库
    await prisma.$transaction(async (tx) => {
      const isFcl = orderType === 'SEA_FCL';
      const finalOriginWarehouse = isFcl
        ? (g.originPort || g.originWarehouse || undefined)
        : (g.originWarehouse || customer.defaultWarehouse || undefined);
      const finalForwarderChannel = isFcl
        ? (g.forwarderChannel || g.bookingChannel || undefined)
        : (g.forwarderChannel || undefined);

      const waybill = await tx.waybill.create({
        data: {
          waybillNo,
          orderType,
          status: WaybillStatus.INBOUND,
          customerId: customer.id,
          userMark: customer.clientCode,
          operatorId,
          originWarehouse: finalOriginWarehouse,
          destinationCountry: g.destinationCountry || customer.destinationCountry || '菲律宾',
          destinationPort: g.destinationPort || customer.destinationPort || undefined,
          expressNo: g.expressNo,
          airWaybillNo: g.airWaybillNo,
          forwarderChannel: finalForwarderChannel,
          customsType: g.customsType,
          overseasName: finalOverseasName,
          overseasPhone: finalOverseasPhone,
          overseasCompany: finalOverseasCompany,
          overseasAddress: finalOverseasAddress,
          overseasRegion: finalOverseasRegion,
          voyageNumber: g.vesselVoyage,
          note: g.note,
          containerId: containerMasterId,
          totalPieces,
          totalPayableCbm: totalPayableCbm > 0 ? totalPayableCbm : undefined,
          totalReceivableCbm: totalReceivableCbm > 0 ? totalReceivableCbm : undefined,
          totalWeightKg: totalWeightKg > 0 ? totalWeightKg : undefined,
          receivableAmount: financials.receivableAmount,
          payableAmount: financials.payableAmount,
          profitAmount: financials.profitAmount,
          isFixedPrice: orderType === 'SEA_FCL' && !!g.receivableAmount,
          inboundDate: new Date(),
        },
      });

      // 批量创建明细
      if (itemsData.length > 0) {
        await tx.waybillItem.createMany({
          data: itemsData.map((it) => ({
            ...it,
            waybillId: waybill.id,
          })),
        });
      }

      // 批量创建杂费
      if (g.fees.length > 0) {
        await tx.waybillFee.createMany({
          data: g.fees.map((fee) => ({
            waybillId: waybill.id,
            feeName: fee.feeName,
            feeDirection: fee.feeDirection,
            amount: fee.amount,
            currency: CurrencyType.CNY,
            exchangeRate: 1.0,
            amountInCny: fee.amount,
          })),
        });
      }

      // 批量创建附件
      if (g.attachments.length > 0) {
        await tx.waybillAttachment.createMany({
          data: g.attachments.map((att) => ({
            waybillId: waybill.id,
            attachmentType: att.attachmentType,
            fileUrl: att.fileUrl,
            fileName: att.fileName,
            fileSize: att.fileSize,
          })),
        });
      }
    });

    return waybillNo;
  }

  /**
   * 解析单行数据并挂载单元格内嵌图片
   */
  private parseRowData(
    row: ExcelJS.Row,
    rowNumber: number,
    colMap: Record<string, number>,
    _orderType: ShipmentType,
    imageMap: Map<string, any[]>
  ): ParsedItemRow {

    const getVal = (colIdx?: number) => (colIdx ? this.getCellValue(row.getCell(colIdx)) : undefined);
    const getNum = (colIdx?: number) => {
      const v = getVal(colIdx);
      if (v === undefined || v === null || String(v).trim() === '') return undefined;
      const n = Number(String(v).replace(/[^\d.-]/g, ''));
      return isNaN(n) ? undefined : n;
    };
    const getDate = (colIdx?: number) => {
      const v = getVal(colIdx);
      if (!v) return undefined;
      const d = new Date(v);
      return isNaN(d.getTime()) ? undefined : d;
    };

    const groupKey = String(getVal(colMap.groupKey) || '').trim();
    const userMark = String(getVal(colMap.userMark) || '').trim();
    const productName = String(getVal(colMap.productName) || '').trim();
    const quantity = getNum(colMap.quantity) || 1;

    const parsed: ParsedItemRow = {
      rowNumber,
      groupKey,
      userMark,
      originWarehouse: String(getVal(colMap.originWarehouse) || '').trim() || undefined,
      destinationCountry: String(getVal(colMap.destinationCountry) || '').trim() || undefined,
      destinationPort: String(getVal(colMap.destinationPort) || '').trim() || undefined,
      expressNo: String(getVal(colMap.expressNo) || '').trim() || undefined,
      airWaybillNo: String(getVal(colMap.airWaybillNo) || '').trim() || undefined,
      forwarderChannel: String(getVal(colMap.forwarderChannel) || '').trim() || undefined,
      customsType: String(getVal(colMap.customsType) || '').trim() || undefined,
      overseasName: String(getVal(colMap.overseasName) || '').trim() || undefined,
      overseasPhone: String(getVal(colMap.overseasPhone) || '').trim() || undefined,
      overseasCompany: String(getVal(colMap.overseasCompany) || '').trim() || undefined,
      overseasAddress: String(getVal(colMap.overseasAddress) || '').trim() || undefined,
      note: String(getVal(colMap.note) || '').trim() || undefined,
      productName,
      quantity,
      length: getNum(colMap.length),
      width: getNum(colMap.width),
      height: getNum(colMap.height),
      unitWeight: getNum(colMap.unitWeight),
      totalWeight: getNum(colMap.totalWeight),
      payableVolume: getNum(colMap.payableVolume),
      receivableUnitPrice: getNum(colMap.receivableUnitPrice),
      payableUnitPrice: getNum(colMap.payableUnitPrice),
      trackingNumber: String(getVal(colMap.trackingNumber) || '').trim() || undefined,
      internalTruckingFee: getNum(colMap.internalTruckingFee),
      channelTruckingFee: getNum(colMap.channelTruckingFee),
      receivableAmount: getNum(colMap.receivableAmount),
      containerNo: String(getVal(colMap.containerNo) || '').trim() || undefined,
      containerType: String(getVal(colMap.containerType) || '').trim() || undefined,
      blNumber: String(getVal(colMap.blNumber) || '').trim() || undefined,
      carrier: String(getVal(colMap.carrier) || '').trim() || undefined,
      vesselVoyage: String(getVal(colMap.vesselVoyage) || '').trim() || undefined,
      originPort: String(getVal(colMap.originPort) || '').trim() || undefined,
      bookingChannel: String(getVal(colMap.bookingChannel) || '').trim() || undefined,
      customsChannel: String(getVal(colMap.customsChannel) || '').trim() || undefined,
      clearanceChannel: String(getVal(colMap.clearanceChannel) || '').trim() || undefined,
      truckingFee: getNum(colMap.truckingFee),
      portFee: getNum(colMap.portFee),
      thcFee: getNum(colMap.thcFee),
      clearanceFee: getNum(colMap.clearanceFee),
      loadingDate: getDate(colMap.loadingDate),
      sailingDate: getDate(colMap.sailingDate),
      eta: getDate(colMap.eta),
      images: [],
    };

    // 检查此行所有图片列
    const checkImageCol = (colIdx: number | undefined, type: AttachmentType) => {
      if (!colIdx) return;
      const key = `${rowNumber}_${colIdx}`;
      const imgs = imageMap.get(key);
      if (imgs && imgs.length > 0) {
        for (const img of imgs) {
          parsed.images.push({
            fileUrl: img.fileUrl,
            fileName: img.fileName,
            fileSize: img.fileSize,
            attachmentType: type,
          });
        }
      }
    };

    checkImageCol(colMap.pickupImg, AttachmentType.PICKUP_SCREENSHOT);
    checkImageCol(colMap.signImg, AttachmentType.SIGN_IMAGE);
    checkImageCol(colMap.customsSlipImg, AttachmentType.CUSTOMS_SLIP);
    checkImageCol(colMap.weightImg, AttachmentType.OTHER);

    return parsed;
  }

  /**
   * 表头列 1:1 官方模板表头精准匹配 (1:1 Exact Official Header Mapping)
   */
  private mapHeaderColumns(headerRow: ExcelJS.Row, orderType: ShipmentType): Record<string, number> {
    const map: Record<string, number> = {};

    let officialCols: Array<{ header: string; key: string }> = [];
    if (orderType === 'SEA_LCL') officialCols = OFFICIAL_SEA_LCL_COLUMNS;
    else if (orderType === 'AIR') officialCols = OFFICIAL_AIR_COLUMNS;
    else if (orderType === 'SEA_FCL') officialCols = OFFICIAL_SEA_FCL_COLUMNS;

    // 构建 1:1 精准查找映射
    const headerToKeyMap = new Map<string, string>();
    for (const col of officialCols) {
      headerToKeyMap.set(col.header.trim(), col.key);
      headerToKeyMap.set(col.header.replace(/\s+/g, ''), col.key);
      const noBracket = col.header.replace(/[\(（].*?[\)）]/g, '').trim();
      headerToKeyMap.set(noBracket, col.key);
    }

    headerRow.eachCell((cell, colNumber) => {
      const rawText = String(cell.value || '').trim();
      if (!rawText) return;

      const rawNoSpace = rawText.replace(/\s+/g, '');
      const rawNoBracket = rawText.replace(/[\(（].*?[\)）]/g, '').trim();

      const matchedKey =
        headerToKeyMap.get(rawText) ||
        headerToKeyMap.get(rawNoSpace) ||
        headerToKeyMap.get(rawNoBracket);

      if (matchedKey) {
        map[matchedKey] = colNumber;
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
