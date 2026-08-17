const path = require('path');
const xlsx = require(path.join(__dirname, '../../frontend/customer/node_modules/xlsx'));
const fs = require('fs');

const infoDir = path.join(__dirname, '../../info');
const files = fs.readdirSync(infoDir).filter(f => f.endsWith('.xlsx'));

console.log('Found Excel files in info/:', files);

for (const file of files) {
  const filePath = path.join(infoDir, file);
  console.log(`\n======================================================`);
  console.log(`FILE: ${file}`);
  console.log(`======================================================`);
  
  try {
    const workbook = xlsx.readFile(filePath, { sheetRows: 20 });
    console.log(`Sheet Names (${workbook.SheetNames.length}):`, workbook.SheetNames);
    
    for (const sheetName of workbook.SheetNames.slice(0, 5)) {
      console.log(`\n--- Sheet: "${sheetName}" ---`);
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      
      console.log(`Row count (first preview): ${data.length}`);
      if (data.length > 0) {
        console.log('Top 5 rows preview:');
        data.slice(0, 7).forEach((row, idx) => {
          console.log(`  Row ${idx + 1}:`, JSON.stringify(row));
        });
      }
    }
  } catch (err) {
    console.error(`Error reading ${file}:`, err.message);
  }
}
