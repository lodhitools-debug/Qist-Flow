import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Creating Tenant table and default record via raw SQL...');
  
  // Create Tenant table via raw SQL if not exists  
  await prisma.(
    CREATE TABLE IF NOT EXISTS "Tenant" (
      id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Tenant_pkey" PRIMARY KEY (id)
    )
  );
  console.log('Tenant table ready');

  // Add unique index on slug
  await prisma.(
    CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_slug_key" ON "Tenant"(slug)
  ).catch(() => {});

  // Insert default tenant
  await prisma.(
    INSERT INTO "Tenant" (id, name, slug, "isActive", "createdAt", "updatedAt")
    VALUES ('default', 'Default Company', 'default', true, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  );
  console.log('Default tenant inserted');
  
  console.log('Done! Now running db push...');
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.());
