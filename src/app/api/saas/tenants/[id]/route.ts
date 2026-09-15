import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/saas/tenants/[id] — single tenant full detail
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { errorResponse } = await requireSuperAdmin(req);
  if (errorResponse) return errorResponse;

  const tenant = await prisma.tenant.findUnique({
    where: { id: params.id },
    include: {
      users: {
        select: {
          id: true, name: true, email: true, role: true,
          isActive: true, lastLoginAt: true, createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: { customers: true, messageLogs: true, messageQueues: true },
      },
    },
  });

  if (!tenant) {
    return NextResponse.json({ success: false, error: "Tenant not found." }, { status: 404 });
  }

  // Activity stats
  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0));
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [sentToday, sentThisWeek, recentActivity] = await Promise.all([
    prisma.messageLog.count({ where: { tenantId: params.id, sentAt: { gte: todayStart } } }),
    prisma.messageLog.count({ where: { tenantId: params.id, sentAt: { gte: weekStart } } }),
    prisma.activityLog.findMany({
      where: { tenantId: params.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { action: true, details: true, createdAt: true, user: { select: { name: true } } },
    }),
  ]);

  return NextResponse.json({
    success: true,
    tenant,
    stats: { sentToday, sentThisWeek },
    recentActivity,
  });
}

// PATCH /api/saas/tenants/[id] — update tenant
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { errorResponse } = await requireSuperAdmin(req);
  if (errorResponse) return errorResponse;

  const body = await req.json();
  const {
    name, plan, maxUsers, maxCustomers,
    contactEmail, contactPhone, address,
    logoUrl, primaryColor, billingNote,
    subscriptionStartAt, subscriptionEndAt,
    isActive,
  } = body;

  const updated = await prisma.tenant.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(plan !== undefined && { plan }),
      ...(maxUsers !== undefined && { maxUsers }),
      ...(maxCustomers !== undefined && { maxCustomers }),
      ...(contactEmail !== undefined && { contactEmail }),
      ...(contactPhone !== undefined && { contactPhone }),
      ...(address !== undefined && { address }),
      ...(logoUrl !== undefined && { logoUrl }),
      ...(primaryColor !== undefined && { primaryColor }),
      ...(billingNote !== undefined && { billingNote }),
      ...(subscriptionStartAt !== undefined && { subscriptionStartAt: new Date(subscriptionStartAt) }),
      ...(subscriptionEndAt !== undefined && { subscriptionEndAt: new Date(subscriptionEndAt) }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  return NextResponse.json({ success: true, tenant: updated });
}

// DELETE /api/saas/tenants/[id] — hard delete tenant and all its data
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { errorResponse } = await requireSuperAdmin(req);
  if (errorResponse) return errorResponse;

  const tenantId = params.id;

  if (tenantId === "default") {
    return NextResponse.json({ success: false, error: "Cannot delete the core system tenant." }, { status: 403 });
  }

  // We must delete all related data manually because relations have onDelete: Restrict
  await prisma.$transaction([
    prisma.messageLog.deleteMany({ where: { tenantId } }),
    prisma.messageQueue.deleteMany({ where: { tenantId } }),
    prisma.whatsAppSession.deleteMany({ where: { tenantId } }),
    prisma.activityLog.deleteMany({ where: { tenantId } }),
    prisma.customerAssignment.deleteMany({ where: { customer: { tenantId } } }),
    prisma.payment.deleteMany({ where: { customer: { tenantId } } }),
    prisma.installment.deleteMany({ where: { customer: { tenantId } } }),
    prisma.customer.deleteMany({ where: { tenantId } }),
    prisma.excelImportRow.deleteMany({ where: { excelImport: { tenantId } } }),
    prisma.excelImport.deleteMany({ where: { tenantId } }),
    prisma.backupSnapshot.deleteMany({ where: { tenantId } }),
    prisma.reminderRule.deleteMany({ where: { tenantId } }),
    prisma.messageTemplate.deleteMany({ where: { tenantId } }),
    prisma.systemSetting.deleteMany({ where: { tenantId } }),
    prisma.passwordResetToken.deleteMany({ where: { user: { tenantId } } }),
    prisma.user.deleteMany({ where: { tenantId } }),
    prisma.invoice.deleteMany({ where: { tenantId } }),
    prisma.subscription.deleteMany({ where: { tenantId } }),
    prisma.supportTicket.deleteMany({ where: { tenantId } }),
    prisma.whatsAppAccountStatus.deleteMany({ where: { tenantId } }),
    prisma.usageMetric.deleteMany({ where: { tenantId } }),
    prisma.saaSAuditLog.deleteMany({ where: { tenantId } }),
    prisma.tenant.delete({ where: { id: tenantId } })
  ]);

  return NextResponse.json({ success: true, message: "Tenant and all its data permanently deleted." });
}
