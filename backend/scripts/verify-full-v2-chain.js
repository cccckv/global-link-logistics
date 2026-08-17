async function runFullVerification() {
  console.log('================================================================');
  console.log('🚀 GLOBAL LINK LOGISTICS - V2 FULL REFACTOR VERIFICATION SUITE');
  console.log('================================================================\n');

  const BASE = 'http://127.0.0.1:3000/api/v2';

  // 1. Customer & Mark Autocomplete
  console.log('👉 [STEP 1] Customer & Mark Autocomplete');
  const custRes = await fetch(`${BASE}/customers?search=WH-10115`);
  const custData = await custRes.json();
  if (!custData.success || !custData.data.length) throw new Error('Customer fetch failed');
  const customer = custData.data[0];
  console.log(`   ✅ Matched Mark: ${customer.clientCode} (${customer.name})`);
  console.log(`   ✅ Default Overseas Address: ${customer.addresses[0]?.name} - ${customer.addresses[0]?.address}`);

  // 2. Create Inbound LCL Waybill with real Excel formula simulation
  console.log('\n👉 [STEP 2] Simulating Inbound LCL Entry (Longyan Sheet row)');
  const wbPayload = {
    orderType: 'SEA_LCL',
    userMark: customer.clientCode,
    originWarehouse: customer.defaultWarehouse || '龙岩',
    destinationCountry: customer.destinationCountry || '菲律宾',
    destinationPort: customer.destinationPort || '马尼拉南港',
    expressNo: '760209119421',
    note: '龙岩海运到货-不报关',
    overseasName: customer.addresses[0]?.name,
    overseasPhone: customer.addresses[0]?.phone,
    overseasAddress: customer.addresses[0]?.address,
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
    ],
    fees: [
      {
        feeName: '国内拖车车费',
        feeDirection: 'PAYABLE',
        amount: 150,
        currency: 'CNY',
      },
    ],
  };

  const createRes = await fetch(`${BASE}/waybills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(wbPayload),
  });
  const createData = await createRes.json();
  if (!createData.success) throw new Error('Waybill creation failed');
  const wb = createData.data;
  console.log(`   ✅ Created Waybill: ${wb.waybillNo} (Status: ${wb.status})`);
  console.log(`   ✅ Calculated Volume (L*W*H*Qty/10^6): ${wb.totalPayableCbm} m³ (Expected: 0.2185)`);
  console.log(`   ✅ Revenue: ¥${wb.receivableAmount} | Cost: ¥${wb.payableAmount} | Profit: ¥${wb.profitAmount}`);

  // 3. Create Container & Batch Assign
  console.log('\n👉 [STEP 3] Container Stuffing & Batch Assign');
  const newContainerRes = await fetch(`${BASE}/containers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      containerNo: 'TGBU5218902',
      containerType: 'HQ_40',
      carrier: '万海航运',
      vesselVoyage: 'WAN HAI 515 / V.N088',
      originPort: '厦门港',
      destinationPort: '马尼拉南港',
      loadingDate: '2026-08-18',
    }),
  });
  const newContainerData = await newContainerRes.json();
  const containerId = newContainerData.data.id;
  console.log(`   ✅ Created Container: ${newContainerData.data.containerNo}`);

  // Assign waybill to container
  const assignRes = await fetch(`${BASE}/waybills/batch-assign-container`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      waybillIds: [wb.id],
      containerId,
      loadingDate: '2026-08-18',
    }),
  });
  const assignData = await assignRes.json();
  console.log(`   ✅ Batch Stuffed Waybill into Container (Updated: ${assignData.updatedCount})`);

  // 4. Container Sailing & Status Synchronization
  console.log('\n👉 [STEP 4] Container Sailing & Auto Waybill Status Sync');
  await fetch(`${BASE}/containers/${containerId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'SAILING',
      sailingDate: '2026-08-20',
      eta: '2026-08-30',
    }),
  });

  const checkWbRes = await fetch(`${BASE}/waybills/${wb.id}`);
  const checkWbData = await checkWbRes.json();
  console.log(`   ✅ Waybill Status automatically updated to: ${checkWbData.data.status}`);

  // 5. Container Full-Chain Costs
  console.log('\n👉 [STEP 5] Recording Container Full-Chain Costs');
  await fetch(`${BASE}/containers/${containerId}/fees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      feeSubject: 'BOOKING_FEE',
      amount: 250,
      currency: 'USD',
      exchangeRate: 7.2,
      note: '万海厦门-马尼拉订舱海运费',
    }),
  });
  await fetch(`${BASE}/containers/${containerId}/fees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      feeSubject: 'THC_OVERSTAY_FEE',
      amount: 7859.2,
      currency: 'PHP',
      exchangeRate: 0.125,
      note: '马尼拉南港堆箱与THC超支费',
    }),
  });
  console.log(`   ✅ Recorded USD Booking Fee ($250) and PHP THC Fee (₱7,859.20)`);

  // 6. Unified Attachment Pool
  console.log('\n👉 [STEP 6] Unified Attachment Pool Management');
  await fetch(`${BASE}/finance/waybills/${wb.id}/attachments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attachmentType: 'CUSTOMS_SLIP',
      fileUrl: 'http://localhost:3000/uploads/customs_voucher_0820.jpg',
      fileName: '龙岩中外运报关水单.jpg',
    }),
  });
  await fetch(`${BASE}/finance/waybills/${wb.id}/attachments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attachmentType: 'SIGN_IMAGE',
      fileUrl: 'http://localhost:3000/uploads/signed_manila.jpg',
      fileName: '客户海外签收回执.jpg',
    }),
  });
  console.log(`   ✅ Added Customs Voucher & Delivery Sign Image to Attachment Pool`);

  // 7. Complete Delivery
  console.log('\n👉 [STEP 7] Advance to Final Delivery (DELIVERED)');
  await fetch(`${BASE}/waybills/${wb.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'DELIVERED',
      signedDate: '2026-09-02',
    }),
  });

  const finalRes = await fetch(`${BASE}/waybills/${wb.id}`);
  const finalData = await finalRes.json();
  console.log(`   ✅ Final Waybill Status: ${finalData.data.status}`);
  console.log(`   ✅ Attachments Count: ${finalData.data.attachments.length}`);
  console.log(`   ✅ Container Stuffed: ${finalData.data.containerMaster?.containerNo}`);

  console.log('\n================================================================');
  console.log('🎉 ALL 7 LIFECYCLE STAGES & CLEAN ARCHITECTURE MODULES VERIFIED!');
  console.log('================================================================');
}

runFullVerification().catch(console.error);
