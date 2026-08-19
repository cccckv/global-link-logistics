import ExcelJS from 'exceljs';

export type TemplateType = 'CUSTOMER' | 'SEA_LCL' | 'AIR' | 'SEA_FCL';

export class TemplateGeneratorService {
  /**
   * 生成指定类型的标准 Excel 模板 Buffer
   */
  async generateTemplate(type: TemplateType): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Global Link Logistics System';
    workbook.lastModifiedBy = 'Global Link Logistics System';
    workbook.created = new Date();
    workbook.modified = new Date();

    switch (type) {
      case 'CUSTOMER':
        this.buildCustomerTemplate(workbook);
        break;
      case 'SEA_LCL':
        this.buildSeaLclTemplate(workbook);
        break;
      case 'AIR':
        this.buildAirTemplate(workbook);
        break;
      case 'SEA_FCL':
        this.buildSeaFclTemplate(workbook);
        break;
      default:
        throw new Error(`不支持的模板类型: ${type}`);
    }

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

  // ==============================================================
  // 1. 客户档案导入模板
  // ==============================================================
  private buildCustomerTemplate(workbook: ExcelJS.Workbook) {
    const sheet = workbook.addWorksheet('客户档案导入');

    sheet.columns = [
      { header: '客户唛头/编码 (必填)', key: 'clientCode', width: 25 },
      { header: '客户姓名/企业名 (选填)', key: 'name', width: 25 },
      { header: '联系电话 (选填)', key: 'phone', width: 18 },
      { header: '电子邮箱 (选填)', key: 'email', width: 22 },
      { header: '常用起运仓 (选填)', key: 'defaultWarehouse', width: 18 },
      { header: '常用目的国 (选填)', key: 'destinationCountry', width: 18 },
      { header: '常用目的港 (选填)', key: 'destinationPort', width: 18 },
      { header: '备注 (选填)', key: 'note', width: 30 },
    ];

    this.styleHeaderRow(sheet.getRow(1));

    // 添加示例数据
    sheet.addRow({
      clientCode: 'WH-ZZY-FLB',
      name: '张三 (菲商贸)',
      phone: '13800138000',
      email: 'zhangsan@example.com',
      defaultWarehouse: '广州仓',
      destinationCountry: '菲律宾',
      destinationPort: '马尼拉南港',
      note: '优质老客户，每周五装柜',
    });
    sheet.addRow({
      clientCode: 'WH-10115',
      name: '李四 (日用品)',
      phone: '09171234567',
      email: '',
      defaultWarehouse: '龙岩仓',
      destinationCountry: '菲律宾',
      destinationPort: '马尼拉北港',
      note: '',
    });
    sheet.addRow({
      clientCode: 'WH-五金',
      name: '',
      phone: '',
      email: '',
      defaultWarehouse: '广州仓',
      destinationCountry: '印尼',
      destinationPort: '',
      note: '客户名留空将默认同唛头',
    });

    // 添加提示批注
    sheet.getCell('A1').note = '【唯一标识】系统核心客户编码/唛头，必填且全局唯一。';
    sheet.getCell('B1').note = '选填。若留空，系统将自动填充为与客户唛头一致。';
  }

  // ==============================================================
  // 2. 海运散拼 (SEA_LCL) 导入模板
  // ==============================================================
  private buildSeaLclTemplate(workbook: ExcelJS.Workbook) {
    const sheet = workbook.addWorksheet('海运散拼导入');

    sheet.columns = [
      { header: '订单临时分组号', key: 'groupKey', width: 16 },
      { header: '客户唛头 (必填)', key: 'userMark', width: 22 },
      { header: '起运仓', key: 'originWarehouse', width: 15 },
      { header: '目的国', key: 'destinationCountry', width: 15 },
      { header: '承运渠道/服务商', key: 'forwarderChannel', width: 18 },
      { header: '报关/通道类型', key: 'customsType', width: 18 },
      { header: '专线单号', key: 'expressNo', width: 20 },
      { header: '申报品名 (必填)', key: 'productName', width: 25 },
      { header: '实收件数 (必填)', key: 'quantity', width: 15 },
      { header: '实测长 (cm)', key: 'length', width: 14 },
      { header: '实测宽 (cm)', key: 'width', width: 14 },
      { header: '实测高 (cm)', key: 'height', width: 14 },
      { header: '实测单重 (kg)', key: 'unitWeight', width: 15 },
      { header: '实测体积 (m³)', key: 'payableVolume', width: 15 },
      { header: '应收单价 (元/方)', key: 'receivableUnitPrice', width: 18 },
      { header: '应付单价 (元/方)', key: 'payableUnitPrice', width: 18 },
      { header: '送仓快递单号', key: 'trackingNumber', width: 20 },
      { header: '备注', key: 'note', width: 25 },
      { header: '叫车截图', key: 'pickupImg', width: 18 },
      { header: '签收截图', key: 'signImg', width: 18 },
    ];

    this.styleHeaderRow(sheet.getRow(1));

    // 示例数据：展示单票单品与单票多品
    sheet.addRow({
      groupKey: '1',
      userMark: 'WH-ZZY-FLB',
      originWarehouse: '广州仓',
      destinationCountry: '菲律宾',
      forwarderChannel: '中外运',
      customsType: '化妆退税',
      expressNo: 'FLY100002162',
      productName: '背心',
      quantity: 1,
      length: 85,
      width: 74,
      height: 36,
      unitWeight: 20,
      payableVolume: 0.23,
      receivableUnitPrice: 850,
      payableUnitPrice: 750,
      trackingNumber: 'SF123456789',
      note: '',
      pickupImg: '[可直接在此格粘贴图片]',
      signImg: '',
    });

    sheet.addRow({
      groupKey: '2',
      userMark: 'WH-10118',
      originWarehouse: '广州仓',
      destinationCountry: '菲律宾',
      forwarderChannel: '万海自营专线',
      customsType: '普货双清',
      expressNo: 'FLY100002256',
      productName: '吸油纸 (小规格)',
      quantity: 2,
      length: 55,
      width: 30,
      height: 25,
      unitWeight: 5,
      payableVolume: 0.08,
      receivableUnitPrice: 730,
      payableUnitPrice: 650,
      trackingNumber: '760209119421',
      note: '',
      pickupImg: '',
      signImg: '',
    });

    sheet.addRow({
      groupKey: '2',
      userMark: '',
      originWarehouse: '',
      destinationCountry: '',
      forwarderChannel: '',
      customsType: '',
      expressNo: '',
      productName: '吸油纸 (大规格)',
      quantity: 6,
      length: 42,
      width: 42,
      height: 25,
      unitWeight: 8,
      payableVolume: 0.26,
      receivableUnitPrice: 730,
      payableUnitPrice: 650,
      trackingNumber: '',
      note: '',
      pickupImg: '',
      signImg: '',
    });

    // 批注说明
    sheet.getCell('A1').note = '【多明细聚合】相同分组号的多行将合并为同一张运单（如上面的两行吸油纸）。单票单品可留空。手输分组号纯作为内存解析，不入库。';
    sheet.getCell('B1').note = '【客户唛头】必填，必须已在系统客户档案中建档。';
    sheet.getCell('L1').note = '选填。若填写了长宽高，系统将自动精确算方；也可直接填录体积。';
  }

