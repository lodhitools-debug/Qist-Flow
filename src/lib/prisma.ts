import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Enforce connection pooling limits on Supabase PgBouncer connections
let dbUrl = process.env.DATABASE_URL || "";
if (dbUrl.includes("pgbouncer=true") && !dbUrl.includes("connection_limit")) {
  dbUrl += (dbUrl.includes("?") ? "&" : "?") + "connection_limit=3&pool_timeout=20";
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;

