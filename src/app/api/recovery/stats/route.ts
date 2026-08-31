import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { startOfDay, endOfDay, subDays } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "TODAY"; // TODAY, YESTERDAY, 7D, 30D

    const now = new Date();
    let startDate = startOfDay(now);
    let endDate = endOfDay(now);

    if (range === "YESTERDAY") {
      startDate = startOfDay(subDays(now, 1));
      endDate = endOfDay(subDays(now, 1));
    } else if (range === "7D") {
      startDate = startOfDay(subDays(now, 7));
      endDate = endOfDay(now);
    } else if (range === "30D") {
      startDate = startOfDay(subDays(now, 30));
      endDate = endOfDay(now);
    }

    const [
      customerSent,
      guarantorSent,
      guarantorFailed,
      pendingApprovals,
      activeOverdueAccounts,
    ] = await Promise.all([
      // Customer Sent
      prisma.messageLog.count({
        where: {
          recipientType: "CUSTOMER",
          status: "SENT",
          sentAt: { gte: startDate, lte: endDate },
        },
      }),
      // Guarantor Sent
      prisma.messageLog.count({
        where: {
          recipientType: { in: ["GUARANTOR_1", "GUARANTOR_2"] },
          status: "SENT",
          sentAt: { gte: startDate, lte: endDate },
        },
      }),
      // Guarantor Failed
      prisma.messageLog.count({
        where: {
          recipientType: { in: ["GUARANTOR_1", "GUARANTOR_2"] },
          status: "FAILED",
          sentAt: { gte: startDate, lte: endDate },
        },
      }),
      // Pending Approvals
      prisma.messageQueue.count({
        where: {
          approvalStatus: "PENDING_APPROVAL",
          status: "QUEUED",
        },
      }),
      // Active Overdue Accounts
      prisma.installment.count({
        where: {
          dueDate: { lt: startOfDay(now) },
          balance: { gt: 0 },
          customer: { optedOut: false },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      range,
      stats: {
        customerSent,
        guarantorSent,
        guarantorFailed,
        pendingApprovals,
        activeOverdueAccounts,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load recovery stats" },
      { status: 500 }
    );
  }
}
