import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const totalTenants = await prisma.tenant.count({ where: { isDeleted: false } });
    const activeTenants = await prisma.tenant.count({ where: { status: "ACTIVE", isDeleted: false } });
    const totalUsers = await prisma.user.count();
    const totalCustomers = await prisma.customer.count();

    // Latest tenants
    const recentTenants = await prisma.tenant.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        plan: true
      }
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalTenants,
        activeTenants,
        totalUsers,
        totalCustomers,
      },
      recentTenants
    });
  } catch (error: any) {
    console.error("[SAAS_STATS_GET]", error);
    return NextResponse.json({ error: "Failed to fetch saas stats" }, { status: 500 });
  }
}
