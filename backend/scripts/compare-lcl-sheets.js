const path = require('path');
const xlsx = require(path.join(__dirname, '../../frontend/customer/node_modules/xlsx'));
const fs = require('fs');

const infoDir = path.join(__dirname, '../../info');

const lclSheets = [
  { file: '万海入库计划表 广州 2026.8.13xlsx.xlsx.xlsx', sheet: '广州', name: '广州海运拼柜' },
  { file: '万海入库计划表 龙岩 空运2026.8.13.xlsx', sheet: '龙岩海运到货数据', name: '龙岩海运拼柜' },
  { file: '万海入库计划表 印尼 泰国 马来 2026.8.13.xlsx.xlsx', sheet: '其他国家入库数据', name: '多国海运拼柜' }
];

console.log('=== DEEP DIVE: 3 LCL EXCEL SHEETS ===\n');

for (const item of lclSheets) {
  const filePath = path.join(infoDir, item.file);
  const wb = xlsx.readFile(filePath, { sheetRows: 50 });
  const sheet = wb.Sheets[item.sheet];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  
  // Find header row
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const r = rows[i];
    if (r.some(c => String(c).includes('入库') || String(c).includes('客户') || String(c).includes('品名'))) {
      headerRowIdx = i;
      break;
    }
  }
  
  const headers = rows[headerRowIdx];
  console.log(`\n======================================================`);
  console.log(`【${item.name}】: ${item.file} -> [${item.sheet}]`);
  console.log(`Header Row Index: ${headerRowIdx + 1}, Total Columns: ${headers.length}`);
  console.log(`======================================================`);
  
  headers.forEach((h, idx) => {
    const colLetter = xlsx.utils.encode_col(idx);
    // Collect sample non-empty values from first 30 rows
    const samples = [];
    for (let r = headerRowIdx + 1; r < Math.min(headerRowIdx + 35, rows.length); r++) {
      const val = rows[r][idx];
      if (val !== undefined && val !== '' && !samples.includes(String(val))) {
        samples.push(String(val));
        if (samples.length >= 3) break;
      }
    }
    console.log(`  Col ${idx} (${colLetter}): "${h}" -> 示例: [${samples.slice(0, 3).join(', ')}]`);
  });
}
