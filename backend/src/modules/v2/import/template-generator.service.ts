import ExcelJS from 'exceljs';
import { PrismaClient, ChannelCategory } from '@prisma/client';
import { DEFAULT_ORIGIN_WAREHOUSES } from '../origin-warehouse/origin-warehouse.service';
import {
  VALID_DESTINATION_COUNTRIES,
  ALL_VALID_PORTS,
  VALID_CUSTOMS_TYPES,
  VALID_ORIGIN_PORTS,
  VALID_CONTAINER_TYPES,
} from './dictionary-validator.service';

const prisma = new PrismaClient();

export type TemplateType = 'CUSTOMER' | 'SEA_LCL' | 'AIR' | 'SEA_FCL';

interface DictionarySheetData {
  warehouses: Array<{ name: string; code: string; address: string; phone: string }>;
  originPorts: string[];
  containerTypes: string[];
  countries: string[];
  ports: string[];
  seaLclChannels: string[];
  airChannels: string[];
  fclBookingChannels: string[];
  fclCustomsChannels: string[];
  fclClearanceChannels: string[];
  customsTypes: string[];
}

export const OFFICIAL_CUSTOMER_COLUMNS = [
  { header: '客户唛头/编码 (必填)', key: 'clientCode', width: 22 },
  { header: '客户姓名/企业名 (选填)', key: 'name', width: 22 },
  { header: '客户联系电话 (选填)', key: 'phone', width: 18 },
  { header: '电子邮箱 (选填)', key: 'email', width: 22 },
  { header: '常用起运仓 (选填)', key: 'defaultWarehouse', width: 20 },
  { header: '海外收件联系人 (选填)', key: 'consigneeName', width: 20 },
  { header: '海外联系电话/WhatsApp (选填)', key: 'consigneePhone', width: 25 },
  { header: '海外收件公司 (选填)', key: 'consigneeCompany', width: 22 },
  { header: '目的国家 (选填)', key: 'destinationCountry', width: 16 },
  { header: '目的港口/地区 (选填)', key: 'destinationPort', width: 20 },
  { header: '海外详细派送地址 (选填)', key: 'consigneeAddress', width: 30 },
  { header: '是否默认收件人 (是/否)', key: 'isDefault', width: 20 },
  { header: '备注说明 (选填)', key: 'note', width: 25 },
];

export const OFFICIAL_SEA_LCL_COLUMNS = [
  { header: '订单临时分组号 (必填)', key: 'groupKey', width: 22 },
  { header: '客户唛头 (必填)', key: 'userMark', width: 20 },
  { header: '起运仓', key: 'originWarehouse', width: 20 },
  { header: '目的国家', key: 'destinationCountry', width: 16 },
  { header: '承运渠道/服务商 (选填)', key: 'forwarderChannel', width: 22 },
  { header: '报关/通道类型 (选填)', key: 'customsType', width: 20 },
  { header: '海外收件联系人 (选填)', key: 'overseasName', width: 20 },
  { header: '海外联系电话 (WhatsApp)', key: 'overseasPhone', width: 24 },
  { header: '海外收件公司 (选填)', key: 'overseasCompany', width: 20 },
  { header: '海外详细派送地址 (选填)', key: 'overseasAddress', width: 30 },
  { header: '专线单号 (选填)', key: 'expressNo', width: 20 },
  { header: '申报品名 (必填)', key: 'productName', width: 25 },
  { header: '实收件数 (件)', key: 'quantity', width: 14 },
  { header: '实测长 (cm)', key: 'length', width: 14 },
  { header: '实测宽 (cm)', key: 'width', width: 14 },
  { header: '实测高 (cm)', key: 'height', width: 14 },
  { header: '实测单重 (kg)', key: 'unitWeight', width: 14 },
  { header: '实测总重 (kg)', key: 'totalWeight', width: 14 },
  { header: '实测体积 (m³)', key: 'payableVolume', width: 14 },
  { header: '应收单价 (元/方)', key: 'receivableUnitPrice', width: 16 },
  { header: '应付单价 (元/方)', key: 'payableUnitPrice', width: 16 },
  { header: '送仓快递单号', key: 'trackingNumber', width: 20 },
  { header: '备注', key: 'note', width: 25 },
  { header: '叫车截图', key: 'pickupImg', width: 18 },
  { header: '签收截图', key: 'signImg', width: 18 },
];

