/**
 * One-time cleanup: Remove the legacy "default" WhatsApp session row
 * that caused all users to share one connection status.
 *
 * Run once before deploying the rebuilt WhatsApp module:
 *   npx tsx scripts/cleanup-default-session.ts
 */
import { prisma } from "../src/lib/prisma";

async function cleanup() {
  console.log("=== WhatsApp Default Session Cleanup ===");

  // Delete rows where userId IS NULL (the legacy "default" session)
  const deleted = await prisma.whatsAppSession.deleteMany({
    where: { userId: null },
  });
  console.log(`✅ Deleted ${deleted.count} legacy null-userId session row(s).`);

  // Show all remaining sessions
  const sessions = await prisma.whatsAppSession.findMany({
    select: { id: true, userId: true, status: true, connectedPhone: true },
  });

  console.log(`\nRemaining sessions (${sessions.length}):`);
  for (const s of sessions) {
    console.log(`  userId=${s.userId} | status=${s.status} | phone=${s.connectedPhone ?? "none"}`);
  }

  await prisma.$disconnect();
  console.log("\nDone.");
}

cleanup().catch((err) => {
  console.error("Cleanup error:", err);
  process.exit(1);
});
