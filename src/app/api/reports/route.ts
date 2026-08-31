import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getUserCustomerScope } from "@/lib/rbac";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, parseISO, subDays } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const { searchParams } = new URL(req.url);
    const reportType = searchParams.get("type") || "DAILY"; // DAILY, MONTHLY, OFFICERS, WHATSAPP, GUARANTOR_ESCALATION
    const dateStr = searchParams.get("date"); // e.g. "2026-08-31"

    const baseDate = dateStr ? parseISO(dateStr) : new Date();
    const customerScope = session ? getUserCustomerScope(session) : {};

    if (reportType === "GUARANTOR_ESCALATION") {
      const logs = await prisma.messageLog.findMany({
        where: {
          recipientType: { in: ["GUARANTOR_1", "GUARANTOR_2"] },
          customer: customerScope,
        },
        include: {
          customer: {
            include: {
              installments: {
                where: { balance: { gt: 0 } },
                orderBy: { dueDate: "asc" },
                take: 1,
              },
              assignedTo: { select: { id: true, name: true } },
              assignedManager: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { sentAt: "desc" },
        take: 200,
      });

      const rows = logs.map((log) => {
        const cust = log.customer;
        const inst = cust?.installments?.[0];
        return {
          id: log.id,
          customerName: cust?.customerName || "—",
          account: cust?.account || "—",
          overdueAmount: inst?.balance || 0,
          dueDate: inst?.dueDate ? new Date(inst.dueDate).toLocaleDateString("en-PK") : "—",
          guarantorName: log.recipientName || (log.recipientType === "GUARANTOR_1" ? cust?.guarantor1Name : cust?.guarantor2Name) || "Guarantor",
          guarantorPhone: log.recipientPhone,
          guarantorType: log.recipientType,
          escalationLevel: log.escalationLevel || 1,
          messageType: log.messageType,
          status: log.status,
          sentAt: new Date(log.sentAt).toLocaleString("en-PK"),
          recoveryOfficer: cust?.assignedTo?.name || cust?.recoveryPerson || "Unassigned",
          manager: cust?.assignedManager?.name || "—",
          messageText: log.messageText,
        };
      });

      return NextResponse.json({
        reportType: "GUARANTOR_ESCALATION",
        count: rows.length,
        rows,
      });
    }

    if (reportType === "DAILY") {
      const dayStart = startOfDay(baseDate);
      const dayEnd = endOfDay(baseDate);

      const [dueTodayAgg, collectedTodayAgg, overdueAgg, waSent, waFailed, todayInstallments] = await Promise.all([
        prisma.installment.aggregate({
          where: {
            dueDate: { gte: dayStart, lte: dayEnd },
            customer: customerScope,
          },
          _sum: { emi: true },
          _count: { _all: true },
        }),
        prisma.payment.aggregate({
          where: {
            paymentDate: { gte: dayStart, lte: dayEnd },
            customer: customerScope,
          },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        prisma.installment.aggregate({
          where: {
            status: "OVERDUE",
            customer: customerScope,
          },
          _sum: { balance: true },
          _count: { _all: true },
        }),
        prisma.messageLog.count({
          where: {
            status: "SENT",
            sentAt: { gte: dayStart, lte: dayEnd },
            customer: customerScope,
          },
        }),
        prisma.messageLog.count({
          where: {
            status: "FAILED",
            sentAt: { gte: dayStart, lte: dayEnd },
            customer: customerScope,
          },
        }),
        prisma.installment.findMany({
          where: {
            dueDate: { gte: dayStart, lte: dayEnd },
            customer: customerScope,
          },
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
          where: {
            dueDate: { gte: monthStart, lte: monthEnd },
            customer: customerScope,
          },
          _sum: { emi: true },
          _count: { _all: true },
        }),
        prisma.payment.aggregate({
          where: {
            paymentDate: { gte: monthStart, lte: monthEnd },
            customer: customerScope,
          },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        prisma.installment.aggregate({
          where: { customer: customerScope },
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
        where: {
          ...customerScope,
          recoveryPerson: { not: null },
        },
        _count: { _all: true },
      });

      const officerRows = await Promise.all(
        officers.map(async (o) => {
          const officerName = o.recoveryPerson || "Unassigned";
          const customerIds = (
            await prisma.customer.findMany({
              where: {
                ...customerScope,
                recoveryPerson: officerName,
              },
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
        prisma.messageQueue.count({ where: { status: "QUEUED", customer: customerScope } }),
        prisma.messageQueue.count({ where: { status: "SENDING", customer: customerScope } }),
        prisma.messageLog.count({ where: { status: "SENT", customer: customerScope } }),
        prisma.messageLog.count({ where: { status: "FAILED", customer: customerScope } }),
        prisma.messageQueue.count({ where: { status: "CANCELLED", customer: customerScope } }),
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