export const OFFICIAL_AIR_COLUMNS = [
  { header: '订单临时分组号 (必填)', key: 'groupKey', width: 22 },
  { header: '客户唛头 (必填)', key: 'userMark', width: 20 },
  { header: '起运仓', key: 'originWarehouse', width: 20 },
  { header: '目的国家', key: 'destinationCountry', width: 16 },
  { header: '承运渠道/服务商 (选填)', key: 'forwarderChannel', width: 22 },
  { header: '报关/通道类型 (选填)', key: 'customsType', width: 20 },
  { header: '海外收件联系人 (选填)', key: 'overseasName', width: 20 },
  { header: '海外联系电话 (WhatsApp)', key: 'overseasPhone', width: 24 },
  { header: '海外收件公司 (选填)', key: 'overseasCompany', width: 20 },
  { header: '海外详细派送地址 (选填)', key: 'overseasAddress', width: 30 },
  { header: '空运提单号 (AWB)', key: 'airWaybillNo', width: 20 },
  { header: '申报品名 (必填)', key: 'productName', width: 25 },
  { header: '实收件数 (件)', key: 'quantity', width: 14 },
  { header: '实测总重 (kg)', key: 'totalWeight', width: 14 },
  { header: '应收重量单价 (元/kg)', key: 'receivableUnitPrice', width: 20 },
  { header: '应付成本单价 (元/kg)', key: 'payableUnitPrice', width: 20 },
  { header: '内部车费 (元)', key: 'internalTruckingFee', width: 16 },
  { header: '渠道车费 (元)', key: 'channelTruckingFee', width: 16 },
  { header: '送仓快递单号', key: 'trackingNumber', width: 20 },
  { header: '备注', key: 'note', width: 25 },
  { header: '过磅截图', key: 'weightImg', width: 18 },
  { header: '签收截图', key: 'signImg', width: 18 },
];

export const OFFICIAL_SEA_FCL_COLUMNS = [
  { header: '客户唛头 (必填)', key: 'userMark', width: 22 },
  { header: '海外收件联系人', key: 'overseasName', width: 18 },
  { header: '海外联系电话', key: 'overseasPhone', width: 20 },
  { header: '海外详细派送地址', key: 'overseasAddress', width: 30 },
  { header: '集装箱柜号 (必填)', key: 'containerNo', width: 22 },
  { header: '集装箱柜型 (选填)', key: 'containerType', width: 18 },
  { header: '海运提单号 (B/L)', key: 'blNumber', width: 22 },
  { header: '船公司', key: 'carrier', width: 16 },
  { header: '船名/航次', key: 'vesselVoyage', width: 20 },
  { header: '起运港', key: 'originPort', width: 16 },
  { header: '目的港', key: 'destinationPort', width: 18 },
  { header: '申报品名', key: 'productName', width: 25 },
  { header: '整柜包干报价 (元)', key: 'receivableAmount', width: 22 },
  { header: '订舱渠道', key: 'bookingChannel', width: 20 },
  { header: '报关渠道', key: 'customsChannel', width: 20 },
  { header: '清关渠道', key: 'clearanceChannel', width: 22 },
  { header: '拖车费用 (元)', key: 'truckingFee', width: 16 },
  { header: '订舱费/港杂 (元)', key: 'portFee', width: 18 },
  { header: 'THC超支费 (元)', key: 'thcFee', width: 16 },
  { header: '目的港清关费 (元)', key: 'clearanceFee', width: 18 },
  { header: '装柜日期 (YYYY-MM-DD)', key: 'loadingDate', width: 22 },
  { header: '开船时间 (YYYY-MM-DD)', key: 'sailingDate', width: 22 },
  { header: '预计到港 (YYYY-MM-DD)', key: 'eta', width: 22 },
  { header: '备注', key: 'note', width: 25 },
  { header: '报关水单截图', key: 'customsSlipImg', width: 18 },
];

