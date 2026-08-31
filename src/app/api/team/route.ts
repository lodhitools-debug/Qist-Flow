import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || (session.role !== "ADMIN" && session.role !== "MANAGER")) {
      return NextResponse.json(
        { success: false, error: "Access denied. Only Admins and Managers can access team portfolios." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    let targetManagerId = session.userId;

    if (session.role === "ADMIN") {
      const qManager = searchParams.get("managerId");
      if (qManager) {
        targetManagerId = qManager;
      } else {
        // Find first manager or return all managers
        const firstManager = await prisma.user.findFirst({
          where: { role: "MANAGER", isActive: true },
          select: { id: true },
        });
        if (firstManager) targetManagerId = firstManager.id;
      }
    }

    // Get manager profile
    const manager = await prisma.user.findUnique({
      where: { id: targetManagerId },
      select: { id: true, name: true, email: true, branch: true, role: true },
    });

    if (!manager) {
      return NextResponse.json({
        success: true,
        manager: null,
        teamMembers: [],
        metrics: { totalCustomers: 0, dueToday: 0, overdue: 0, totalOutstanding: 0 },
      });
    }

    // Get all officers in this team
    const officers = await prisma.user.findMany({
      where: {
        managerId: targetManagerId,
        role: "RECOVERY_OFFICER",
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        employeeCode: true,
        branch: true,
        isActive: true,
        lastLoginAt: true,
        assignedCustomers: {
          select: {
            id: true,
            installments: {
              select: {
                emi: true,
                balance: true,
                status: true,
                dueDate: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

    // Calculate per-officer and aggregate metrics
    let teamTotalCustomers = 0;
    let teamDueToday = 0;
    let teamOverdue = 0;
    let teamOutstanding = 0;

    const teamMembers = officers.map((off) => {
      const customerCount = off.assignedCustomers.length;
      let offDueToday = 0;
      let offOverdue = 0;
      let offBalance = 0;

      off.assignedCustomers.forEach((c) => {
        c.installments.forEach((inst) => {
          offBalance += inst.balance || 0;
          if (inst.status === "DUE_TODAY") offDueToday++;
          if (inst.status === "OVERDUE") offOverdue++;
        });
      });

      teamTotalCustomers += customerCount;
      teamDueToday += offDueToday;
      teamOverdue += offOverdue;
      teamOutstanding += offBalance;

      return {
        id: off.id,
        name: off.name,
        email: off.email,
        phone: off.phone,
        employeeCode: off.employeeCode,
        branch: off.branch,
        isActive: off.isActive,
        lastLoginAt: off.lastLoginAt,
        customersCount: customerCount,
        dueTodayCount: offDueToday,
        overdueCount: offOverdue,
        totalBalance: offBalance,
      };
    });

    return NextResponse.json({
      success: true,
      manager,
      teamMembers,
      metrics: {
        totalOfficers: officers.length,
        totalCustomers: teamTotalCustomers,
        dueToday: teamDueToday,
        overdue: teamOverdue,
        totalOutstanding: teamOutstanding,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load team data" },
      { status: 500 }
    );
  }
}
