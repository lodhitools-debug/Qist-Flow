import { prisma } from "../src/lib/prisma";

async function main() {
  const row = await prisma.whatsAppSession.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      status: "NOT_CONNECTED"
    }
  });
  console.log("Legacy default session upserted:", row);
  await prisma.$disconnect();
}
main();