export class TemplateGeneratorService {
  /**
   * 生成指定类型的标准 Excel 模板 Buffer (包含辅助字典 Sheet 和跨表下拉验证)
   */
  async generateTemplate(type: TemplateType): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Global Link Logistics System';
    workbook.lastModifiedBy = 'Global Link Logistics System';
    workbook.created = new Date();
    workbook.modified = new Date();

    // 1. 动态加载最新主数据字典
    const dictData = await this.loadDictionaryData();

    // 2. 先创建【数据录入主页】
    let mainSheet: ExcelJS.Worksheet;
    switch (type) {
      case 'CUSTOMER':
        mainSheet = this.buildCustomerTemplate(workbook);
        break;
      case 'SEA_LCL':
        mainSheet = this.buildSeaLclTemplate(workbook);
        break;
      case 'AIR':
        mainSheet = this.buildAirTemplate(workbook);
        break;
      case 'SEA_FCL':
        mainSheet = this.buildSeaFclTemplate(workbook);
        break;
      default:
        throw new Error(`不支持的模板类型: ${type}`);
    }

    // 3. 创建【系统字典与配置】辅助工作表
    this.buildDictionarySheet(workbook, dictData);

    // 4. 为主录入页绑定跨表数据验证下拉 (Data Validation)
    this.applyDataValidations(mainSheet, type, dictData);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * 获取模板下载文件名
   */
  getTemplateFileName(type: TemplateType): string {
    switch (type) {
      case 'CUSTOMER':
        return '客户档案批量导入模板.xlsx';
      case 'SEA_LCL':
        return '海运散拼订单导入模板.xlsx';
      case 'AIR':
        return '空运专线订单导入模板.xlsx';
      case 'SEA_FCL':
        return '海运整柜订单导入模板.xlsx';
    }
  }

