import { prisma } from "../src/lib/prisma";

async function main() {
  const sessions = await prisma.whatsAppSession.findMany({
    include: {
      user: {
        select: {
          email: true,
          name: true,
        }
      }
    }
  });

  console.log("=== Active WhatsApp Sessions in DB ===");
  sessions.forEach((s) => {
    console.log({
      user: s.user?.name + " (" + s.user?.email + ")",
      status: s.status,
      hasQR: !!s.qrCode,
      qrLength: s.qrCode?.length ?? 0,
      connectedPhone: s.connectedPhone,
      error: s.errorMessage,
      updatedAt: s.updatedAt,
    });
  });
  await prisma.$disconnect();
}
main();
