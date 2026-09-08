const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Adding UNIQUE CONSTRAINT to Customer table...");
  
  try {
    // Drop the existing unique index first (if it blocks)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Customer" 
      ADD CONSTRAINT "Customer_account_tenantId_unique" 
      UNIQUE USING INDEX "Customer_account_tenantId_key";
    `);
    console.log("✅ Unique constraint added successfully using existing index!");
  } catch (err) {
    console.log("First approach failed:", err.message);
    
    // Try alternative: drop index and recreate as constraint
    try {
      await prisma.$executeRawUnsafe(`
        DROP INDEX IF EXISTS "Customer_account_tenantId_key";
      `);
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Customer" 
        ADD CONSTRAINT "Customer_account_tenantId_key" 
        UNIQUE (account, "tenantId");
      `);
      console.log("✅ Unique constraint added successfully (recreated)!");
    } catch (err2) {
      console.log("Second approach also failed:", err2.message);
    }
  }
  
  // Verify
  const constraints = await prisma.$queryRawUnsafe(`
    SELECT conname, contype, pg_get_constraintdef(c.oid) as condef
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'Customer'
    AND contype = 'u';
  `);
  console.log("\nUnique Constraints now:", JSON.stringify(constraints, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
