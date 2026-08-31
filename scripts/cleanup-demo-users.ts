import { prisma } from "../src/lib/prisma";

async function cleanupDemoUsers() {
  console.log("🧹 Cleaning up demo users from database...");

  const demoEmails = [
    "admin@qistflow.com",
    "manager@qistflow.com",
    "officer@qistflow.com",
  ];

  // 1. Unlink any assigned customers from demo users first to prevent foreign key errors
  const demoUsers = await prisma.user.findMany({
    where: { email: { in: demoEmails } },
    select: { id: true, email: true },
  });

  const demoUserIds = demoUsers.map((u) => u.id);

  if (demoUserIds.length > 0) {
    const unlinkedCustomers = await prisma.customer.updateMany({
      where: { assignedToUserId: { in: demoUserIds } },
      data: { assignedToUserId: null },
    });
    console.log(`✅ Unlinked ${unlinkedCustomers.count} customers from demo users.`);

    // 2. Delete any audit logs, refresh tokens, or user records associated with demo accounts
    await prisma.activityLog.deleteMany({
      where: { userId: { in: demoUserIds } },
    });

    const deleted = await prisma.user.deleteMany({
      where: { id: { in: demoUserIds } },
    });

    console.log(`🎉 Successfully removed ${deleted.count} demo users (${demoEmails.join(", ")}).`);
  } else {
    console.log("ℹ️ No demo users found in the database.");
  }

  const remainingUsers = await prisma.user.count();
  console.log(`📊 Remaining real users in database: ${remainingUsers}`);
}

cleanupDemoUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
