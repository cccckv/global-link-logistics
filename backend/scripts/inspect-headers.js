const path = require('path');
const xlsx = require(path.join(__dirname, '../../frontend/customer/node_modules/xlsx'));
const fs = require('fs');

const infoDir = path.join(__dirname, '../../info');
const files = fs.readdirSync(infoDir).filter(f => f.endsWith('.xlsx'));

for (const file of files) {
  const filePath = path.join(infoDir, file);
  console.log(`\n================================================================`);
  console.log(`FILE: ${file}`);
  console.log(`================================================================`);
  
  const workbook = xlsx.readFile(filePath, { sheetRows: 10 });
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    console.log(`\n>>> Sheet: [${sheetName}] (Total preview rows: ${rows.length})`);
    
    // Find the header row (usually row 1 or row 2)
    rows.slice(0, 4).forEach((r, idx) => {
      console.log(`  Row ${idx + 1}:`, r.filter(c => c !== '').join(' | '));
    });
  }
}
