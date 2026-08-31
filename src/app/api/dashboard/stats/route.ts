import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getUserCustomerScope } from "@/lib/rbac";
import { startOfDay, endOfDay } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const customerScope = session ? getUserCustomerScope(session) : {};

    // 1. Customer Counts & Assignments
    const [totalCustomers, assignedCustomers] = await Promise.all([
      prisma.customer.count({ where: customerScope }),
      prisma.customer.count({
        where: {
          ...customerScope,
          assignedToUserId: { not: null },
        },
      }),
    ]);

    // 2. Installment Status Counts within scope
    const [
      dueTodayCount,
      overdueCount,
      paidCount,
      upcomingCount,
      partialCount,
      unknownCount,
    ] = await Promise.all([
      prisma.installment.count({ where: { status: "DUE_TODAY", customer: customerScope } }),
      prisma.installment.count({ where: { status: "OVERDUE", customer: customerScope } }),
      prisma.installment.count({ where: { status: "PAID", customer: customerScope } }),
      prisma.installment.count({ where: { status: "UPCOMING", customer: customerScope } }),
      prisma.installment.count({ where: { status: "PARTIAL", customer: customerScope } }),
      prisma.installment.count({ where: { status: "UNKNOWN", customer: customerScope } }),
    ]);

    const pendingCount = dueTodayCount + overdueCount + upcomingCount + partialCount;

    // 3. Financial Totals within scope
    const [totalOutstandingAgg, todayRecoveryAgg, totalRecoveryAgg] = await Promise.all([
      prisma.installment.aggregate({
        where: { customer: customerScope },
        _sum: { balance: true },
      }),
      prisma.payment.aggregate({
        where: {
          customer: customerScope,
          paymentDate: { gte: todayStart, lte: todayEnd },
        },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { customer: customerScope },
        _sum: { amount: true },
      }),
    ]);

    // 4. WhatsApp Stats Today within scope
    const [waSentToday, waFailedToday, waQueued] = await Promise.all([
      prisma.messageLog.count({
        where: {
          customer: customerScope,
          status: "SENT",
          sentAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.messageLog.count({
        where: {
          customer: customerScope,
          status: "FAILED",
          sentAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.messageQueue.count({
        where: {
          customer: customerScope,
          status: "QUEUED",
        },
      }),
    ]);

    // 5. Due Today Priority Customers
    const dueTodayCustomers = await prisma.installment.findMany({
      where: { status: "DUE_TODAY", customer: customerScope },
      include: { customer: true },
      take: 8,
      orderBy: { emi: "desc" },
    });

    // 6. Overdue High-Priority Customers
    const overdueCustomers = await prisma.installment.findMany({
      where: { status: "OVERDUE", customer: customerScope },
      include: { customer: true },
      take: 8,
      orderBy: { balance: "desc" },
    });

    // 7. Recovery Officer Performance
    const recoveryOfficers = await prisma.customer.groupBy({
      by: ["recoveryPerson"],
      where: {
        ...customerScope,
        recoveryPerson: { not: null },
      },
      _count: { _all: true },
    });

    const officerStats = await Promise.all(
      recoveryOfficers.slice(0, 5).map(async (ro) => {
        const officerName = ro.recoveryPerson || "Unassigned";
        const customerIds = (
          await prisma.customer.findMany({
            where: {
              ...customerScope,
              recoveryPerson: officerName,
            },
            select: { id: true },
          })
        ).map((c) => c.id);

        const [officerDue, officerOverdue] = await Promise.all([
          prisma.installment.count({
            where: { customerId: { in: customerIds }, status: "DUE_TODAY" },
          }),
          prisma.installment.count({
            where: { customerId: { in: customerIds }, status: "OVERDUE" },
          }),
        ]);

        return {
          name: officerName,
          totalAccounts: ro._count._all,
          dueToday: officerDue,
          overdue: officerOverdue,
        };
      })
    );

    return NextResponse.json({
      success: true,
      role: session?.role || "ADMIN",
      summary: {
        totalCustomers,
        assignedCustomers,
        dueToday: dueTodayCount,
        dueTodayCount,
        overdue: overdueCount,
        overdueCount,
        paidCount,
        upcomingCount,
        partialCount,
        unknownCount,
        pendingCount,
        totalOutstanding: totalOutstandingAgg._sum.balance || 0,
        todayRecovery: todayRecoveryAgg._sum.amount || 0,
        totalRecovery: totalRecoveryAgg._sum.amount || 0,
        waSentToday,
        waFailedToday,
        waQueued,
      },
      priorityLists: {
        dueToday: dueTodayCustomers,
        overdue: overdueCustomers,
      },
      officerPerformance: officerStats,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load dashboard metrics" },
      { status: 500 }
    );
  }
}
