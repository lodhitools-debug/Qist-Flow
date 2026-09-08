const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Delete the test customer
  await prisma.customer.delete({ where: { id: 'cmtjtsjdi0001j1dnjscxjb4l' } });
  const count = await prisma.customer.count();
  console.log("✅ Test customer deleted. Total Customers:", count);
}

main().catch(console.error).finally(() => prisma.$disconnect());
