// Bootstrap script: create Tenant table and default record so db push can add FK
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Bootstrapping Tenant table...');

  // Create Tenant table
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "Tenant" (
      id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Tenant_pkey" PRIMARY KEY (id)
    )
  `;
  console.log('Tenant table ready');

  // Unique index on slug
  try {
    await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_slug_key" ON "Tenant"(slug)`;
  } catch (e) {}

  // Insert default tenant (all existing data will reference this)
  await prisma.$executeRaw`
    INSERT INTO "Tenant" (id, name, slug, "isActive", "createdAt", "updatedAt")
    VALUES ('default', 'Default Company', 'default', true, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `;
  console.log('Default tenant inserted successfully!');
}

main()
  .catch(function(e) { console.error('Error:', e.message); process.exit(1); })
  .finally(function() { return prisma.$disconnect(); });

