const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check if the unique constraint exists
  const constraintCheck = await prisma.$queryRawUnsafe(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'Customer' 
    ORDER BY indexname;
  `);
  console.log("Customer Indexes:", JSON.stringify(constraintCheck, null, 2));
  
  // Also check constraints
  const constraintCheck2 = await prisma.$queryRawUnsafe(`
    SELECT conname, contype, pg_get_constraintdef(c.oid) as condef
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'Customer';
  `);
  console.log("Customer Constraints:", JSON.stringify(constraintCheck2, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
