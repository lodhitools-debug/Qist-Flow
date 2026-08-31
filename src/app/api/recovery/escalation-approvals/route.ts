import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ["ADMIN", "MANAGER"]);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "PENDING_APPROVAL";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "25", 10);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.messageQueue.findMany({
        where: {
          recipientType: { in: ["GUARANTOR_1", "GUARANTOR_2"] },
          approvalStatus: status,
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
            },
          },
        },
        orderBy: [{ scheduledFor: "desc" }],
        skip,
        take: limit,
      }),
      prisma.messageQueue.count({
        where: {
          recipientType: { in: ["GUARANTOR_1", "GUARANTOR_2"] },
          approvalStatus: status,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch escalation approvals" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ["ADMIN", "MANAGER"]);
  if (auth.errorResponse) return auth.errorResponse;
  const user = auth.user;

  try {
    const body = await req.json().catch(() => ({}));
    const { action, queueIds, rejectionReason } = body; // action: "APPROVE" | "REJECT"

    if (!action || !Array.isArray(queueIds) || queueIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "action ('APPROVE' | 'REJECT') and queueIds array are required" },
        { status: 400 }
      );
    }

    if (action === "APPROVE") {
      const updated = await prisma.messageQueue.updateMany({
        where: {
          id: { in: queueIds },
          approvalStatus: "PENDING_APPROVAL",
        },
        data: {
          approvalStatus: "APPROVED",
          approvedByUserId: user.userId,
          approvedAt: new Date(),
          status: "QUEUED", // Eligible for worker dispatch immediately
        },
      });

      await logActivity({
        userId: user.userId,
        action: "GUARANTOR_ESCALATION_BULK_APPROVED",
        entityType: "MessageQueue",
        details: { count: updated.count, queueIds },
        ipAddress: req.headers.get("x-forwarded-for") || undefined,
      });

      return NextResponse.json({
        success: true,
        message: `Successfully approved ${updated.count} guarantor escalation(s).`,
        approvedCount: updated.count,
      });
    } else if (action === "REJECT") {
      const updated = await prisma.messageQueue.updateMany({
        where: {
          id: { in: queueIds },
          approvalStatus: "PENDING_APPROVAL",
        },
        data: {
          approvalStatus: "REJECTED",
          status: "CANCELLED",
          rejectionReason: rejectionReason || "Rejected by Manager",
          approvedByUserId: user.userId,
          approvedAt: new Date(),
        },
      });

      await logActivity({
        userId: user.userId,
        action: "GUARANTOR_ESCALATION_BULK_REJECTED",
        entityType: "MessageQueue",
        details: { count: updated.count, queueIds, rejectionReason },
        ipAddress: req.headers.get("x-forwarded-for") || undefined,
      });

      return NextResponse.json({
        success: true,
        message: `Successfully rejected ${updated.count} guarantor escalation(s).`,
        rejectedCount: updated.count,
      });
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid action. Must be 'APPROVE' or 'REJECT'" },
        { status: 400 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process approval action" },
      { status: 500 }
    );
  }
}
