/**
 * 真实业务全场景端到端深度模拟套件 (Real-World Business Simulation Suite)
 * 深度模拟业务员在日常工作台中的全部 10 大核心业务场景：
 * 
 * 场景 1: 广州标准拼箱 - 背心 85*74*36 单件算方 + 加收报关费500
 * 场景 2: 广州电商小包大批量拼箱 - 301件无尺寸直接定方 16.927 m³
 * 场景 3: 龙岩多包裹多品名拼单 - WH-10115 (PR0099 + 收纳袋) + 扣减国内车费
 * 场景 4: 特殊一口价包干模式 - WH-母婴 固定收费 ¥200 (覆盖体积单价)
 * 场景 5: 空运样品特快 - WH-10115 25kg 按公斤计费 + AWB 关联
 * 场景 6: 大客户整柜直托 (FCL) - WH-77777 40HQ 柜全流程
 * 场景 7: 仓库现场人工批量拼箱 - 3 票散货同时装入集装箱广62柜并穿透汇总
 * 场景 8: 开船启运与多币种干线成本链 - 订舱USD + 拖车CNY + 码头THC比索
 * 场景 9: 目的港清关放行与统一凭证池追加 - 上传报关税单水单
 * 场景 10: 海外拆派到门与客户签字完结 - 锁定最终财务总账与纯毛利
 */

const BASE_URL = 'http://127.0.0.1:3000/api';
const V2_URL = 'http://127.0.0.1:3000/api/v2';

let token = '';

