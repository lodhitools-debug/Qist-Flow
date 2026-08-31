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

    // Execute core aggregates in a single parallel batch
    const [
      totalCustomers,
      assignedCustomers,
      statusGroups,
      totalOutstandingAgg,
      todayRecoveryAgg,
      totalRecoveryAgg,
      waSentToday,
      waFailedToday,
      waQueued,
      dueTodayCustomers,
      overdueCustomers,
      recoveryOfficers,
    ] = await Promise.all([
      // 1. Total & Assigned customers
      prisma.customer.count({ where: customerScope }),
      prisma.customer.count({
        where: {
          ...customerScope,
          assignedToUserId: { not: null },
        },
      }),

      // 2. Single GroupBy for ALL Installment Statuses (eliminates 6 separate count queries)
      prisma.installment.groupBy({
        by: ["status"],
        where: { customer: customerScope },
        _count: { _all: true },
      }),

      // 3. Outstanding balance sum
      prisma.installment.aggregate({
        where: { customer: customerScope },
        _sum: { balance: true },
      }),

      // 4. Today recovery sum
      prisma.payment.aggregate({
        where: {
          customer: customerScope,
          paymentDate: { gte: todayStart, lte: todayEnd },
        },
        _sum: { amount: true },
      }),

      // 5. Total recovery sum
      prisma.payment.aggregate({
        where: { customer: customerScope },
        _sum: { amount: true },
      }),

      // 6. WhatsApp sent count
      prisma.messageLog.count({
        where: {
          customer: customerScope,
          status: "SENT",
          sentAt: { gte: todayStart, lte: todayEnd },
        },
      }),

      // 7. WhatsApp failed count
      prisma.messageLog.count({
        where: {
          customer: customerScope,
          status: "FAILED",
          sentAt: { gte: todayStart, lte: todayEnd },
        },
      }),

      // 8. WhatsApp queued count
      prisma.messageQueue.count({
        where: {
          customer: customerScope,
          status: "QUEUED",
        },
      }),

      // 9. Due Today Priority Customers (with selective projection)
      prisma.installment.findMany({
        where: { status: "DUE_TODAY", customer: customerScope },
        select: {
          id: true,
          emi: true,
          balance: true,
          status: true,
          dueDate: true,
          customer: {
            select: {
              id: true,
              account: true,
              customerName: true,
              primaryPhone: true,
              recoveryPerson: true,
              branch: true,
            },
          },
        },
        take: 8,
        orderBy: { emi: "desc" },
      }),

      // 10. Overdue High-Priority Customers (with selective projection)
      prisma.installment.findMany({
        where: { status: "OVERDUE", customer: customerScope },
        select: {
          id: true,
          emi: true,
          balance: true,
          status: true,
          dueDate: true,
          customer: {
            select: {
              id: true,
              account: true,
              customerName: true,
              primaryPhone: true,
              recoveryPerson: true,
              branch: true,
            },
          },
        },
        take: 8,
        orderBy: { balance: "desc" },
      }),

      // 11. Top Recovery Officers
      prisma.customer.groupBy({
        by: ["recoveryPerson"],
        where: {
          ...customerScope,
          recoveryPerson: { not: null },
        },
        _count: { _all: true },
        take: 5,
        orderBy: { _count: { recoveryPerson: "desc" } },
      }),
    ]);

    // Parse status group counts into dictionary
    const statusMap: Record<string, number> = {};
    for (const sg of statusGroups) {
      statusMap[sg.status] = sg._count._all;
    }

    const dueTodayCount = statusMap["DUE_TODAY"] || 0;
    const overdueCount = statusMap["OVERDUE"] || 0;
    const paidCount = statusMap["PAID"] || 0;
    const upcomingCount = statusMap["UPCOMING"] || 0;
    const partialCount = statusMap["PARTIAL"] || 0;
    const unknownCount = statusMap["UNKNOWN"] || 0;
    const pendingCount = dueTodayCount + overdueCount + upcomingCount + partialCount;

    const officerStats = recoveryOfficers.map((ro) => ({
      name: ro.recoveryPerson || "Unassigned",
      totalAccounts: ro._count._all,
      dueToday: 0,
      overdue: 0,
    }));

    const responseData = {
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
    };

    return new NextResponse(JSON.stringify(responseData), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=3, stale-while-revalidate=15",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load dashboard metrics" },
      { status: 500 }
    );
  }
}
