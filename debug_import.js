const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get ALL imports ordered by latest first
  const imports = await prisma.excelImport.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  
  for (const imp of imports) {
    console.log(`\n--- Import: ${imp.id} ---`);
    console.log(`File: ${imp.fileName}`);
    console.log(`Created: ${imp.createdAt}`);
    console.log(`Status: ${imp.status}, New: ${imp.newRecords}, Updated: ${imp.updatedRecords}`);
    
    const rows = await prisma.excelImportRow.findMany({
      where: { importId: imp.id }
    });
    for (const row of rows) {
      console.log(`  Row ${row.rowNumber}: ${row.status} - ${row.errorMessage ? row.errorMessage.substring(0, 150) : 'OK'}`);
    }
  }
  
  const customerCount = await prisma.customer.count();
  console.log(`\nTotal Customers in DB: ${customerCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
