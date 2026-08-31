import { prisma } from "../src/lib/prisma";

async function verifyLiveDb() {
  console.log("🔍 Checking Live Database Status...");
  const [userCount, customerCount, installmentCount, templateCount, ruleCount, session] = await Promise.all([
    prisma.user.count(),
    prisma.customer.count(),
    prisma.installment.count(),
    prisma.messageTemplate.count(),
    prisma.reminderRule.count(),
    prisma.whatsAppSession.findUnique({ where: { id: "default" } }),
  ]);

  console.log("\n📊 Live Database Summary:");
  console.log(`  Users: ${userCount}`);
  console.log(`  Customers: ${customerCount}`);
  console.log(`  Installments: ${installmentCount}`);
  console.log(`  Message Templates: ${templateCount}`);
  console.log(`  Reminder Rules: ${ruleCount}`);
  console.log(`  WhatsApp Session Status: ${session?.status || "DISCONNECTED"}`);

  console.log("\n👥 Sample Customers in Database:");
  const samples = await prisma.customer.findMany({
    take: 3,
    include: { installments: true, assignedTo: true },
  });

  samples.forEach((s, idx) => {
    console.log(`  #${idx + 1}: ${s.customerName} (Acc: ${s.account}, Phone: ${s.primaryPhone}, Balance: Rs. ${s.installments[0]?.balance || 0}, Status: ${s.installments[0]?.status}, Assigned: ${s.assignedTo?.name || "Unassigned"})`);
  });
}

verifyLiveDb()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
