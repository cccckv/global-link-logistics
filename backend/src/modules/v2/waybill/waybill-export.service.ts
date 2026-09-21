import ExcelJS from 'exceljs';
import { PrismaClient, ShipmentType, WaybillStatus } from '@prisma/client';

const prisma = new PrismaClient();

function buildWaybillWhere(params: any): any {
  const {
    orderType,
    status,
    search,
    userMark,
    containerId,
    containerNo,
    originWarehouse,
    destinationCountry,
    destinationPort,
    forwarderChannel,
    customsType,
    unassignedOnly,
    noAddressOnly,
    overseasKeyword,
    dateType,
    startDate,
    endDate,
  } = params;

  const where: any = {};
  const andConditions: any[] = [];

  if (orderType) where.orderType = orderType;

  // 待补地址专用筛选
  const isNoAddress = noAddressOnly === true || noAddressOnly === 'true';
  if (isNoAddress) {
    andConditions.push({
      OR: [
        { overseasAddress: null },
        { overseasAddress: '' },
      ],
    });
  }

  // 待配载/待排柜/待发运筛选
  const isUnassigned = unassignedOnly === true || unassignedOnly === 'true';
  if (isUnassigned) {
    where.containerId = null;
    if (status) {
      where.status = status;
    } else {
      where.status = 'INBOUND';
    }
  } else {
    if (status) where.status = status;
    if (containerId) where.containerId = containerId;
  }

  if (params.userMarks && params.userMarks.length > 0) {
    if (userMark && userMark.trim() && params.userMarks.includes(userMark.trim())) {
      where.userMark = userMark.trim();
    } else {
      where.userMark = { in: params.userMarks };
    }
  } else if (userMark && userMark.trim()) {
    where.userMark = { contains: userMark.trim(), mode: 'insensitive' };
  }

  if (originWarehouse && originWarehouse.trim()) {
    where.originWarehouse = { contains: originWarehouse.trim(), mode: 'insensitive' };
  }

  if (destinationCountry && destinationCountry.trim()) {
    where.destinationCountry = { contains: destinationCountry.trim(), mode: 'insensitive' };
  }

  if (destinationPort && destinationPort.trim()) {
    where.destinationPort = { contains: destinationPort.trim(), mode: 'insensitive' };
  }

  if (forwarderChannel && forwarderChannel.trim()) {
    where.forwarderChannel = { contains: forwarderChannel.trim(), mode: 'insensitive' };
  }

  if (customsType && customsType.trim()) {
    where.customsType = { contains: customsType.trim(), mode: 'insensitive' };
  }

  // 柜号/提单号精确或模糊反查
  if (containerNo && containerNo.trim()) {
    const cNo = containerNo.trim();
    where.containerMaster = {
      OR: [
        { containerNo: { contains: cNo, mode: 'insensitive' } },
        { blNumber: { contains: cNo, mode: 'insensitive' } },
        { vesselVoyage: { contains: cNo, mode: 'insensitive' } },
      ],
    };
  }

  // 海外收件人/电话/公司模糊搜索
  if (overseasKeyword && overseasKeyword.trim()) {
    const okw = overseasKeyword.trim();
    andConditions.push({
      OR: [
        { overseasName: { contains: okw, mode: 'insensitive' } },
        { overseasPhone: { contains: okw, mode: 'insensitive' } },
        { overseasCompany: { contains: okw, mode: 'insensitive' } },
        { overseasAddress: { contains: okw, mode: 'insensitive' } },
      ],
    });
  }

  // 综合模糊搜索
  if (search && search.trim()) {
    const s = search.trim();
    andConditions.push({
      OR: [
        { waybillNo: { contains: s, mode: 'insensitive' } },
        { expressNo: { contains: s, mode: 'insensitive' } },
        { userMark: { contains: s, mode: 'insensitive' } },
        { airWaybillNo: { contains: s, mode: 'insensitive' } },
        { voyageNumber: { contains: s, mode: 'insensitive' } },
        { destinationCountry: { contains: s, mode: 'insensitive' } },
        { destinationPort: { contains: s, mode: 'insensitive' } },
        { forwarderChannel: { contains: s, mode: 'insensitive' } },
        { overseasName: { contains: s, mode: 'insensitive' } },
        { overseasPhone: { contains: s, mode: 'insensitive' } },
        { containerMaster: { containerNo: { contains: s, mode: 'insensitive' } } },
        { containerMaster: { blNumber: { contains: s, mode: 'insensitive' } } },
        {
          items: {
            some: {
              OR: [
                { trackingNumber: { contains: s, mode: 'insensitive' } },
                { productName: { contains: s, mode: 'insensitive' } },
              ],
            },
          },
        },
      ],
    });
  }

  // 业务时间范围筛选
  if (startDate || endDate) {
    const validDateFields = ['createdAt', 'inboundDate', 'loadingDate', 'sailingDate', 'eta', 'signedDate'];
    const field = dateType && validDateFields.includes(dateType) ? dateType : 'createdAt';
    const dateCondition: any = {};
    if (startDate) {
      dateCondition.gte = new Date(startDate);
    }
    if (endDate) {
      const eDate = new Date(endDate);
      eDate.setHours(23, 59, 59, 999);
      dateCondition.lte = eDate;
    }
    where[field] = dateCondition;
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  return where;
}

export interface WaybillExportOptions {
  scope: 'selected' | 'filtered';
  ids?: string[];
  columns: string[];
  // 筛选过滤参数 (与列表保持完全一致)
  orderType?: ShipmentType;
  status?: WaybillStatus;
  search?: string;
  originWarehouse?: string;
  destinationCountry?: string;
  destinationPort?: string;
  forwarderChannel?: string;
  customsType?: string;
  unassignedOnly?: boolean | string;
  noAddressOnly?: boolean | string;
  overseasKeyword?: string;
  dateType?: string;
  startDate?: string;
  endDate?: string;
  userMarks?: string[];
}

interface ColumnDefinition {
  key: string;
  header: string;
  width: number;
  align?: 'left' | 'center' | 'right';
  numFmt?: string;
  getValue: (wb: any, item: any, itemIndex: number, totalItems: number) => any;
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  SEA_LCL: '海运拼柜 (LCL)',
  AIR: '空运快递 (AIR)',
  SEA_FCL: '海运整柜 (FCL)',
  LAND: '陆运装车',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '待入库/已预报',
  INBOUND: '已入库/已核量',
  LOADED: '已装柜/已进港',
  IN_TRANSIT: '在途运输中',
  CUSTOMS: '目的港清关中',
  DISPATCHING: '海外派送中',
  DELIVERED: '已签收完成',
  CANCELLED: '已取消',
};

function formatDateTime(d?: Date | string | null): string {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '-';
  const Y = dt.getFullYear();
  const M = String(dt.getMonth() + 1).padStart(2, '0');
  const D = String(dt.getDate()).padStart(2, '0');
  const h = String(dt.getHours()).padStart(2, '0');
  const m = String(dt.getMinutes()).padStart(2, '0');
  const s = String(dt.getSeconds()).padStart(2, '0');
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}

function formatDate(d?: Date | string | null): string {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '-';
  const Y = dt.getFullYear();
  const M = String(dt.getMonth() + 1).padStart(2, '0');
  const D = String(dt.getDate()).padStart(2, '0');
  return `${Y}-${M}-${D}`;
}

// 全量可用导出列元定义 (共 34 个列)
export const EXPORT_COLUMN_REGISTRY: Record<string, ColumnDefinition> = {
  // 1. 核心单号与状态
  waybillNo: {
    key: 'waybillNo',
    header: '系统运单号',
    width: 18,
    align: 'center',
    getValue: (wb) => wb.waybillNo || '-',
  },
  expressNo: {
    key: 'expressNo',
    header: '专线单号/运递号',
    width: 18,
    align: 'center',
    getValue: (wb) => wb.expressNo || '-',
  },
  userMark: {
    key: 'userMark',
    header: '客户唛头',
    width: 16,
    align: 'center',
    getValue: (wb) => wb.userMark || '-',
  },
  orderType: {
    key: 'orderType',
    header: '运输方式',
    width: 16,
    align: 'center',
    getValue: (wb) => ORDER_TYPE_LABELS[wb.orderType] || wb.orderType,
  },
  status: {
    key: 'status',
    header: '运单状态',
    width: 16,
    align: 'center',
    getValue: (wb) => STATUS_LABELS[wb.status] || wb.status,
  },
  createdAt: {
    key: 'createdAt',
    header: '下单预报时间',
    width: 20,
    align: 'center',
    getValue: (wb) => formatDateTime(wb.createdAt),
  },
  airWaybillNo: {
    key: 'airWaybillNo',
    header: '空运提单号(AWB)',
    width: 16,
    align: 'center',
    getValue: (wb) => wb.airWaybillNo || '-',
  },
  trackingNumber: {
    key: 'trackingNumber',
    header: '国内送仓快递单号',
    width: 22,
    align: 'center',
    getValue: (_wb, item) => item?.trackingNumber || '-',
  },

  // 2. 路线与航运流向
  originWarehouse: {
    key: 'originWarehouse',
    header: '起运地(仓/港)',
    width: 16,
    align: 'center',
    getValue: (wb) => wb.originWarehouse || '广州',
  },
  destinationCountry: {
    key: 'destinationCountry',
    header: '目的国家',
    width: 14,
    align: 'center',
    getValue: (wb) => wb.destinationCountry || '-',
  },
  destinationPort: {
    key: 'destinationPort',
    header: '清关目的港/机场',
    width: 18,
    align: 'center',
    getValue: (wb) => wb.destinationPort || '-',
  },
  forwarderChannel: {
    key: 'forwarderChannel',
    header: '承运专线渠道',
    width: 16,
    align: 'center',
    getValue: (wb) => wb.forwarderChannel || '-',
  },
  customsType: {
    key: 'customsType',
    header: '报关申报通道',
    width: 16,
    align: 'center',
    getValue: (wb) => wb.customsType || '-',
  },

  // 3. 货物明细与实测规格 (拆行展示)
  productName: {
    key: 'productName',
    header: '中文品名',
    width: 22,
    align: 'left',
    getValue: (_wb, item) => item?.productName || '商品',
  },
  itemIndex: {
    key: 'itemIndex',
    header: '货品明细序号',
    width: 14,
    align: 'center',
    getValue: (_wb, _item, idx, total) => total > 0 ? `${idx + 1}/${total}` : '1/1',
  },
  quantity: {
    key: 'quantity',
    header: '实收件数',
    width: 12,
    align: 'right',
    numFmt: '#,##0',
    getValue: (_wb, item) => item?.quantity ?? 1,
  },
  dimensions: {
    key: 'dimensions',
    header: '实测长宽高(cm)',
    width: 18,
    align: 'center',
    getValue: (_wb, item) => {
      if (!item || (item.length == null && item.width == null && item.height == null)) return '-';
      return `${item.length ?? '-'}×${item.width ?? '-'}×${item.height ?? '-'}`;
    },
  },
  payableVolume: {
    key: 'payableVolume',
    header: '实测方量(m³)',
    width: 14,
    align: 'right',
    numFmt: '0.0000',
    getValue: (_wb, item) => item?.payableVolume ? Number(item.payableVolume) : 0,
  },
  receivableVolume: {
    key: 'receivableVolume',
    header: '计费方量(m³)',
    width: 14,
    align: 'right',
    numFmt: '0.0000',
    getValue: (_wb, item) => item?.receivableVolume ? Number(item.receivableVolume) : 0,
  },
  unitWeight: {
    key: 'unitWeight',
    header: '单件重量(kg)',
    width: 14,
    align: 'right',
    numFmt: '0.000',
    getValue: (_wb, item) => item?.unitWeight ? Number(item.unitWeight) : 0,
  },
  totalWeight: {
    key: 'totalWeight',
    header: '实测总重(kg)',
    width: 14,
    align: 'right',
    numFmt: '0.000',
    getValue: (_wb, item) => item?.totalWeight ? Number(item.totalWeight) : 0,
  },

  // 4. 集装箱与干线航务
  containerNo: {
    key: 'containerNo',
    header: '装载集装箱柜号',
    width: 18,
    align: 'center',
    getValue: (wb) => wb.containerMaster?.containerNo || (wb.containerId ? '已装柜' : '待排柜'),
  },
  blNumber: {
    key: 'blNumber',
    header: '海运主提单号',
    width: 20,
    align: 'center',
    getValue: (wb) => wb.containerMaster?.blNumber || '-',
  },
  vesselVoyage: {
    key: 'vesselVoyage',
    header: '船名/航次',
    width: 18,
    align: 'center',
    getValue: (wb) => wb.containerMaster?.vesselVoyage || wb.voyageNumber || '-',
  },

  // 5. 全生命周期节点时间
  inboundDate: {
    key: 'inboundDate',
    header: '国内入库实测日',
    width: 16,
    align: 'center',
    getValue: (wb) => formatDate(wb.inboundDate),
  },
  loadingDate: {
    key: 'loadingDate',
    header: '装柜/起飞日',
    width: 16,
    align: 'center',
    getValue: (wb) => formatDate(wb.loadingDate),
  },
  sailingDate: {
    key: 'sailingDate',
    header: '船舶开航日',
    width: 16,
    align: 'center',
    getValue: (wb) => formatDate(wb.sailingDate),
  },
  eta: {
    key: 'eta',
    header: '预计到港日(ETA)',
    width: 16,
    align: 'center',
    getValue: (wb) => formatDate(wb.eta),
  },
  clearanceDate: {
    key: 'clearanceDate',
    header: '清关放行日',
    width: 16,
    align: 'center',
    getValue: (wb) => formatDate(wb.clearanceDate),
  },
  signedDate: {
    key: 'signedDate',
    header: '海外客户签收日',
    width: 16,
    align: 'center',
    getValue: (wb) => formatDate(wb.signedDate),
  },

  // 6. 海外收件人信息
  overseasName: {
    key: 'overseasName',
    header: '海外收件人',
    width: 16,
    align: 'left',
    getValue: (wb) => wb.overseasName || wb.recipientName || '-',
  },
  overseasPhone: {
    key: 'overseasPhone',
    header: '海外联系电话',
    width: 16,
    align: 'center',
    getValue: (wb) => wb.overseasPhone || wb.recipientPhone || '-',
  },
  overseasCompany: {
    key: 'overseasCompany',
    header: '海外收货公司',
    width: 22,
    align: 'left',
    getValue: (wb) => wb.overseasCompany || wb.recipientCompany || '-',
  },
  overseasAddress: {
    key: 'overseasAddress',
    header: '海外收件详细地址',
    width: 32,
    align: 'left',
    getValue: (wb) => wb.overseasAddress || wb.recipientAddress || '-',
  },

  // 7. 财务金额与结算
  receivableAmount: {
    key: 'receivableAmount',
    header: '客户应收总额(¥)',
    width: 16,
    align: 'right',
    numFmt: '¥#,##0.00',
    getValue: (wb) => wb.receivableAmount != null ? Number(wb.receivableAmount) : 0,
  },
  payableAmount: {
    key: 'payableAmount',
    header: '承运应付成本(¥)',
    width: 16,
    align: 'right',
    numFmt: '¥#,##0.00',
    getValue: (wb) => wb.payableAmount != null ? Number(wb.payableAmount) : 0,
  },
  profitAmount: {
    key: 'profitAmount',
    header: '单票毛利(¥)',
    width: 14,
    align: 'right',
    numFmt: '¥#,##0.00',
    getValue: (wb) => wb.profitAmount != null ? Number(wb.profitAmount) : 0,
  },
  isFixedPrice: {
    key: 'isFixedPrice',
    header: '结算协议模式',
    width: 14,
    align: 'center',
    getValue: (wb) => wb.isFixedPrice ? '一口价包干' : '标准量尺计费',
  },
};

export class WaybillExportService {
  /**
   * 执行运单全量/多维导出为 Excel Buffer
   */
  async exportWaybillsToExcel(options: WaybillExportOptions): Promise<{ buffer: Buffer; count: number; filename: string }> {
    let where: any = {};

    if (options.scope === 'selected' && options.ids && options.ids.length > 0) {
      where.id = { in: options.ids };
    } else {
      where = buildWaybillWhere(options);
    }

    // 安全上限检查 (最多 5000 票运单)
    const count = await prisma.waybill.count({ where });
    if (count > 5000) {
      throw new Error(`当前筛选共 ${count} 票运单，超过了单次导出 5,000 条的安全上限。请通过选择日期或起运仓缩小范围后再导出。`);
    }

    if (count === 0) {
      throw new Error('当前筛选条件下没有可导出的运单数据');
    }

    // 确定导出的列
    const columnKeys = options.columns && options.columns.length > 0
      ? options.columns.filter((k) => EXPORT_COLUMN_REGISTRY[k])
      : Object.keys(EXPORT_COLUMN_REGISTRY);

    if (columnKeys.length === 0) {
      throw new Error('请至少选择一列进行导出');
    }

    const selectedColumnDefs = columnKeys.map((k) => EXPORT_COLUMN_REGISTRY[k]);

    // 全量拉取运单及货物明细 (按创建时间倒序)
    const waybills = await prisma.waybill.findMany({
      where,
      include: {
        items: {
          orderBy: { itemIndex: 'asc' },
        },
        containerMaster: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    // 创建 Excel 工作簿
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Global Link Logistics V2';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('运单调度明细列表', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    // 设置列头与列宽
    sheet.columns = selectedColumnDefs.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width || 16,
    }));

    // 表头样式美化 (深蓝背景 #1E293B, 加粗白字, 居中)
    const headerRow = sheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' },
      };
      cell.font = {
        name: '微软雅黑',
        size: 10,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: false,
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FF334155' } },
        right: { style: 'thin', color: { argb: 'FF334155' } },
      };
    });

    // 填充数据行 (货物明细拆行模式：1件/1明细 = 1行)
    let rowIndex = 2;
    for (const wb of waybills) {
      const items = wb.items || [];
      const totalItems = items.length;

      if (totalItems === 0) {
        // 无货物明细时，生成一行
        const rowData: Record<string, any> = {};
        for (const col of selectedColumnDefs) {
          rowData[col.key] = col.getValue(wb, null, 0, 0);
        }
        const row = sheet.addRow(rowData);
        this.styleDataRow(row, selectedColumnDefs, rowIndex % 2 === 0);
        rowIndex++;
      } else {
        // 每一个 item 占一行
        for (let i = 0; i < totalItems; i++) {
          const item = items[i];
          const rowData: Record<string, any> = {};
          for (const col of selectedColumnDefs) {
            rowData[col.key] = col.getValue(wb, item, i, totalItems);
          }
          const row = sheet.addRow(rowData);
          this.styleDataRow(row, selectedColumnDefs, rowIndex % 2 === 0);
          rowIndex++;
        }
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();

    const dateStr = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '');
    const filename = `运单调度明细列表_${dateStr}.xlsx`;

    return {
      buffer: Buffer.from(buffer),
      count: waybills.length,
      filename,
    };
  }

  private styleDataRow(row: ExcelJS.Row, columnDefs: ColumnDefinition[], isEven: boolean) {
    row.height = 22;
    row.eachCell((cell, colIndex) => {
      const def = columnDefs[colIndex - 1];
      if (def) {
        cell.alignment = {
          vertical: 'middle',
          horizontal: def.align || 'left',
          wrapText: false,
        };
        if (def.numFmt && typeof cell.value === 'number') {
          cell.numFmt = def.numFmt;
        } else if (typeof cell.value === 'string') {
          // 纯文本格式保护，杜绝科学计数法
          cell.numFmt = '@';
        }
      }

      cell.font = {
        name: '微软雅黑',
        size: 9.5,
        color: { argb: 'FF1E293B' },
      };

      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      if (isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }
    });
  }
}

export const waybillExportService = new WaybillExportService();
