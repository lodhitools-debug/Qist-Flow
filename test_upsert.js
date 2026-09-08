const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Try a direct upsert to verify the fix works
  const testResult = await prisma.customer.upsert({
    where: { account_tenantId: { account: '267000473', tenantId: 'default' } },
    update: {
      customerName: 'Umar hayat test - FIXED',
    },
    create: {
      account: '267000473',
      tenantId: 'default',
      customerName: 'Umar hayat test - FIXED',
      primaryPhone: '923268973045',
      branch: 'QBLAN',
    }
  });
  console.log("✅ Upsert worked! Customer:", JSON.stringify(testResult, null, 2));
  
  const count = await prisma.customer.count();
  console.log("Total Customers:", count);
}

main().catch(console.error).finally(() => prisma.$disconnect());