  // ==============================================================
  // 3. 空运专线 (AIR) 导入模板
  // ==============================================================
  private buildAirTemplate(workbook: ExcelJS.Workbook) {
    const sheet = workbook.addWorksheet('空运专线导入');

    sheet.columns = [
      { header: '订单临时分组号', key: 'groupKey', width: 16 },
      { header: '客户唛头 (必填)', key: 'userMark', width: 22 },
      { header: '起运仓', key: 'originWarehouse', width: 15 },
      { header: '目的国', key: 'destinationCountry', width: 15 },
      { header: '承运渠道/服务商', key: 'forwarderChannel', width: 18 },
      { header: '报关/通道类型', key: 'customsType', width: 18 },
      { header: '空运提单号 (AWB)', key: 'airWaybillNo', width: 20 },
      { header: '申报品名 (必填)', key: 'productName', width: 25 },
      { header: '实收件数 (必填)', key: 'quantity', width: 15 },
      { header: '计费重量 (kg) (必填)', key: 'totalWeight', width: 20 },
      { header: '应收重量单价 (元/kg)', key: 'receivableUnitPrice', width: 22 },
      { header: '应付成本单价 (元/kg)', key: 'payableUnitPrice', width: 22 },
      { header: '内部车费 (元)', key: 'internalTruckingFee', width: 16 },
      { header: '渠道车费 (元)', key: 'channelTruckingFee', width: 16 },
      { header: '送仓快递单号', key: 'trackingNumber', width: 20 },
      { header: '备注', key: 'note', width: 25 },
      { header: '过磅截图', key: 'weightImg', width: 18 },
      { header: '签收截图', key: 'signImg', width: 18 },
    ];

    this.styleHeaderRow(sheet.getRow(1));

    // 示例数据
    sheet.addRow({
      groupKey: '1',
      userMark: 'WH-10096',
      originWarehouse: '龙岩仓',
      destinationCountry: '菲律宾',
      forwarderChannel: '菲通货运',
      customsType: '普货双清',
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
      originWarehouse: '龙岩仓',
      destinationCountry: '菲律宾',
      forwarderChannel: '菲通货运',
      customsType: '普货双清',
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
    sheet.getCell('I1').note = '【计费重量】空运按实际或计费公斤数核算金额。';
  }

  // ==============================================================
  // 4. 海运整柜 (SEA_FCL) 导入模板
  // ==============================================================
  private buildSeaFclTemplate(workbook: ExcelJS.Workbook) {
    const sheet = workbook.addWorksheet('海运整柜导入');

    sheet.columns = [
      { header: '客户唛头 (必填)', key: 'userMark', width: 22 },
      { header: '集装箱柜号 (必填)', key: 'containerNo', width: 22 },
      { header: '海运提单号 (B/L)', key: 'blNumber', width: 22 },
      { header: '船公司', key: 'carrier', width: 16 },
      { header: '船名/航次', key: 'vesselVoyage', width: 20 },
      { header: '起运港', key: 'originPort', width: 16 },
      { header: '目的港', key: 'destinationPort', width: 16 },
      { header: '申报品名', key: 'productName', width: 25 },
      { header: '整柜包干报价 (元)', key: 'receivableAmount', width: 20 },
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

    this.styleHeaderRow(sheet.getRow(1));

    // 示例数据
    sheet.addRow({
      userMark: 'WH-77777',
      containerNo: 'FFAU7478798',
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
    sheet.getCell('B1').note = '【集装箱柜号】必填，如 FFAU7478798。';
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
