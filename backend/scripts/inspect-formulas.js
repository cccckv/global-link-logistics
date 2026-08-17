const path = require('path');
const xlsx = require(path.join(__dirname, '../../frontend/customer/node_modules/xlsx'));
const fs = require('fs');

const infoDir = path.join(__dirname, '../../info');
const files = fs.readdirSync(infoDir).filter(f => f.endsWith('.xlsx'));

for (const file of files) {
  const filePath = path.join(infoDir, file);
  console.log(`\n======================================================`);
  console.log(`FILE: ${file}`);
  console.log(`======================================================`);
  
  const wb = xlsx.readFile(filePath, { cellFormula: true, sheetRows: 25 });
  for (const sheetName of wb.SheetNames) {
    console.log(`\n--- Sheet: "${sheetName}" ---`);
    const sheet = wb.Sheets[sheetName];
    
    // Scan for formulas
    const formulas = [];
    for (const cellAddress in sheet) {
      if (cellAddress.startsWith('!')) continue;
      const cell = sheet[cellAddress];
      if (cell && cell.f) {
        formulas.push(`${cellAddress} = ${cell.f} (Value: ${cell.v})`);
        if (formulas.length >= 10) break;
      }
    }
    
    if (formulas.length > 0) {
      console.log('Sample Formulas detected:');
      formulas.forEach(f => console.log('  ', f));
    } else {
      console.log('No formulas detected in first 25 rows.');
    }
  }
}
