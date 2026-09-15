require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function wipeDeletedTenants() {
  const tenants = await prisma.tenant.findMany({
    where: { isDeleted: true }
  });

  for (const tenant of tenants) {
    console.log(`Wiping data for tenant: ${tenant.name} (${tenant.id})`);
    
    await prisma.$transaction([
      prisma.messageLog.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.messageQueue.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.whatsAppSession.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.activityLog.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.customerAssignment.deleteMany({ where: { customer: { tenantId: tenant.id } } }),
      prisma.payment.deleteMany({ where: { customer: { tenantId: tenant.id } } }),
      prisma.installment.deleteMany({ where: { customer: { tenantId: tenant.id } } }),
      prisma.customer.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.excelImportRow.deleteMany({ where: { excelImport: { tenantId: tenant.id } } }),
      prisma.excelImport.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.backupSnapshot.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.reminderRule.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.messageTemplate.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.systemSetting.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.passwordResetToken.deleteMany({ where: { user: { tenantId: tenant.id } } }),
      prisma.user.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.invoice.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.subscription.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.supportTicket.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.whatsAppAccountStatus.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.usageMetric.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.saaSAuditLog.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.tenant.delete({ where: { id: tenant.id } })
    ]);
    console.log(`Wiped ${tenant.name}`);
  }

  console.log('Cleanup complete.');
}

wipeDeletedTenants()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
