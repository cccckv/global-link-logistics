import { calculateWaybillFinancials } from '../src/modules/v2/waybill/waybill.service';
import { exchangeRateService } from '../src/modules/v2/finance/exchange-rate.service';
import { TemplateGeneratorService } from '../src/modules/v2/import/template-generator.service';
import ExcelJS from 'exceljs';

async function runVerification() {
  console.log('=== [1/4] 测试当日外汇服务 (ExchangeRateService) ===');
  const rates = await exchangeRateService.getTodayRates();
  console.log('今日汇率结果:', rates);
  if (!rates.usdRate || rates.usdRate <= 0 || !rates.phpRate || rates.phpRate <= 0) {
    throw new Error('汇率服务返回异常值！');
  }
  console.log('✓ 今日汇率服务测试通过！\n');

  console.log('=== [2/4] 测试散拼多币种与单票汇率折算 (SEA_LCL) ===');
  // 订单自定义汇率：USD=7.25, PHP=8.10
  const lclRes = calculateWaybillFinancials({
    orderType: 'SEA_LCL',
    usdRate: 7.25,
    phpRate: 8.10,
    items: [
      {
        quantity: 1,
        length: 200,
        width: 100,
        height: 100, // 2.0 CBM
        receivableCurrency: 'PHP',
        receivableUnitPrice: 6500, // 6500 PHP/CBM -> 折合 6500 / 8.10 = 802.47 CNY/CBM
        payableCurrency: 'CNY',
        payableUnitPrice: 500,     // 500 CNY/CBM
      }
    ]
  });
  console.log('散拼计算结果:', lclRes);
  // 应收: 2 * (6500 / 8.10) = 1604.94
  // 应付: 2 * 500 = 1000.00
  // 毛利: 604.94
  if (Math.abs(lclRes.receivableAmount - 1604.94) > 0.1 || Math.abs(lclRes.payableAmount - 1000.00) > 0.1) {
    throw new Error(`散拼计算精度不符合预期: ${JSON.stringify(lclRes)}`);
  }
  console.log('✓ 散拼贵币折算与单票汇率验证通过！\n');

  console.log('=== [3/4] 测试空运专线与多币种杂费折算 (AIR) ===');
  const airRes = calculateWaybillFinancials({
    orderType: 'AIR',
    usdRate: 7.20,
    phpRate: 8.00,
    items: [
      {
        quantity: 2,
        unitWeight: 5.0, // total 10 kg
        receivableCurrency: 'USD',
        receivableUnitPrice: 6.50, // 6.50 USD/kg -> 6.50 * 7.20 = 46.80 CNY/kg -> total 468.00 CNY
        payableCurrency: 'CNY',
        payableUnitPrice: 35.0,    // 35.0 CNY/kg -> total 350.00 CNY
      }
    ],
    fees: [
      {
        feeDirection: 'PAYABLE',
        amount: 800,
        currency: 'PHP', // 800 PHP -> 800 / 8.00 = 100.00 CNY
      }
    ]
  });
  console.log('空运计算结果:', airRes);
  // 应收: 468.00, 应付: 350 + 100 = 450.00, 毛利: 18.00
  if (Math.abs(airRes.receivableAmount - 468.00) > 0.05 || Math.abs(airRes.payableAmount - 450.00) > 0.05 || Math.abs(airRes.profitAmount - 18.00) > 0.05) {
    throw new Error(`空运计算不符合预期: ${JSON.stringify(airRes)}`);
  }
  console.log('✓ 空运多币种杂费折算验证通过！\n');

  console.log('=== [4/4] 测试模板生成与列定义 (Template Columns) ===');
  const generator = new TemplateGeneratorService();
  const lclBuf = await generator.generateTemplate('SEA_LCL');
  const airBuf = await generator.generateTemplate('AIR');
  const fclBuf = await generator.generateTemplate('SEA_FCL');

  const checkWorkbookHeaders = async (buf: Buffer, name: string) => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    const ws = wb.worksheets[0];
    const headers: string[] = [];
    ws.getRow(1).eachCell((cell) => {
      headers.push(String(cell.value || '').trim());
    });
    console.log(`[${name}] 表头总列数: ${headers.length}`);
    const hasUsdRate = headers.some(h => h.includes('单票美金汇率'));
    const hasPhpRate = headers.some(h => h.includes('单票比索汇率'));
    const hasOldRecvRate = headers.some(h => h === '应收汇率 (选填)');
    if (!hasUsdRate || !hasPhpRate) {
      throw new Error(`[${name}] 缺失单票汇率列！`);
    }
    if (hasOldRecvRate) {
      throw new Error(`[${name}] 仍包含已废止的独立应收汇率列！`);
    }
    console.log(`[${name}] ✓ 汇率列与精简验证无误`);
  };

  await checkWorkbookHeaders(lclBuf, '海运散拼模板');
  await checkWorkbookHeaders(airBuf, '空运专线模板');
  await checkWorkbookHeaders(fclBuf, '海运整柜模板');

  console.log('\n=== [5/5] 测试实付杂费独立汇率覆盖与快照保护 (Fee Snapshot Locking) ===');
  // 场景：订单基准汇率为 USD=7.25, PHP=8.00
  // 但两周后支付的超期柜租 PHP 汇率为 8.35 (实付贬值)，海运订舱 USD 汇率为 7.15
  const feeTestRes = calculateWaybillFinancials({
    orderType: 'SEA_FCL',
    isFixedPrice: true,
    fixedPriceAmount: 3000, // 3000 USD 一口价 -> 3000 * 7.25 = 21750 CNY
    settlementCurrency: 'USD',
    usdRate: 7.25,
    phpRate: 8.00,
    fees: [
      {
        feeDirection: 'PAYABLE',
        amount: 500,
        currency: 'USD',
        exchangeRate: 7.15,
        amountInCny: 500 * 7.15, // 3575.00 (实付款汇率快照锁定)
      },
      {
        feeDirection: 'PAYABLE',
        amount: 8350,
        currency: 'PHP',
        exchangeRate: 8.35,
        amountInCny: 8350 / 8.35, // 1000.00 (实付款汇率快照锁定)
      }
    ]
  });

  console.log('杂费覆盖计算结果:', feeTestRes);
  // 应收: 21750.00
  // 应付成本: 3575.00 + 1000.00 = 4575.00
  // 毛利: 21750.00 - 4575.00 = 17175.00
  if (
    Math.abs(feeTestRes.receivableAmount - 21750.00) > 0.05 ||
    Math.abs(feeTestRes.payableAmount - 4575.00) > 0.05 ||
    Math.abs(feeTestRes.profitAmount - 17175.00) > 0.05
  ) {
    throw new Error(`实付杂费汇率覆盖核算不符合预期: ${JSON.stringify(feeTestRes)}`);
  }
  console.log('✓ 实付杂费独立汇率覆盖与快照保护验证通过！');

  console.log('\n========================================');
  console.log('🎉 所有汇率核算、杂费生命周期与模板自检项目 100% 全部通过！');
  console.log('========================================\n');
}

runVerification().catch((err) => {
  console.error('❌ 自检失败:', err);
  process.exit(1);
});
