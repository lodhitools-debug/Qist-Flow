import { waWebProvider } from "../src/lib/whatsapp/web-provider";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("🚀 Testing Real Baileys QR Code Generation with Supabase Database Sync...");

  await waWebProvider.init();

  let elapsed = 0;
  const interval = setInterval(async () => {
    elapsed += 1;
    const info = await waWebProvider.getConnectedInfo();
    console.log(`[${elapsed}s] State: ${info.status} | Has QR: ${!!info.qrCode}`);

    if (info.qrCode) {
      console.log("\n🎉 REAL BAILEYS QR CODE GENERATED SUCCESSFULLY!");
      console.log(`QR Code Data URL Length: ${info.qrCode.length} characters`);
      console.log(`QR Code Prefix: ${info.qrCode.substring(0, 50)}...`);

      const dbSession = await prisma.whatsAppSession.findUnique({ where: { id: "default" } });
      console.log("\n🗄️ Supabase PostgreSQL Session Record:");
      console.log({
        id: dbSession?.id,
        status: dbSession?.status,
        hasQrCodeInDb: !!dbSession?.qrCode,
        updatedAt: dbSession?.updatedAt,
      });

      clearInterval(interval);
      process.exit(0);
    }

    if (elapsed >= 25) {
      console.log("Timed out waiting for QR code.");
      clearInterval(interval);
      process.exit(1);
    }
  }, 1000);
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
