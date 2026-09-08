const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.excelImportRow.findMany({
    where: { importId: 'cmtjt3ju7000jv6xhubrxqw2t' }
  });
  console.log(JSON.stringify(rows, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
