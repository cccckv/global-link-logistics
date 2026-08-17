const path = require('path');
const xlsx = require(path.join(__dirname, '../../frontend/customer/node_modules/xlsx'));
const fs = require('fs');

const infoDir = path.join(__dirname, '../../info');

function analyzeSheet(filename, sheetName, maxRows = 15) {
  const filePath = path.join(infoDir, filename);
  const wb = xlsx.readFile(filePath, { sheetRows: 50 });
  const sheet = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  
  console.log(`\n======================================================`);
  console.log(`FILE: ${filename} -> SHEET: ${sheetName}`);
  console.log(`======================================================`);
  
  // Find header
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const r = rows[i];
    if (r.some(cell => String(cell).includes('入库') || String(cell).includes('客户') || String(cell).includes('柜号') || String(cell).includes('品名'))) {
      headerRowIndex = i;
      break;
    }
  }
  
  const headers = rows[headerRowIndex];
  console.log(`Header Row (${headerRowIndex + 1}):`);
  headers.forEach((h, i) => {
    if (h) console.log(`  Col ${i} (${xlsx.utils.encode_col(i)}): ${h}`);
  });
  
  console.log(`\nSample Data Rows (after header):`);
  const dataRows = rows.slice(headerRowIndex + 1, headerRowIndex + 1 + maxRows);
  dataRows.forEach((r, idx) => {
    const obj = {};
    headers.forEach((h, colIdx) => {
      if (h && r[colIdx] !== '') {
        obj[h] = r[colIdx];
      }
    });
    console.log(`Row ${idx + 1}:`, JSON.stringify(obj, null, 2));
  });
}

analyzeSheet('万海入库计划表 印尼 泰国 马来 2026.8.13.xlsx.xlsx', '其他国家入库数据', 5);
analyzeSheet('万海入库计划表 广州 2026.8.13xlsx.xlsx.xlsx', '广州', 5);
analyzeSheet('万海入库计划表 龙岩 空运2026.8.13.xlsx', '空运', 5);
analyzeSheet('万海入库计划表 龙岩 空运2026.8.13.xlsx', '龙岩海运到货数据', 5);
analyzeSheet('整柜信息进度表2026.8.13(1).xlsx', '清关', 6);
