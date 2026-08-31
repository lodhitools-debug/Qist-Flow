import { prisma } from "../src/lib/prisma";

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true }
  });
  console.log("Users:", JSON.stringify(users, null, 2));

  const sessions = await prisma.whatsAppSession.findMany({
    select: { userId: true, status: true, qrCode: true, connectedPhone: true }
  });
  console.log("WhatsApp Sessions:", JSON.stringify(sessions, null, 2));

  await prisma.$disconnect();
}
main();
