import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("QistFlow Multi-Tenant Migration Starting...");

  const defaultTenant = await prisma.tenant.upsert({
    where: { slug: "default" },
    update: {},
    create: { id: "default", slug: "default", name: "Default Company", isActive: true },
  });
  console.log("Default tenant:", defaultTenant.id);

  const lodhiTenant = await prisma.tenant.upsert({
    where: { slug: "lodhi-tools" },
    update: {},
    create: { slug: "lodhi-tools", name: "Lodhi Tools", isActive: true },
  });
  console.log("Lodhi Tools tenant:", lodhiTenant.id);

  const qistFlowTenant = await prisma.tenant.upsert({
    where: { slug: "qist-flow-27" },
    update: {},
    create: { slug: "qist-flow-27", name: "Qist Flow", isActive: true },
  });
  console.log("Qist Flow tenant:", qistFlowTenant.id);

  console.log("Migrating existing data to default tenant...");
  const results = await Promise.all([
    prisma.user.updateMany({ where: {}, data: { tenantId: "default" } }),
    prisma.customer.updateMany({ where: {}, data: { tenantId: "default" } }),
    prisma.excelImport.updateMany({ where: {}, data: { tenantId: "default" } }),
    prisma.messageQueue.updateMany({ where: {}, data: { tenantId: "default" } }),
    prisma.messageLog.updateMany({ where: {}, data: { tenantId: "default" } }),
    prisma.activityLog.updateMany({ where: {}, data: { tenantId: "default" } }),
    prisma.backupSnapshot.updateMany({ where: {}, data: { tenantId: "default" } }),
    prisma.messageTemplate.updateMany({ where: {}, data: { tenantId: "default" } }),
    prisma.reminderRule.updateMany({ where: {}, data: { tenantId: "default" } }),
    prisma.whatsAppSession.updateMany({ where: {}, data: { tenantId: "default" } }),
    prisma.systemSetting.updateMany({ where: {}, data: { tenantId: "default" } }),
  ]);

  const labels = ["Users","Customers","ExcelImports","MessageQueues","MessageLogs","ActivityLogs","Backups","Templates","Rules","WhatsAppSessions","SystemSettings"];
  results.forEach((r, i) => console.log(`${labels[i]}: ${r.count} migrated`));

  console.log("Migration Complete!");
}

main().catch((e) => { console.error("Failed:", e); process.exit(1); }).finally(() => prisma.$disconnect());
