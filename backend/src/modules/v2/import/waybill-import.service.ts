import ExcelJS from 'exceljs';
import { PrismaClient, ShipmentType, WaybillStatus, CurrencyType, FeeDirection, AttachmentType } from '@prisma/client';
import { calculateWaybillFinancials } from '../waybill/waybill.service';
import { ImageExtractorService } from './image-extractor.service';
import { ImportErrorDetail } from './customer-import.service';

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
  destinationCountry: string;
  destinationPort?: string;
  expressNo?: string;
  airWaybillNo?: string;
  forwarderChannel?: string;
  customsType?: string;
  note?: string;
  receivableAmount?: number;

  // FCL specific
  containerNo?: string;
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
          destinationCountry: r.destinationCountry || (orderType === 'SEA_FCL' ? '菲律宾' : '菲律宾'),
          destinationPort: r.destinationPort,
          expressNo: r.expressNo,
          airWaybillNo: r.airWaybillNo,
          forwarderChannel: r.forwarderChannel,
          customsType: r.customsType,
          note: r.note,
          receivableAmount: r.receivableAmount,
          containerNo: r.containerNo,
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

      // 添加费用明细
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

      // 添加图片
      if (r.images && r.images.length > 0) {
        g.attachments.push(...r.images);
      }
    }

    // 6. 批量预查所有客户唛头
    const allUserMarks = Array.from(new Set(Array.from(groupedMap.values()).map((g) => g.userMark).filter(Boolean)));
    const existingCustomers = await prisma.customer.findMany({
      where: { clientCode: { in: allUserMarks } },
      select: { id: true, clientCode: true, destinationCountry: true, defaultWarehouse: true, destinationPort: true },
    });
    const customerMap = new Map(existingCustomers.map((c) => [c.clientCode, c]));

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
      if (orderType === 'SEA_FCL' && !g.containerNo) {
        errors.push({
          row: g.mainRowNumber,
          userMark: g.userMark,
          reason: '整柜运单缺少集装箱柜号 (containerNo)，整单跳过',
        });
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
    customer: { id: string; clientCode: string; defaultWarehouse?: string | null; destinationCountry?: string | null; destinationPort?: string | null },
    operatorId?: string
  ): Promise<string> {
    const waybillNo = generateWaybillNo(orderType);

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

    // 处理 FCL 集装箱关联
    let containerMasterId: string | undefined;
    if (orderType === 'SEA_FCL' && g.containerNo) {
      let cont = await prisma.containerMaster.findUnique({
        where: { containerNo: g.containerNo },
      });
      if (!cont) {
        cont = await prisma.containerMaster.create({
          data: {
            containerNo: g.containerNo,
            blNumber: g.blNumber,
            carrier: g.carrier,
            vesselVoyage: g.vesselVoyage,
            originPort: g.originPort,
            destinationPort: g.destinationPort || customer.destinationPort || '马尼拉南港',
            bookingChannel: g.bookingChannel,
            customsChannel: g.customsChannel,
            clearanceChannel: g.clearanceChannel,
            loadingDate: g.loadingDate,
            sailingDate: g.sailingDate,
            eta: g.eta,
          },
        });
      }
      containerMasterId = cont.id;
    }

    // 写入数据库
    await prisma.$transaction(async (tx) => {
      const waybill = await tx.waybill.create({
        data: {
          waybillNo,
          orderType,
          status: WaybillStatus.INBOUND,
          customerId: customer.id,
          userMark: customer.clientCode,
          operatorId,
          originWarehouse: g.originWarehouse || customer.defaultWarehouse || '广州仓',
          destinationCountry: g.destinationCountry || customer.destinationCountry || '菲律宾',
          destinationPort: g.destinationPort || customer.destinationPort,
          expressNo: g.expressNo,
          airWaybillNo: g.airWaybillNo,
          forwarderChannel: g.forwarderChannel,
          customsType: g.customsType,
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
   * 表头列智能匹配
   */
  private mapHeaderColumns(headerRow: ExcelJS.Row, orderType: ShipmentType): Record<string, number> {
    const map: Record<string, number> = {};

    headerRow.eachCell((cell, colNumber) => {
      const text = String(cell.value || '').trim();

      if (text.includes('分组') || text.includes('序号') || text.includes('组号')) {
        map.groupKey = colNumber;
      } else if (text.includes('唛头') || text.includes('客户代码') || text.includes('客户')) {
        map.userMark = colNumber;
      } else if (text.includes('起运仓') || text.includes('仓库')) {
        map.originWarehouse = colNumber;
      } else if (text.includes('目的国') || text.includes('国家')) {
        map.destinationCountry = colNumber;
      } else if (text.includes('目的港') || text.includes('清关港口')) {
        map.destinationPort = colNumber;
      } else if (text.includes('专线单号') || text.includes('运递单号')) {
        map.expressNo = colNumber;
      } else if (text.includes('空运单号') || text.includes('AWB') || text.includes('提单号')) {
        if (orderType === 'AIR') {
          map.airWaybillNo = colNumber;
        } else if (orderType === 'SEA_FCL') {
          map.blNumber = colNumber;
        }
      } else if (text.includes('品名') || text.includes('货物名称')) {
        map.productName = colNumber;
      } else if (text.includes('件数') || text.includes('数量')) {
        map.quantity = colNumber;
      } else if (text === '长' || text.includes('长 (cm)') || text.includes('长(cm)')) {
        map.length = colNumber;
      } else if (text === '宽' || text.includes('宽 (cm)') || text.includes('宽(cm)')) {
        map.width = colNumber;
      } else if (text === '高' || text.includes('高 (cm)') || text.includes('高(cm)')) {
        map.height = colNumber;
      } else if (text.includes('单重')) {
        map.unitWeight = colNumber;
      } else if (text.includes('重量') || text.includes('计费重量') || text.includes('合计重量')) {
        map.totalWeight = colNumber;
      } else if (text.includes('体积') || text.includes('方数')) {
        map.payableVolume = colNumber;
      } else if (text.includes('应收单价') || text.includes('应收（RMB）') || text.includes('应收(RMB)')) {
        map.receivableUnitPrice = colNumber;
      } else if (text.includes('应付单价') || text.includes('应付（RMB）') || text.includes('应付(RMB)') || text.includes('应付成本')) {
        map.payableUnitPrice = colNumber;
      } else if (text.includes('送仓') || text.includes('快递单号')) {
        map.trackingNumber = colNumber;
      } else if (text.includes('内部车费')) {
        map.internalTruckingFee = colNumber;
      } else if (text.includes('渠道车费') || text.includes('应付渠道车费')) {
        map.channelTruckingFee = colNumber;
      } else if (text.includes('叫车截图')) {
        map.pickupImg = colNumber;
      } else if (text.includes('签收截图') || text.includes('签收图片')) {
        map.signImg = colNumber;
      } else if (text.includes('水单') || text.includes('报关水单')) {
        map.customsSlipImg = colNumber;
      } else if (text.includes('过磅')) {
        map.weightImg = colNumber;
      } else if (text.includes('柜号') || text.includes('集装箱')) {
        map.containerNo = colNumber;
      } else if (text.includes('船公司') || text.includes('船司')) {
        map.carrier = colNumber;
      } else if (text.includes('航次') || text.includes('船名')) {
        map.vesselVoyage = colNumber;
      } else if (text.includes('起运港') || text.includes('出口港口')) {
        map.originPort = colNumber;
      } else if (text.includes('订舱渠道')) {
        map.bookingChannel = colNumber;
      } else if (text.includes('报关渠道')) {
        map.customsChannel = colNumber;
      } else if (text.includes('清关渠道')) {
        map.clearanceChannel = colNumber;
      } else if (text.includes('报关/通道') || text.includes('通道类型') || text.includes('报关类型') || text.includes('货品通道')) {
        map.customsType = colNumber;
      } else if (text.includes('承运') || text.includes('服务商') || text.includes('渠道') || text.includes('专线渠道')) {
        map.forwarderChannel = colNumber;
      } else if (text.includes('包干报价') || text.includes('客户报价') || text.includes('整柜包干')) {
        map.receivableAmount = colNumber;
      } else if (text.includes('拖车费用') || text.includes('拖车')) {
        map.truckingFee = colNumber;
      } else if (text.includes('港杂') || text.includes('订舱费')) {
        map.portFee = colNumber;
      } else if (text.includes('THC') || text.includes('堆箱费')) {
        map.thcFee = colNumber;
      } else if (text.includes('清关费')) {
        map.clearanceFee = colNumber;
      } else if (text.includes('装柜时间') || text.includes('装柜日期')) {
        map.loadingDate = colNumber;
      } else if (text.includes('开船时间') || text.includes('开船日期')) {
        map.sailingDate = colNumber;
      } else if (text.includes('预计到港') || text.includes('ETA')) {
        map.eta = colNumber;
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
