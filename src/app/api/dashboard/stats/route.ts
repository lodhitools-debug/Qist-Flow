import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, subDays, format } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    // 1. Customer Counts
    const totalCustomers = await prisma.customer.count();

    // 2. Installment Status Counts
    const [
      dueTodayCount,
      overdueCount,
      paidCount,
      upcomingCount,
      partialCount,
      unknownCount,
    ] = await Promise.all([
      prisma.installment.count({ where: { status: "DUE_TODAY" } }),
      prisma.installment.count({ where: { status: "OVERDUE" } }),
      prisma.installment.count({ where: { status: "PAID" } }),
      prisma.installment.count({ where: { status: "UPCOMING" } }),
      prisma.installment.count({ where: { status: "PARTIAL" } }),
      prisma.installment.count({ where: { status: "UNKNOWN" } }),
    ]);

    const pendingCount = dueTodayCount + overdueCount + upcomingCount + partialCount;

    // 3. Financial Totals
    const [totalOutstandingAgg, todayRecoveryAgg, totalRecoveryAgg] = await Promise.all([
      prisma.installment.aggregate({
        _sum: { balance: true },
      }),
      prisma.payment.aggregate({
        where: {
          paymentDate: { gte: todayStart, lte: todayEnd },
        },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
      }),
    ]);

    // 4. WhatsApp Stats Today
    const [waSentToday, waFailedToday, waQueued] = await Promise.all([
      prisma.messageLog.count({
        where: {
          status: "SENT",
          sentAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.messageLog.count({
        where: {
          status: "FAILED",
          sentAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.messageQueue.count({
        where: { status: "QUEUED" },
      }),
    ]);

    // 5. Due Today Priority Customers
    const dueTodayCustomers = await prisma.installment.findMany({
      where: { status: "DUE_TODAY" },
      include: { customer: true },
      take: 8,
      orderBy: { emi: "desc" },
    });

    // 6. Overdue High-Priority Customers
    const overdueCustomers = await prisma.installment.findMany({
      where: { status: "OVERDUE" },
      include: { customer: true },
      take: 8,
      orderBy: { balance: "desc" },
    });

    // 7. Recovery Officer Performance
    const recoveryOfficers = await prisma.customer.groupBy({
      by: ["recoveryPerson"],
      where: { recoveryPerson: { not: null } },
      _count: { _all: true },
    });

    const officerStats = await Promise.all(
      recoveryOfficers.slice(0, 5).map(async (ro) => {
        const officerName = ro.recoveryPerson || "Unassigned";
        const customerIds = (
          await prisma.customer.findMany({
            where: { recoveryPerson: officerName },
            select: { id: true },
          })
        ).map((c) => c.id);

        const [officerDue, officerOverdue] = await Promise.all([
          prisma.installment.aggregate({
            where: { customerId: { in: customerIds } },
            _sum: { emi: true, balance: true },
          }),
          prisma.installment.count({
            where: { customerId: { in: customerIds }, status: "OVERDUE" },
          }),
        ]);

        return {
          name: officerName,
          totalAssigned: ro._count._all,
          totalOutstanding: officerDue._sum.balance || 0,
          overdueCount: officerOverdue,
        };
      })
    );

    // 8. 7-Day Recovery Trend Chart Data
    const trendLabels: string[] = [];
    const trendData: number[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i);
      trendLabels.push(format(d, "EEE (dd MMM)"));
      const dayStart = startOfDay(d);
      const dayEnd = endOfDay(d);

      const dayPayment = await prisma.payment.aggregate({
        where: { paymentDate: { gte: dayStart, lte: dayEnd } },
        _sum: { amount: true },
      });
      trendData.push(dayPayment._sum.amount || 0);
    }

    return NextResponse.json({
      summary: {
        totalCustomers,
        dueToday: dueTodayCount,
        overdue: overdueCount,
        paid: paidCount,
        upcoming: upcomingCount,
        partial: partialCount,
        unknown: unknownCount,
        pending: pendingCount,
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
      recoveryTrend: {
        labels: trendLabels,
        data: trendData,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load dashboard statistics" }, { status: 500 });
  }
}
