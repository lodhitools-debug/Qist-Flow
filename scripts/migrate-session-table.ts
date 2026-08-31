import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "WhatsAppSession" CASCADE;`);
    console.log("✅ Successfully truncated old single WhatsAppSession table.");
  } catch (err: any) {
    console.error("Migration error:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
