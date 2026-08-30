import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, parseISO } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reportType = searchParams.get("type") || "DAILY"; // DAILY, MONTHLY, OFFICERS, WHATSAPP
    const dateStr = searchParams.get("date"); // e.g. "2026-08-31"

    const baseDate = dateStr ? parseISO(dateStr) : new Date();

    if (reportType === "DAILY") {
      const dayStart = startOfDay(baseDate);
      const dayEnd = endOfDay(baseDate);

      const [dueTodayAgg, collectedTodayAgg, overdueAgg, waSent, waFailed, todayInstallments] = await Promise.all([
        prisma.installment.aggregate({
          where: { dueDate: { gte: dayStart, lte: dayEnd } },
          _sum: { emi: true },
          _count: { _all: true },
        }),
        prisma.payment.aggregate({
          where: { paymentDate: { gte: dayStart, lte: dayEnd } },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        prisma.installment.aggregate({
          where: { status: "OVERDUE" },
          _sum: { balance: true },
          _count: { _all: true },
        }),
        prisma.messageLog.count({
          where: { status: "SENT", sentAt: { gte: dayStart, lte: dayEnd } },
        }),
        prisma.messageLog.count({
          where: { status: "FAILED", sentAt: { gte: dayStart, lte: dayEnd } },
        }),
        prisma.installment.findMany({
          where: { dueDate: { gte: dayStart, lte: dayEnd } },
          include: { customer: true },
          take: 50,
        }),
      ]);

      const totalDue = dueTodayAgg._sum.emi || 0;
      const totalCollected = collectedTodayAgg._sum.amount || 0;
      const pending = Math.max(0, totalDue - totalCollected);

      return NextResponse.json({
        reportType: "DAILY",
        date: baseDate.toISOString().split("T")[0],
        metrics: {
          totalDue,
          totalDueCount: dueTodayAgg._count._all,
          totalCollected,
          collectedCount: collectedTodayAgg._count._all,
          pendingAmount: pending,
          totalOverdue: overdueAgg._sum.balance || 0,
          overdueCount: overdueAgg._count._all,
          waSent,
          waFailed,
          recoveryRate: totalDue > 0 ? ((totalCollected / totalDue) * 100).toFixed(1) : "0.0",
        },
        rows: todayInstallments.map((inst) => ({
          account: inst.customer.account,
          customerName: inst.customer.customerName,
          phone: inst.customer.primaryPhone,
          branch: inst.customer.branch,
          recoveryPerson: inst.customer.recoveryPerson || "Unassigned",
          emi: inst.emi,
          balance: inst.balance,
          status: inst.status,
        })),
      });
    }

    if (reportType === "MONTHLY") {
      const monthStart = startOfMonth(baseDate);
      const monthEnd = endOfMonth(baseDate);

      const [monthDueAgg, monthCollectedAgg, totalBalanceAgg] = await Promise.all([
        prisma.installment.aggregate({
          where: { dueDate: { gte: monthStart, lte: monthEnd } },
          _sum: { emi: true },
          _count: { _all: true },
        }),
        prisma.payment.aggregate({
          where: { paymentDate: { gte: monthStart, lte: monthEnd } },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        prisma.installment.aggregate({
          _sum: { balance: true },
        }),
      ]);

      const monthDue = monthDueAgg._sum.emi || 0;
      const monthCollected = monthCollectedAgg._sum.amount || 0;
      const outstanding = totalBalanceAgg._sum.balance || 0;
      const recoveryPercentage = monthDue > 0 ? ((monthCollected / monthDue) * 100).toFixed(1) : "0.0";

      return NextResponse.json({
        reportType: "MONTHLY",
        month: baseDate.toISOString().substring(0, 7),
        metrics: {
          totalInstallmentsCount: monthDueAgg._count._all,
          totalDueAmount: monthDue,
          totalCollectedAmount: monthCollected,
          totalOutstanding: outstanding,
          recoveryPercentage,
        },
      });
    }

    if (reportType === "OFFICERS") {
      const officers = await prisma.customer.groupBy({
        by: ["recoveryPerson"],
        where: { recoveryPerson: { not: null } },
        _count: { _all: true },
      });

      const officerRows = await Promise.all(
        officers.map(async (o) => {
          const officerName = o.recoveryPerson || "Unassigned";
          const customerIds = (
            await prisma.customer.findMany({
              where: { recoveryPerson: officerName },
              select: { id: true },
            })
          ).map((c) => c.id);

          const [dueAgg, collectedAgg, overdueCount] = await Promise.all([
            prisma.installment.aggregate({
              where: { customerId: { in: customerIds } },
              _sum: { emi: true, balance: true },
            }),
            prisma.payment.aggregate({
              where: { customerId: { in: customerIds } },
              _sum: { amount: true },
            }),
            prisma.installment.count({
              where: { customerId: { in: customerIds }, status: "OVERDUE" },
            }),
          ]);

          const totalDue = dueAgg._sum.emi || 0;
          const totalCollected = collectedAgg._sum.amount || 0;
          const outstanding = dueAgg._sum.balance || 0;

          return {
            name: officerName,
            assignedCustomers: o._count._all,
            dueAmount: totalDue,
            collectedAmount: totalCollected,
            outstandingAmount: outstanding,
            overdueCustomers: overdueCount,
            efficiency: totalDue > 0 ? ((totalCollected / totalDue) * 100).toFixed(1) + "%" : "N/A",
          };
        })
      );

      return NextResponse.json({
        reportType: "OFFICERS",
        rows: officerRows,
      });
    }

    if (reportType === "WHATSAPP") {
      const [queued, sending, sent, failed, cancelled] = await Promise.all([
        prisma.messageQueue.count({ where: { status: "QUEUED" } }),
        prisma.messageQueue.count({ where: { status: "SENDING" } }),
        prisma.messageLog.count({ where: { status: "SENT" } }),
        prisma.messageLog.count({ where: { status: "FAILED" } }),
        prisma.messageQueue.count({ where: { status: "CANCELLED" } }),
      ]);

      return NextResponse.json({
        reportType: "WHATSAPP",
        metrics: {
          queued,
          sending,
          sent,
          failed,
          cancelled,
          deliveryRate: sent + failed > 0 ? ((sent / (sent + failed)) * 100).toFixed(1) : "100.0",
        },
      });
    }

    return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to generate report" }, { status: 500 });
  }
}
