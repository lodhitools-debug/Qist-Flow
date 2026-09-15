import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/saas/tenants — list all tenants with stats
export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireSuperAdmin(req);
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const plan = searchParams.get("plan") || "";
  const status = searchParams.get("status") || "";

  const where: Record<string, unknown> = { isDeleted: false };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
      { contactEmail: { contains: search, mode: "insensitive" } },
    ];
  }
  if (plan) where.plan = plan;
  if (status === "active") where.isActive = true;
  if (status === "inactive") where.isActive = false;

  try {
    const tenants = await prisma.tenant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        plan: true,
        maxUsers: true,
        maxCustomers: true,
        contactEmail: true,
        contactPhone: true,
        address: true,
        logoUrl: true,
        primaryColor: true,
        subscriptionStartAt: true,
        subscriptionEndAt: true,
        billingNote: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: { where: { isActive: true } },
            customers: true,
            messageLogs: true,
          },
        },
      },
    });

    // We will add computed stats logic below

    const tenantsWithStats = await Promise.all(
      tenants.map(async (tenant) => {
        const [adminUser, sentToday] = await Promise.all([
          prisma.user.findFirst({
            where: { tenantId: tenant.id, role: "ADMIN" },
            select: { name: true, email: true, lastLoginAt: true },
          }),
          prisma.messageLog.count({
            where: {
              tenantId: tenant.id,
              sentAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
            },
          }).catch(() => 0),
        ]);

        return {
          ...tenant,
          adminUser,
          sentToday,
        };
      })
    );

    return NextResponse.json({ success: true, tenants: tenantsWithStats });
  } catch (error: any) {
    console.error("[SaaS Tenants GET Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch tenants." },
      { status: 500 }
    );
  }
}

// POST /api/saas/tenants — create a new tenant + admin user
export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireSuperAdmin(req);
  if (errorResponse) return errorResponse;

  const body = await req.json();
  const {
    name,
    slug,
    plan = "FREE",
    maxUsers = 10,
    maxCustomers = 1000,
    contactEmail,
    contactPhone,
    address,
    primaryColor = "#10b981",
    // Admin user info
    adminName,
    adminEmail,
    adminPassword,
  } = body;

  if (!name || !slug || !adminName || !adminEmail || !adminPassword) {
    return NextResponse.json(
      { success: false, error: "name, slug, adminName, adminEmail, adminPassword are required." },
      { status: 400 }
    );
  }

  // Check slug uniqueness
  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json(
      { success: false, error: "Slug already taken. Choose a different one." },
      { status: 409 }
    );
  }

  // Check email uniqueness
  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existingUser) {
    return NextResponse.json(
      { success: false, error: "Admin email already registered." },
      { status: 409 }
    );
  }

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  // Create tenant + admin user in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name,
        slug,
        plan,
        maxUsers,
        maxCustomers,
        contactEmail,
        contactPhone,
        address,
        primaryColor,
        isActive: true,
        subscriptionStartAt: new Date(),
      },
    });

    const admin = await tx.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        passwordHash,
        role: "ADMIN",
        tenantId: tenant.id,
        isActive: true,
      },
    });

    return { tenant, admin };
  });

  return NextResponse.json(
    {
      success: true,
      tenant: result.tenant,
      admin: { id: result.admin.id, name: result.admin.name, email: result.admin.email },
    },
    { status: 201 }
  );
}
