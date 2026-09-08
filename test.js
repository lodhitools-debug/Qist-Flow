const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const imports = await prisma.excelImport.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1
  });
  console.log(JSON.stringify(imports, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