  /**
   * 动态加载主数据 (按业务分类区分渠道)
   */
  private async loadDictionaryData(): Promise<DictionarySheetData> {
    // 仓库
    let dbWarehouses = await prisma.originWarehouse.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { name: true, code: true, address: true, contactPhone: true, contactName: true },
    });

    if (dbWarehouses.length === 0) {
      dbWarehouses = DEFAULT_ORIGIN_WAREHOUSES.map((w) => ({
        name: w.name,
        code: w.code,
        address: w.address,
        contactPhone: w.contactPhone,
        contactName: w.contactName,
      }));
    }

    const warehouses = dbWarehouses.map((w) => ({
      name: w.name,
      code: w.code,
      address: `${w.address} (${w.contactName} · ${w.contactPhone})`,
      phone: w.contactPhone,
    }));

    // 渠道 (按 ChannelCategory 分类检索)
    const dbChannels = await prisma.shippingChannel.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { name: true, category: true },
    });

    const getChannelsByCategory = (cat: ChannelCategory, defaultFallback: string[]) => {
      const filtered = dbChannels.filter((c) => c.category === cat).map((c) => c.name);
      return filtered.length > 0 ? filtered : defaultFallback;
    };

    const seaLclChannels = getChannelsByCategory('SEA_LCL', ['万海自营拼箱专线', '中外运', '天帆东南亚散拼']);
    const airChannels = getChannelsByCategory('AIR', ['菲通货运专线', '万海特快航空']);
    const fclBookingChannels = getChannelsByCategory('FCL_BOOKING', ['优尼科订舱', '泉州万海订舱部', 'COSCO直订']);
    const fclCustomsChannels = getChannelsByCategory('FCL_CUSTOMS', ['中外运报关行', '产地证报关群']);
    const fclClearanceChannels = getChannelsByCategory('FCL_CLEARANCE', ['菲立亚清关公司', '天帆目的港清关']);

    return {
      warehouses,
      originPorts: VALID_ORIGIN_PORTS,
      containerTypes: VALID_CONTAINER_TYPES,
      countries: VALID_DESTINATION_COUNTRIES,
      ports: ALL_VALID_PORTS,
      seaLclChannels,
      airChannels,
      fclBookingChannels,
      fclCustomsChannels,
      fclClearanceChannels,
      customsTypes: VALID_CUSTOMS_TYPES,
    };
  }

  /**
   * 构建【系统字典与配置】工作表 (各渠道与柜型按列独立区分)
   */
  private buildDictionarySheet(workbook: ExcelJS.Workbook, data: DictionarySheetData) {
    const sheet = workbook.addWorksheet('系统字典与配置');

    sheet.columns = [
      { header: '起运仓全称 (下拉源)', key: 'warehouseName', width: 25 },        // A 列
      { header: '起运仓简码', key: 'warehouseCode', width: 14 },               // B 列
      { header: '起运仓详细地址与联系方式 (参考)', key: 'warehouseDetail', width: 45 }, // C 列
      { header: '目的国家 (下拉源)', key: 'country', width: 16 },                 // D 列
      { header: '目的口岸/港口 (下拉源)', key: 'port', width: 22 },               // E 列
      { header: '国内起运港口 (下拉源)', key: 'originPort', width: 22 },           // F 列
      { header: '海运散拼专线渠道 (下拉源)', key: 'seaLclChannel', width: 26 },    // G 列
      { header: '空运专线渠道 (下拉源)', key: 'airChannel', width: 24 },          // H 列
      { header: '整柜订舱服务商 (下拉源)', key: 'fclBooking', width: 24 },         // I 列
      { header: '整柜报关行 (下拉源)', key: 'fclCustoms', width: 22 },             // J 列
      { header: '整柜目的港清关行 (下拉源)', key: 'fclClearance', width: 26 },     // K 列
      { header: '集装箱柜型规格 (下拉源)', key: 'containerType', width: 22 },      // L 列
      { header: '报关/通道类型 (下拉源)', key: 'customsType', width: 20 },         // M 列
      { header: '是否默认 (下拉源)', key: 'isDefault', width: 15 },               // N 列
    ];

    this.styleHeaderRow(sheet.getRow(1));

    // 计算各列的最大行数并填入单元格
    const maxRows = Math.max(
      data.warehouses.length,
      data.originPorts.length,
      data.containerTypes.length,
      data.countries.length,
      data.ports.length,
      data.seaLclChannels.length,
      data.airChannels.length,
      data.fclBookingChannels.length,
      data.fclCustomsChannels.length,
      data.fclClearanceChannels.length,
      data.customsTypes.length,
      2
    );

    const isDefaultOptions = ['是', '否'];

    for (let i = 0; i < maxRows; i++) {
      const wh = data.warehouses[i];
      sheet.addRow({
        warehouseName: wh ? wh.name : '',
        warehouseCode: wh ? wh.code : '',
        warehouseDetail: wh ? wh.address : '',
        country: data.countries[i] || '',
        port: data.ports[i] || '',
        originPort: data.originPorts[i] || '',
        seaLclChannel: data.seaLclChannels[i] || '',
        airChannel: data.airChannels[i] || '',
        fclBooking: data.fclBookingChannels[i] || '',
        fclCustoms: data.fclCustomsChannels[i] || '',
        fclClearance: data.fclClearanceChannels[i] || '',
        containerType: data.containerTypes[i] || '',
        customsType: data.customsTypes[i] || '',
        isDefault: isDefaultOptions[i] || '',
      });
    }

    sheet.getCell('A1').note = '【主数据字典】本工作表按业务分类展示系统标准配置项，供录入页跨表下拉选择及参考。';
  }

  /**
   * 为数据录入页绑定跨表数据验证下拉 (Data Validation) - 各渠道与字段精准绑定对应列
   */
  private applyDataValidations(
    sheet: ExcelJS.Worksheet,
    type: TemplateType,
    dict: DictionarySheetData
  ) {
    const whCount = dict.warehouses.length + 1;
    const originPortCount = dict.originPorts.length + 1;
    const containerTypeCount = dict.containerTypes.length + 1;
    const countryCount = dict.countries.length + 1;
    const portCount = dict.ports.length + 1;
    const seaLclCount = dict.seaLclChannels.length + 1;
    const airCount = dict.airChannels.length + 1;
    const fclBookingCount = dict.fclBookingChannels.length + 1;
    const fclCustomsCount = dict.fclCustomsChannels.length + 1;
    const fclClearanceCount = dict.fclClearanceChannels.length + 1;
    const customsTypeCount = dict.customsTypes.length + 1;

    // 为 2 到 100 行应用数据验证
    for (let r = 2; r <= 100; r++) {
      if (type === 'CUSTOMER') {
        // 客户档案: E 列起运仓, I 列目的国, J 列目的港, L 列是否默认
        sheet.getCell(`E${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`'系统字典与配置'!$A$2:$A$${whCount}`],
        };
        sheet.getCell(`I${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`'系统字典与配置'!$D$2:$D$${countryCount}`],
        };
        sheet.getCell(`J${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`'系统字典与配置'!$E$2:$E$${portCount}`],
        };
        sheet.getCell(`L${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`'系统字典与配置'!$N$2:$N$3`],
        };
      } else if (type === 'SEA_LCL') {
        // 海运散拼: C 列起运仓, D 列目的国, E 列承运渠道(绑定G列散拼), F 列通道类型(绑定M列)
        sheet.getCell(`C${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`'系统字典与配置'!$A$2:$A$${whCount}`],
        };
        sheet.getCell(`D${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`'系统字典与配置'!$D$2:$D$${countryCount}`],
        };
        sheet.getCell(`E${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`'系统字典与配置'!$G$2:$G$${seaLclCount}`],
        };
        sheet.getCell(`F${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`'系统字典与配置'!$M$2:$M$${customsTypeCount}`],
        };
      } else if (type === 'AIR') {
        // 空运专线: C 列起运仓, D 列目的国, E 列承运渠道(绑定H列空运), F 列通道类型(绑定M列)
        sheet.getCell(`C${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`'系统字典与配置'!$A$2:$A$${whCount}`],
        };
        sheet.getCell(`D${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`'系统字典与配置'!$D$2:$D$${countryCount}`],
        };
        sheet.getCell(`E${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`'系统字典与配置'!$H$2:$H$${airCount}`],
        };
        sheet.getCell(`F${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`'系统字典与配置'!$M$2:$M$${customsTypeCount}`],
        };
      } else if (type === 'SEA_FCL') {
        // 整柜: F 列柜型(L列), J 列起运港(F列), K 列目的港(E列), N 列订舱渠道(I列), O 列报关渠道(J列), P 列清关渠道(K列)
        sheet.getCell(`F${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`'系统字典与配置'!$L$2:$L$${containerTypeCount}`],
        };
        sheet.getCell(`J${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`'系统字典与配置'!$F$2:$F$${originPortCount}`],
        };
        sheet.getCell(`K${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`'系统字典与配置'!$E$2:$E$${portCount}`],
        };
        sheet.getCell(`N${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`'系统字典与配置'!$I$2:$I$${fclBookingCount}`],
        };
        sheet.getCell(`O${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`'系统字典与配置'!$J$2:$J$${fclCustomsCount}`],
        };
        sheet.getCell(`P${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`'系统字典与配置'!$K$2:$K$${fclClearanceCount}`],
        };
      }
    }
  }

  // ==============================================================
  // 1. 客户档案导入模板
  // ==============================================================
  private buildCustomerTemplate(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
    const sheet = workbook.addWorksheet('客户档案导入');

    sheet.columns = OFFICIAL_CUSTOMER_COLUMNS;

    this.styleHeaderRow(sheet.getRow(1));

    // 添加示例数据
    sheet.addRow({
      clientCode: 'WH-ZZY-FLB',
      name: '张三 (菲商贸)',
      phone: '13800138000',
      email: 'zhangsan@example.com',
      defaultWarehouse: '广州白云集拼总仓',
      consigneeName: 'Alex Johnson',
      consigneePhone: '+63 917 123 4567',
      consigneeCompany: 'Manila Trading Inc.',
      destinationCountry: '菲律宾',
      destinationPort: '马尼拉南港',
      consigneeAddress: 'Unit 802, BGC Tower, Taguig, Metro Manila',
      isDefault: '是',
      note: '优质老客户，每周五装柜',
    });
    sheet.addRow({
      clientCode: 'WH-ZZY-FLB',
      name: '',
      phone: '',
      email: '',
      defaultWarehouse: '',
      consigneeName: 'Bob Williams',
      consigneePhone: '+63 918 888 9999',
      consigneeCompany: 'Cebu Distribution Hub',
      destinationCountry: '菲律宾',
      destinationPort: '宿务港',
      consigneeAddress: 'Warehouse 3, Reclamation Area, Cebu City',
      isDefault: '否',
      note: '',
    });
    sheet.addRow({
      clientCode: 'WH-10115',
      name: '李四 (日用品)',
      phone: '09171234567',
      email: '',
      defaultWarehouse: '龙岩集散直发中心',
      consigneeName: 'Maria Santos',
      consigneePhone: '+63 915 222 3333',
      consigneeCompany: 'Santos Store',
      destinationCountry: '菲律宾',
      destinationPort: '马尼拉北港',
      consigneeAddress: '1245 Soler St, Binondo, Manila',
      isDefault: '是',
      note: '',
    });

    sheet.getCell('A1').note = '【唯一标识】系统核心客户编码/唛头，必填。一个客户若有多个海外收件人，录入多行填写相同唛头即可。';
    sheet.getCell('E1').note = '【起运仓】自带下拉列表选择。可切换至《系统字典与配置》工作表查看详细仓址。';
    sheet.getCell('L1').note = '填【是】或【否】。若标为【是】，系统将自动提取其目的国和目的港作为客户主路线。';

    return sheet;
  }

  // ==============================================================
  // 2. 海运散拼 (SEA_LCL) 导入模板
  // ==============================================================
  private buildSeaLclTemplate(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
    const sheet = workbook.addWorksheet('海运散拼导入');

    sheet.columns = OFFICIAL_SEA_LCL_COLUMNS;

    this.styleHeaderRow(sheet.getRow(1));

    // 示例数据
    sheet.addRow({
      groupKey: '1',
      userMark: 'WH-ZZY-FLB',
      originWarehouse: '广州白云集拼总仓',
      destinationCountry: '菲律宾',
      forwarderChannel: '万海自营拼箱专线',
      customsType: '化妆退税',
      overseasName: '',
      overseasPhone: '',
      overseasAddress: '',
      expressNo: 'FLY100002162',
      productName: '背心',
      quantity: 1,
      length: 85,
      width: 58,
      height: 48,
      unitWeight: 51,
      totalWeight: 51,
      payableVolume: 0.237,
      receivableUnitPrice: 950,
      payableUnitPrice: 850,
      trackingNumber: '3430',
      note: '带内置电池',
      pickupImg: '',
      signImg: '',
    });

    sheet.addRow({
      groupKey: '1',
      userMark: 'WH-ZZY-FLB',
      originWarehouse: '广州白云集拼总仓',
      destinationCountry: '菲律宾',
      forwarderChannel: '万海自营拼箱专线',
      customsType: '化妆退税',
      overseasName: '',
      overseasPhone: '',
      overseasAddress: '',
      expressNo: 'FLY100002162',
      productName: '长裤',
      quantity: 2,
      length: 80,
      width: 50,
      height: 40,
      unitWeight: 20,
      totalWeight: 40,
      payableVolume: 0.32,
      receivableUnitPrice: 950,
      payableUnitPrice: 850,
      trackingNumber: '3431',
      note: '',
      pickupImg: '',
      signImg: '',
    });

    sheet.getCell('A1').note = '【多明细聚合】相同分组号的多行归入同一票海运单。单票单品可留空。';
    sheet.getCell('B1').note = '【客户唛头】必填，必须已在系统客户档案中建档。';
    sheet.getCell('C1').note = '【起运仓】自带下拉列表选择。可切换至《系统字典与配置》工作表查看详细仓址。';
    sheet.getCell('G1').note = '【海外收件人】若此处留空，系统自动从该客户档案中继承其默认海外收件人；若客户档案未配置默认收件人，则此处必填，否则整单拦截跳过。';

    return sheet;
  }

  // ==============================================================
  // 3. 空运专线 (AIR) 导入模板
  // ==============================================================
  private buildAirTemplate(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
    const sheet = workbook.addWorksheet('空运专线导入');

    sheet.columns = OFFICIAL_AIR_COLUMNS;

    this.styleHeaderRow(sheet.getRow(1));

    // 示例数据
    sheet.addRow({
      groupKey: '1',
      userMark: 'WH-10096',
      originWarehouse: '龙岩集散直发中心',
      destinationCountry: '菲律宾',
      forwarderChannel: '菲通货运专线',
      customsType: '普货双清',
      overseasName: '',
      overseasPhone: '',
      overseasAddress: '',
      airWaybillNo: '91041985',
      productName: '电子配件',
      quantity: 6,
      totalWeight: 1.5,
      receivableUnitPrice: 38.5,
      payableUnitPrice: 35.0,
      internalTruckingFee: 10,
      channelTruckingFee: 8,
      trackingNumber: '3254',
      note: '',
      weightImg: '',
      signImg: '',
    });

    sheet.addRow({
      groupKey: '2',
      userMark: 'WH-10068',
      originWarehouse: '龙岩集散直发中心',
      destinationCountry: '菲律宾',
      forwarderChannel: '菲通货运专线',
      customsType: '普货双清',
      overseasName: 'Maria Santos',
      overseasPhone: '+63 915 222 3333',
      overseasAddress: '1245 Soler St, Binondo, Manila',
      airWaybillNo: '91041999',
      productName: '五金工具',
      quantity: 11,
      totalWeight: 11.0,
      receivableUnitPrice: 38.5,
      payableUnitPrice: 35.0,
      internalTruckingFee: '',
      channelTruckingFee: '',
      trackingNumber: '5931',
      note: '无杂费',
      weightImg: '',
      signImg: '',
    });

    sheet.getCell('A1').note = '【多明细聚合】相同分组号的多行归入同一票空运单。单票单品可留空。';
    sheet.getCell('B1').note = '【客户唛头】必填，必须已在系统客户档案中建档。';
    sheet.getCell('C1').note = '【起运仓】自带下拉列表选择。可切换至《系统字典与配置》工作表查看详细仓址。';
    sheet.getCell('G1').note = '【海外收件人】若此处留空，系统自动从该客户档案中继承其默认海外收件人；若客户档案未配置默认收件人，则此处必填，否则整单拦截跳过。';

    return sheet;
  }

  // ==============================================================
  // 4. 海运整柜 (SEA_FCL) 导入模板
  // ==============================================================
  private buildSeaFclTemplate(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
    const sheet = workbook.addWorksheet('海运整柜导入');

    sheet.columns = OFFICIAL_SEA_FCL_COLUMNS;

    this.styleHeaderRow(sheet.getRow(1));

    // 示例数据
    sheet.addRow({
      userMark: 'WH-77777',
      overseasName: 'Alex Johnson',
      overseasPhone: '+63 917 123 4567',
      overseasAddress: 'Unit 802, BGC Tower, Taguig, Manila',
      containerNo: 'FFAU7478798',
      containerType: '40HQ',
      blNumber: 'SNLGXGPL408017',
      carrier: '万海航运',
      vesselVoyage: 'WAN HAI 312 N082',
      originPort: '天津港',
      destinationPort: '马尼拉北港',
      productName: '围栏及配件',
      receivableAmount: 38000,
      bookingChannel: '优尼科',
      customsChannel: '产地证报关群',
      clearanceChannel: '泉州万海-菲立亚清关公司-渠道5',
      truckingFee: 3200,
      portFee: 2300,
      thcFee: 650,
      clearanceFee: 15000,
      loadingDate: '2026-04-10',
      sailingDate: '2026-04-12',
      eta: '2026-04-28',
      note: '需要出产地证Form E',
      customsSlipImg: '',
    });

    sheet.getCell('A1').note = '【客户唛头】必填，整柜货主。';
    sheet.getCell('B1').note = '【海外收件人】若此处留空，系统自动从该客户档案中继承其默认海外收件人；若客户档案未配置默认收件人，则此处必填，否则整单拦截跳过。';
    sheet.getCell('E1').note = '【集装箱柜号】必填，如 FFAU7478798。';

    return sheet;
  }

  /**
   * 格式化表头行样式
   */
  private styleHeaderRow(row: ExcelJS.Row) {
    row.height = 28;
    row.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6F0FA' }, // 浅蓝高级底色
      };
      cell.font = {
        name: 'Microsoft YaHei',
        size: 11,
        bold: true,
        color: { argb: 'FF1E293B' },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });
  }
}