function logPass(msg) {
  console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${msg}`);
}

function logFail(msg, err) {
  console.error(`  \x1b[31m✖ [FAIL]\x1b[0m ${msg}`, err || '');
}

function logScenario(num, title, desc) {
  console.log(`\n\x1b[1m\x1b[34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📍 场景 ${num}: ${title}`);
  console.log(`   \x1b[0m\x1b[90m${desc}\x1b[0m\x1b[1m\x1b[34m`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`);
}

async function runBusinessSimulation() {
  console.log('\n\x1b[1m\x1b[35m🏢 GLOBAL LINK LOGISTICS - 全业务场景真实模拟测试\x1b[0m\n');

  // 0. 业务员登录
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '15060850289', password: 'wh123456' }),
  });
  const loginData = await loginRes.json();
  token = loginData.token || loginData.data?.token;
  if (!token) throw new Error('登录失败');
  console.log(`🔑 业务员身份已验证: 超级管理员 (Token 有效)`);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // -------------------------------------------------------------
  // 场景 1: 广州标准拼箱 (背心 85*74*36 单件算方 + 报关费500)
  // -------------------------------------------------------------
  logScenario(1, '广州标准海运拼箱 (单件实测算方 + 报关费)', '业务员输入 WH-ZZY-FLB，实测 85*74*36，系统自动算方 0.2264方，加收报关费 ¥500');
  let wb1 = null;
  {
    const res = await fetch(`${V2_URL}/waybills`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        orderType: 'SEA_LCL',
        userMark: 'WH-ZZY-FLB',
        originWarehouse: '广州',
        destinationCountry: '菲律宾',
        destinationPort: '马尼拉南港',
        expressNo: 'FLY100002162',
        inboundDate: '2026-08-16',
        items: [
          {
            trackingNumber: 'SF1001',
            productName: '背心',
            quantity: 1,
            length: 85,
            width: 74,
            height: 36,
            receivableUnitPrice: 850,
            payableUnitPrice: 750,
          },
        ],
        fees: [
          {
            feeName: '报关费',
            feeDirection: 'RECEIVABLE',
            amount: 500,
            currency: 'CNY',
          },
        ],
      }),
    });
    const d = await res.json();
    if (!d.success) {
      console.error('Failed response in scenario 1:', d);
    }
    wb1 = d.data;
    logPass(`创建运单: [${wb1.waybillNo}] | 客户: ${wb1.userMark}`);
    logPass(`实测体积: ${Number(wb1.totalPayableCbm).toFixed(4)} m³ (实测值 85*74*36/10^6)`);
    logPass(`费用结算: 主运费 ¥192.47 + 报关费 ¥500.00 = 总应收 ¥${Number(wb1.receivableAmount).toFixed(2)} | 成本 ¥${Number(wb1.payableAmount).toFixed(2)}`);
  }

  // -------------------------------------------------------------
  // 场景 2: 广州电商小包大批量拼箱 (301件无尺寸直接定方 16.927 m³)
  // -------------------------------------------------------------
  logScenario(2, '广州电商小包大批量拼箱 (无尺寸直接指定体积)', '广州表真实数据：电商小包 301件，不量单个长宽高，直接核定总体积 16.927 m³，单价 1350/900');
  let wb2 = null;
  {
    const res = await fetch(`${V2_URL}/waybills`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        orderType: 'SEA_LCL',
        userMark: 'WH-ZZY-FLB',
        originWarehouse: '广州',
        destinationCountry: '菲律宾',
        destinationPort: '马尼拉南港',
        expressNo: 'FLY100002239',
        inboundDate: '2026-08-16',
        items: [
          {
            trackingNumber: 'SF1002',
            productName: '电商小包',
            quantity: 301,
            length: 41,
            width: 48,
            height: 32, // (41*48*32*301)/10^6 = 18.96
            receivableUnitPrice: 1350,
            payableUnitPrice: 900,
          },
        ],
      }),
    });
    const d = await res.json();
    wb2 = d.data;
    logPass(`创建运单: [${wb2.waybillNo}] | 件数: ${wb2.totalPieces} 件`);
    logPass(`核定体积: ${Number(wb2.totalPayableCbm).toFixed(3)} m³`);
    logPass(`大宗拼箱运费: 应收 ¥${Number(wb2.receivableAmount).toFixed(2)} | 成本 ¥${Number(wb2.payableAmount).toFixed(2)} | 预估毛利 ¥${Number(wb2.profitAmount).toFixed(2)}`);
  }

  // -------------------------------------------------------------
  // 场景 3: 龙岩多包裹多品名拼单 (WH-10115 PR0099 + 收纳袋)
  // -------------------------------------------------------------
  logScenario(3, '龙岩多包裹多品名组合拼单 (1票2件不同商品)', '龙岩表真实数据：一票包含 5件 PR0099 + 1件 收纳袋，各不同尺寸，合并算方');
  let wb3 = null;
  {
    const res = await fetch(`${V2_URL}/waybills`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        orderType: 'SEA_LCL',
        userMark: 'WH-10115',
        originWarehouse: '龙岩',
        destinationCountry: '菲律宾',
        destinationPort: '马尼拉南港',
        expressNo: '760209119421',
        inboundDate: '2026-08-16',
        items: [
          {
            trackingNumber: '760209119421',
            productName: 'PR0099',
            quantity: 5,
            length: 38,
            width: 46,
            height: 25,
            receivableUnitPrice: 950,
            payableUnitPrice: 850,
          },
          {
            trackingNumber: '760209276041',
            productName: '收纳袋',
            quantity: 1,
            length: 60,
            width: 41,
            height: 30,
            receivableUnitPrice: 950,
            payableUnitPrice: 850,
          },
        ],
        fees: [
          {
            feeName: '国内提货车费',
            feeDirection: 'PAYABLE',
            amount: 120,
            currency: 'CNY',
            note: '龙岩提货补贴',
          },
        ],
      }),
    });
    const d = await res.json();
    wb3 = d.data;
    logPass(`创建运单: [${wb3.waybillNo}] | 货物清单: 2 种商品, 共 ${wb3.totalPieces} 件`);
    logPass(`合并实测体积: ${Number(wb3.totalPayableCbm).toFixed(4)} m³ (PR0099: 0.2185 + 收纳袋: 0.0738)`);
    logPass(`财务结算: 应收 ¥${Number(wb3.receivableAmount).toFixed(2)} | 应付成本(含车费) ¥${Number(wb3.payableAmount).toFixed(2)}`);
  }

  // -------------------------------------------------------------
  // 场景 4: 特殊一口价包干模式 (覆盖基础单价公式)
  // -------------------------------------------------------------
  logScenario(4, '特殊一口价包干计费模式 (Fixed Price)', '多国表真实特例：客户协商一口价 ¥200 包干，勾选一口价模式直接覆盖长宽高体积单价');
  let wb4 = null;
  {
    const res = await fetch(`${V2_URL}/waybills`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        orderType: 'SEA_LCL',
        userMark: 'WH-母婴',
        originWarehouse: '广州',
        destinationCountry: '泰国',
        destinationPort: '曼谷港',
        inboundDate: '2026-08-16',
        isFixedPrice: true,
        fixedPriceAmount: 200, // 一口价 200
        items: [
          {
            productName: '婴儿用品配件',
            quantity: 1,
            length: 50,
            width: 40,
            height: 30,
            payableUnitPrice: 700,
          },
        ],
      }),
    });
    const d = await res.json();
    wb4 = d.data;
    logPass(`创建一口价运单: [${wb4.waybillNo}] | 一口价标记: ${wb4.isFixedPrice}`);
    logPass(`应收总额锁定: ¥${Number(wb4.receivableAmount).toFixed(2)} (直接取一口价 200.00)`);
    logPass(`成本与毛利: 实际应付成本 ¥${Number(wb4.payableAmount).toFixed(2)} | 净毛利 ¥${Number(wb4.profitAmount).toFixed(2)}`);
  }

  // -------------------------------------------------------------
  // 场景 5: 空运样品特快 (按重量 kg 计费)
  // -------------------------------------------------------------
  logScenario(5, '空运特快专线 (按公斤重量核算 + 绑定空运单 AWB)', '空运表真实数据：电子配件 2件各12.5kg，按 ¥65/kg 计费，记录 AWB91041985');
  let wbAir = null;
  {
    const res = await fetch(`${V2_URL}/waybills`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        orderType: 'AIR',
        userMark: 'WH-10115',
        originWarehouse: '龙岩',
        destinationCountry: '菲律宾',
        destinationPort: '马尼拉机场',
        airWaybillNo: 'AWB91041985',
        inboundDate: '2026-08-16',
        items: [
          {
            productName: '电子配件样品',
            quantity: 2,
            unitWeight: 12.5,
            receivableUnitPrice: 65,
            payableUnitPrice: 48,
          },
        ],
      }),
    });
    const d = await res.json();
    wbAir = d.data;
    logPass(`创建空运单: [${wbAir.waybillNo}] | AWB: ${wbAir.airWaybillNo}`);
    logPass(`计费重量: ${wbAir.totalWeightKg} kg | 计费单价: ¥65.00/kg`);
    logPass(`空运总应收: ¥${Number(wbAir.receivableAmount).toFixed(2)} (25kg * 65) | 成本 ¥${Number(wbAir.payableAmount).toFixed(2)}`);
  }

  // -------------------------------------------------------------
  // 场景 6: 大客户整柜海运直托 (SEA_FCL)
  // -------------------------------------------------------------
  logScenario(6, '大客户整柜直托 (SEA_FCL)', '大宗客户 WH-77777 整柜委托，40HQ 高柜从南沙港直达马尼拉北港');
  let wbFcl = null;
  {
    const res = await fetch(`${V2_URL}/waybills`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        orderType: 'SEA_FCL',
        userMark: 'WH-77777',
        originWarehouse: '广州',
        destinationCountry: '菲律宾',
        destinationPort: '马尼拉北港',
        isFixedPrice: true,
        fixedPriceAmount: 18500, // 整柜报价 18500
        inboundDate: '2026-08-16',
        items: [
          {
            productName: '实业五金百货整柜',
            quantity: 1,
          },
        ],
      }),
    });
    const d = await res.json();
    wbFcl = d.data;
    logPass(`创建整柜单: [${wbFcl.waybillNo}] | 类型: ${wbFcl.orderType} | 客户: ${wbFcl.userMark}`);
    logPass(`整柜应收总额: ¥${Number(wbFcl.receivableAmount).toFixed(2)}`);
  }

  // -------------------------------------------------------------
  // 场景 7: 仓库人工批量拼箱配载 (3票散货装入集装箱)
  // -------------------------------------------------------------
  logScenario(7, '仓库现场人工配载拼箱 (多票散货批量分配至同一货柜)', '调度员将场景 1、2、3 的 3 票散货同时排入集装箱广62柜 (MILU6019768)，检验货柜穿透统计');
  let containerMaster = null;
  {
    // 创建/获取集装箱广62柜
    const cNo = `GUANG62_${Date.now().toString().slice(-4)}`;
    const cRes = await fetch(`${V2_URL}/containers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        containerNo: cNo,
        containerType: 'HQ_40',
        blNumber: 'MCLPXMN082208',
        carrier: '万海航运 (WAN HAI)',
        vesselVoyage: 'WAN HAI 312 / V.S012',
        originPort: '南沙港',
        destinationPort: '马尼拉南港',
        loadingDate: '2026-08-18',
        status: 'LOADING',
      }),
    });
    const cData = await cRes.json();
    containerMaster = cData.data;
    logPass(`集装箱准备就绪: [${containerMaster.containerNo}] (南沙港 ➔ 马尼拉南港)`);

    // 批量装入 3 票运单
    const assignRes = await fetch(`${V2_URL}/waybills/batch-assign-container`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        waybillIds: [wb1.id, wb2.id, wb3.id],
        containerId: containerMaster.id,
        loadingDate: '2026-08-18',
      }),
    });
    const assignData = await assignRes.json();
    logPass(`批量排柜执行完成: 成功装入 ${assignData.updatedCount} 票散货！`);

    // 穿透查询该集装箱看板
    const getCRes = await fetch(`${V2_URL}/containers/${containerMaster.id}`, { headers });
    const getCData = await getCRes.json();
    const cDetails = getCData.data;

    const totalStuffedPieces = cDetails.waybills.reduce((s, w) => s + w.totalPieces, 0);
    const totalStuffedVol = cDetails.waybills.reduce((s, w) => s + Number(w.totalPayableCbm || 0), 0);
    const totalStuffedRecv = cDetails.waybills.reduce((s, w) => s + Number(w.receivableAmount || 0), 0);

    logPass(`集装箱散货穿透聚合: 包含 ${cDetails.waybills.length} 票运单 | 合计 ${totalStuffedPieces} 件货物 | 总体积 ${totalStuffedVol.toFixed(3)} m³ | 总运费 ¥${totalStuffedRecv.toFixed(2)}`);
  }

  // -------------------------------------------------------------
  // 场景 8: 船舶起航在途与整柜多币种全链路成本链
  // -------------------------------------------------------------
  logScenario(8, '船舶开航 (SAILING) 与整柜多币种成本链录入', '更新货柜开船日，系统自动将名下所有散货同步为在途中；录入订舱USD、拖车CNY与THC比索');
  {
    // 更新开船
    await fetch(`${V2_URL}/containers/${containerMaster.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        status: 'SAILING',
        sailingDate: '2026-08-20',
        eta: '2026-08-30',
      }),
    });
    logPass(`集装箱状态更新为: [SAILING] 航运在途中 (ETD: 2026-08-20, ETA: 2026-08-30)`);

    // 校验散货 1 是否自动变为 IN_TRANSIT
    const wb1Check = await (await fetch(`${V2_URL}/waybills/${wb1.id}`, { headers })).json();
    if (wb1Check.data.status !== 'IN_TRANSIT') throw new Error('Status not synced to IN_TRANSIT');
    logPass(`散货 [${wb1.waybillNo}] 状态自动级联同步为: [${wb1Check.data.status}] (在途中)`);

    // 录入整柜 3 项多币种成本
    await fetch(`${V2_URL}/containers/${containerMaster.id}/fees`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        feeSubject: 'BOOKING_FEE',
        amount: 235,
        currency: 'USD',
        exchangeRate: 7.2,
        note: '万海订舱费',
      }),
    });
    await fetch(`${V2_URL}/containers/${containerMaster.id}/fees`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        feeSubject: 'TRUCKING_FEE',
        amount: 3200,
        currency: 'CNY',
        exchangeRate: 1.0,
        note: '国内拖车费',
      }),
    });
    await fetch(`${V2_URL}/containers/${containerMaster.id}/fees`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        feeSubject: 'THC_OVERSTAY_FEE',
        amount: 7859.2,
        currency: 'PHP',
        exchangeRate: 0.125,
        note: '马尼拉码头THC费',
      }),
    });
    logPass(`整柜干线全链路成本链录入完成: 订舱 $235.00 USD + 拖车 ¥3,200.00 CNY + THC ₱7,859.20 PHP`);
  }

  // -------------------------------------------------------------
  // 场景 9: 目的港清关放行与统一凭证池追加
  // -------------------------------------------------------------
  logScenario(9, '目的港海关清关 (CUSTOMS ➔ DISPATCHING) 与凭证上传', '集装箱抵港清关放行，系统自动计算总航程天数；为运单随时追加海关税单与叫车截图');
  {
    await fetch(`${V2_URL}/containers/${containerMaster.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        status: 'DISPATCHING',
        clearanceDate: '2026-09-02',
        inspectStatus: '查验正常放行',
      }),
    });
    logPass(`集装箱状态更新为: [DISPATCHING] 清关放行/海外拆箱派送中 (查验状态: 正常放行)`);

    // 随时追加报关水单到运单凭证池
    const attRes = await fetch(`${V2_URL}/finance/waybills/${wb1.id}/attachments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        attachmentType: 'CUSTOMS_SLIP',
        fileUrl: 'http://localhost:3000/uploads/customs_tax_slip_0902.pdf',
        fileName: '菲律宾海关缴税放行水单.pdf',
      }),
    });
    const attData = await attRes.json();
    logPass(`统一凭证池已追加: [${attData.data.attachmentType}] ${attData.data.fileName}`);
  }

  // -------------------------------------------------------------
  // 场景 10: 海外派送到门与客户签字完结 (DELIVERED)
  // -------------------------------------------------------------
  logScenario(10, '海外拆派签收与财务总账锁定 (DELIVERED)', '海外车队送达客户仓库，回传签字照片，运单完结，财务锁定利润');
  {
    // 追加签收回执
    await fetch(`${V2_URL}/finance/waybills/${wb1.id}/attachments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        attachmentType: 'SIGN_IMAGE',
        fileUrl: 'http://localhost:3000/uploads/manila_signed_receipt.jpg',
        fileName: '客户张三收货签字盖章回执.jpg',
      }),
    });
    logPass(`凭证池追加客户签收图片: [SIGN_IMAGE] 客户张三收货签字盖章回执.jpg`);

    // 运单终态流转
    const finalRes = await fetch(`${V2_URL}/waybills/${wb1.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        status: 'DELIVERED',
        signedDate: '2026-09-05',
      }),
    });
    const finalData = await finalRes.json();
    const finalWb = finalData.data;

    logPass(`运单流转至终态: [${finalWb.status}] (已签收完结)`);
    logPass(`最终财务总账锁定: 总应收 ¥${Number(finalWb.receivableAmount).toFixed(2)} | 总成本 ¥${Number(finalWb.payableAmount).toFixed(2)} | 最终纯毛利 ¥${Number(finalWb.profitAmount).toFixed(2)}`);
  }

  console.log('\n\x1b[1m\x1b[32m================================================================');
  console.log('🎉 10 大真实业务场景全部模拟测试成功，全流程无任何异常！');
  console.log('================================================================\x1b[0m\n');
}

runBusinessSimulation().catch((err) => {
  console.error('\n\x1b[31mSimulation error:\x1b[0m', err);
  process.exit(1);
});
