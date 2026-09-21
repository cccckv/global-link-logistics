import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import { waybillExportService } from '../src/modules/v2/waybill/waybill-export.service';

const prisma = new PrismaClient();

interface TestReport {
  name: string;
  passed: boolean;
  details: string;
}

const reports: TestReport[] = [];

function assert(condition: boolean, testName: string, detail: string) {
  if (!condition) {
    reports.push({ name: testName, passed: false, details: `❌ 失败: ${detail}` });
    throw new Error(`[${testName}] 断言失败: ${detail}`);
  } else {
    reports.push({ name: testName, passed: true, details: detail });
  }
}

async function runAccuracyVerification() {
  console.log('====================================================');
  console.log('🚀 开始执行运单全景调度导出功能【数据准确性深度测试】');
  console.log('====================================================\n');

  // ---------------------------------------------------------------
  // 测试 1: 单票多件货物明细拆行与数据库基准逐字段精确比对
  // ---------------------------------------------------------------
  console.log('🔍 [测试 1] 验证货物明细拆行模式与数据库字段精确一致性...');
  
  // 找出包含 items 的海运拼箱或多件运单
  const dbWaybills = await prisma.waybill.findMany({
    where: {
      items: { some: {} },
    },
    include: {
      items: { orderBy: { itemIndex: 'asc' } },
      containerMaster: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const testIds = dbWaybills.map((w) => w.id);
  const totalExpectedRows = dbWaybills.reduce((sum, w) => sum + Math.max(1, w.items.length), 0);

  const exportColumns = [
    'waybillNo',
    'expressNo',
    'userMark',
    'orderType',
    'status',
    'productName',
    'itemIndex',
    'quantity',
    'dimensions',
    'payableVolume',
    'receivableVolume',
    'unitWeight',
    'totalWeight',
    'containerNo',
    'receivableAmount',
  ];

  const exportRes = await waybillExportService.exportWaybillsToExcel({
    scope: 'selected',
    ids: testIds,
    columns: exportColumns,
  });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(exportRes.buffer);
  const sheet = wb.getWorksheet('运单调度明细列表');

  assert(sheet !== undefined, '工作表存在性', '成功找到工作表 "运单调度明细列表"');
  if (!sheet) return;

  // 表头比对
  const headerValues = (sheet.getRow(1).values as string[]).slice(1);
  assert(
    headerValues.length === exportColumns.length,
    '表头列数准确性',
    `期望表头列数 ${exportColumns.length}，实际 ${headerValues.length}`
  );

  // 数据行数比对 (含首行表头，所以 rowCount 应为 totalExpectedRows + 1)
  const actualDataRowCount = sheet.rowCount - 1;
  assert(
    actualDataRowCount === totalExpectedRows,
    '拆行总行数准确性',
    `DB中这 ${testIds.length} 票运单共有 ${totalExpectedRows} 个明细，Excel实际生成 ${actualDataRowCount} 行`
  );

  // 逐行逐单元格严格对照数据库字段
  let currentExcelRow = 2;
  for (const dbWb of dbWaybills) {
    const items = dbWb.items.length > 0 ? dbWb.items : [null];
    for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
      const item = items[itemIdx];
      const row = sheet.getRow(currentExcelRow);

      // 1. 系统运单号比对
      const actualWaybillNo = row.getCell(1).value;
      assert(
        actualWaybillNo === dbWb.waybillNo,
        `行${currentExcelRow} 单号准确性`,
        `期望 ${dbWb.waybillNo}, 实际 ${actualWaybillNo}`
      );

      // 2. 客户唛头比对
      const actualUserMark = row.getCell(3).value;
      assert(
        actualUserMark === dbWb.userMark,
        `行${currentExcelRow} 唛头准确性`,
        `期望 ${dbWb.userMark}, 实际 ${actualUserMark}`
      );

      // 3. 中文品名比对
      const actualProductName = row.getCell(6).value;
      const expectedProductName = item?.productName || '商品';
      assert(
        actualProductName === expectedProductName,
        `行${currentExcelRow} 品名准确性`,
        `期望品名 "${expectedProductName}", 实际 "${actualProductName}"`
      );

      // 4. 实收件数比对 (数值类型验证)
      const actualQty = row.getCell(8).value;
      const expectedQty = item?.quantity ?? 1;
      assert(
        actualQty === expectedQty,
        `行${currentExcelRow} 件数数值准确性`,
        `期望件数 ${expectedQty}, 实际 ${actualQty}`
      );

      // 5. 尺寸长宽高字符串格式化比对
      const actualDim = row.getCell(9).value;
      const expectedDim = item && (item.length != null || item.width != null || item.height != null)
        ? `${item.length ?? '-'}×${item.width ?? '-'}×${item.height ?? '-'}`
        : '-';
      assert(
        actualDim === expectedDim,
        `行${currentExcelRow} 尺寸拼接准确性`,
        `期望尺寸 "${expectedDim}", 实际 "${actualDim}"`
      );

      // 6. 应收总额数值比对
      const actualAmount = row.getCell(15).value;
      const expectedAmount = dbWb.receivableAmount != null ? Number(dbWb.receivableAmount) : 0;
      assert(
        actualAmount === expectedAmount,
        `行${currentExcelRow} 应收金额准确性`,
        `期望金额 ${expectedAmount}, 实际 ${actualAmount}`
      );

      currentExcelRow++;
    }
  }
  console.log(`✅ [测试 1 通过] 成功比对 ${totalExpectedRows} 行明细，所有单号、品名、尺寸、件数、金额与数据库完全一致！\n`);

  // ---------------------------------------------------------------
  // 测试 2: 选中导出范围严格隔离性测试
  // ---------------------------------------------------------------
  console.log('🔍 [测试 2] 验证选中导出 (Selected Scope) 数据隔离性...');
  
  // 任选 2 票独立的运单
  const twoWaybills = await prisma.waybill.findMany({
    take: 2,
    orderBy: { waybillNo: 'asc' },
    select: { id: true, waybillNo: true },
  });
  const selectedIdSet = new Set(twoWaybills.map((w) => w.id));
  const selectedNoSet = new Set(twoWaybills.map((w) => w.waybillNo));

  const selectedExport = await waybillExportService.exportWaybillsToExcel({
    scope: 'selected',
    ids: Array.from(selectedIdSet),
    columns: ['waybillNo', 'userMark', 'productName'],
  });

  const selectedWb = new ExcelJS.Workbook();
  await selectedWb.xlsx.load(selectedExport.buffer);
  const selectedSheet = selectedWb.getWorksheet('运单调度明细列表')!;

  for (let r = 2; r <= selectedSheet.rowCount; r++) {
    const wbNo = selectedSheet.getRow(r).getCell(1).value as string;
    assert(
      selectedNoSet.has(wbNo),
      '选中导出未被外界污染',
      `导出的单号 ${wbNo} 属于用户勾选的集合 (${Array.from(selectedNoSet).join(', ')})`
    );
  }
  console.log(`✅ [测试 2 通过] 勾选的 2 票运单完全隔离，未夹带任何未选中的运单！\n`);

  // ---------------------------------------------------------------
  // 测试 3: 多维业务条件筛选准确性测试 (如待排柜散货)
  // ---------------------------------------------------------------
  console.log('🔍 [测试 3] 验证业务筛选导出 (SEA_LCL + 待排柜 unassignedOnly)...');

  const unassignedExport = await waybillExportService.exportWaybillsToExcel({
    scope: 'filtered',
    orderType: 'SEA_LCL',
    unassignedOnly: true,
    columns: ['waybillNo', 'orderType', 'status', 'containerNo'],
  });

  const unassignedWb = new ExcelJS.Workbook();
  await unassignedWb.xlsx.load(unassignedExport.buffer);
  const unassignedSheet = unassignedWb.getWorksheet('运单调度明细列表')!;

  // 数据库预期查询
  const dbUnassignedCount = await prisma.waybill.count({
    where: {
      orderType: 'SEA_LCL',
      status: 'INBOUND',
      containerId: null,
    },
  });

  assert(
    unassignedExport.count === dbUnassignedCount,
    '待排柜筛选单据总数准确性',
    `DB中待排柜散拼共 ${dbUnassignedCount} 票，导出统计完全一致为 ${unassignedExport.count} 票`
  );

  for (let r = 2; r <= unassignedSheet.rowCount; r++) {
    const row = unassignedSheet.getRow(r);
    const orderType = row.getCell(2).value;
    const status = row.getCell(3).value;
    const container = row.getCell(4).value;

    assert(orderType === '海运拼柜 (LCL)', `行${r} 运输方式`, '必须为海运拼柜 (LCL)');
    assert(status === '已入库/已核量', `行${r} 运单状态`, '必须为已入库/已核量 (INBOUND)');
    assert(container === '待排柜', `行${r} 柜号`, '集装箱柜号必须为待排柜');
  }
  console.log(`✅ [测试 3 通过] 待排柜散拼导出的每一行状态均为已入库且柜号为待排柜！\n`);

  // ---------------------------------------------------------------
  // 测试 4: 单元格数据类型与防科学计数法保护测试
  // ---------------------------------------------------------------
  console.log('🔍 [测试 4] 验证单元格数据类型 (数值型可计算 vs 文本型防科学计数法)...');

  const typeExport = await waybillExportService.exportWaybillsToExcel({
    scope: 'filtered',
    columns: [
      'waybillNo',
      'trackingNumber',
      'quantity',
      'payableVolume',
      'receivableVolume',
      'totalWeight',
      'receivableAmount',
    ],
  });

  const typeWb = new ExcelJS.Workbook();
  await typeWb.xlsx.load(typeExport.buffer);
  const typeSheet = typeWb.getWorksheet('运单调度明细列表')!;

  const sampleRow = typeSheet.getRow(2);

  // 运单号：必须是 string，防截断
  const waybillNoCell = sampleRow.getCell(1);
  assert(
    typeof waybillNoCell.value === 'string',
    '单号必须为纯文本字符串',
    `类型为 ${typeof waybillNoCell.value} (格式: ${waybillNoCell.numFmt})`
  );

  // 件数：必须是 number
  const qtyCell = sampleRow.getCell(3);
  assert(
    typeof qtyCell.value === 'number',
    '件数必须为数值类型',
    `类型为 ${typeof qtyCell.value}，值: ${qtyCell.value}`
  );

  // 方量：必须是 number
  const volCell = sampleRow.getCell(4);
  assert(
    typeof volCell.value === 'number',
    '方量必须为数值类型',
    `类型为 ${typeof volCell.value}，值: ${volCell.value}`
  );

  // 应收金额：必须是 number
  const amtCell = sampleRow.getCell(7);
  assert(
    typeof amtCell.value === 'number',
    '应收金额必须为数值类型',
    `类型为 ${typeof amtCell.value}，值: ${amtCell.value}`
  );

  console.log('✅ [测试 4 通过] 单号与单据文本严格防科学计数法，件数/方量/金额均为纯数值支持 Excel 自动求和！\n');

  // ---------------------------------------------------------------
  // 测试 5: 字段自定义投影测试 (指定任意 N 列)
  // ---------------------------------------------------------------
  console.log('🔍 [测试 5] 验证自定义勾选列子集投影...');

  const customCols = ['userMark', 'destinationPort', 'totalWeight'];
  const customExport = await waybillExportService.exportWaybillsToExcel({
    scope: 'filtered',
    columns: customCols,
  });

  const customWb = new ExcelJS.Workbook();
  await customWb.xlsx.load(customExport.buffer);
  const customSheet = customWb.getWorksheet('运单调度明细列表')!;

  const actualCustomHeaders = (customSheet.getRow(1).values as string[]).slice(1);
  const expectedCustomHeaders = ['客户唛头', '清关目的港/机场', '实测总重(kg)'];

  assert(
    JSON.stringify(actualCustomHeaders) === JSON.stringify(expectedCustomHeaders),
    '自定义列标题匹配',
    `期望表头: ${JSON.stringify(expectedCustomHeaders)}, 实际: ${JSON.stringify(actualCustomHeaders)}`
  );
  console.log('✅ [测试 5 通过] 自定义列按用户选择精准输出，不多不少、顺序完全吻合！\n');

  console.log('====================================================');
  console.log(`🎉 深度数据准确性测试全部通过！共通过断言: ${reports.filter((r) => r.passed).length} 个`);
  console.log('====================================================');
}

runAccuracyVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ 测试运行失败:', err);
    process.exit(1);
  });
