import { prisma } from "../src/lib/prisma";

async function main() {
  // testing user ID
  const testingUserId = "cmth31ulf0001ycqu0hfklnct";

  console.log("Setting INIT_QR status for testing user...");
  await prisma.whatsAppSession.upsert({
    where: { userId: testingUserId },
    update: {
      status: "INIT_QR",
      qrCode: null,
      qrExpiresAt: null,
      errorMessage: null,
      pairingCode: null,
      requestedPhone: null,
    },
    create: {
      userId: testingUserId,
      status: "INIT_QR",
    },
  });

  console.log("Done. Worker should detect this and generate QR within 2-3 seconds...");
  await new Promise(r => setTimeout(r, 8000));

  const session = await prisma.whatsAppSession.findUnique({
    where: { userId: testingUserId },
    select: { status: true, qrCode: true, errorMessage: true }
  });
  console.log("Session after 8s:", {
    status: session?.status,
    hasQR: !!session?.qrCode,
    error: session?.errorMessage
  });

  await prisma.$disconnect();
}
main();
