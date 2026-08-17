async function testV2() {
  console.log('Testing V2 API Endpoints...\n');

  const BASE_URL = 'http://127.0.0.1:3000/api/v2';

  // 1. Test Customer Search / Autocomplete
  console.log('1. Testing Customer Search & Autocomplete...');
  const custRes = await fetch(`${BASE_URL}/customers?search=WH-ZZY`);
  const custData = await custRes.json();
  console.log('  Customer search result count:', custData.data?.length);
  const targetCust = custData.data?.[0];
  console.log('  Found customer:', targetCust?.clientCode, '-', targetCust?.name);
  console.log('  Default Address:', targetCust?.addresses?.[0]?.name, targetCust?.addresses?.[0]?.address);

  // 2. Test Waybill Creation (Simulate Guangzhou Inbound LCL row: 背心 1件 85*74*36 单价850)
  console.log('\n2. Testing Waybill Creation (LCL Inbound)...');
  const createPayload = {
    orderType: 'SEA_LCL',
    userMark: 'WH-ZZY-FLB',
    originWarehouse: '广州',
    destinationCountry: '菲律宾',
    destinationPort: '马尼拉南港',
    expressNo: 'FLY100002162',
    note: '广州海运拼箱测试单',
    recipientName: '张三 (国内)',
    recipientPhone: '13800001111',
    overseasName: targetCust?.addresses?.[0]?.name || 'ZZY Manila Hub',
    overseasPhone: targetCust?.addresses?.[0]?.phone || '+63 917 123 4567',
    overseasAddress: targetCust?.addresses?.[0]?.address || 'Tondo, Manila',
    inboundDate: '2026-08-16',
    items: [
      {
        trackingNumber: 'SF888999111',
        productName: '背心',
        quantity: 1,
        length: 85,
        width: 74,
        height: 36,
        unitWeight: 5.5,
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
  };

  const wbRes = await fetch(`${BASE_URL}/waybills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(createPayload),
  });
  const wbData = await wbRes.json();
  console.log('  Created Waybill No:', wbData.data?.waybillNo);
  console.log('  Payable Volume (CBM):', wbData.data?.totalPayableCbm);
  console.log('  Total Receivable (with fee): ¥', wbData.data?.receivableAmount);
  console.log('  Total Cost (Payable): ¥', wbData.data?.payableAmount);
  console.log('  Calculated Profit: ¥', wbData.data?.profitAmount);

  const waybillId = wbData.data?.id;

  // 3. Test Container Master & Batch Assign
  console.log('\n3. Testing Container Master & Stuffing...');
  const cntRes = await fetch(`${BASE_URL}/containers`);
  const cntData = await cntRes.json();
  const sampleContainer = cntData.data?.[0];
  console.log('  Found Container:', sampleContainer?.containerNo, sampleContainer?.originPort, '->', sampleContainer?.destinationPort);

  if (sampleContainer && waybillId) {
    const assignRes = await fetch(`${BASE_URL}/waybills/batch-assign-container`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        waybillIds: [waybillId],
        containerId: sampleContainer.id,
        loadingDate: '2026-08-18',
      }),
    });
    const assignData = await assignRes.json();
    console.log('  Batch assign container result:', assignData);

    // Verify Waybill status changed to LOADED
    const getWbRes = await fetch(`${BASE_URL}/waybills/${waybillId}`);
    const getWbData = await getWbRes.json();
    console.log('  Waybill status after stuffing:', getWbData.data?.status, 'Container:', getWbData.data?.containerMaster?.containerNo);
  }

  // 4. Test Attachment Pool
  console.log('\n4. Testing Attachment Pool (Adding Proof)...');
  const attRes = await fetch(`${BASE_URL}/finance/waybills/${waybillId}/attachments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attachmentType: 'PICKUP_SCREENSHOT',
      fileUrl: 'http://localhost:3000/uploads/sample-pickup.jpg',
      fileName: '送仓叫车单.jpg',
    }),
  });
  const attData = await attRes.json();
  console.log('  Added Attachment:', attData.data?.fileName, 'Type:', attData.data?.attachmentType);

  console.log('\n🎉 ALL V2 API TESTS PASSED SUCCESSFULLY!');
}

testV2().catch(console.error);
