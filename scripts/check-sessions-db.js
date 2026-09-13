const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSessions() {
  const sessions = await prisma.whatsAppSession.findMany({
    select: {
      userId: true,
      status: true,
      updatedAt: true
    }
  });
  console.log("Current WhatsApp Sessions in DB:");
  console.table(sessions);
}

checkSessions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
