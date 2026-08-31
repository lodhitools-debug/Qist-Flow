import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req, ["ADMIN", "MANAGER"]);
  if (auth.errorResponse) return auth.errorResponse;
  const user = auth.user;

  try {
    const queueId = params.id;
    const body = await req.json().catch(() => ({}));
    const { action, editedMessageText, rejectionReason } = body; // action: "APPROVE" | "REJECT" | "EDIT"

    const item = await prisma.messageQueue.findUnique({
      where: { id: queueId },
      include: { customer: true },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: "Escalation message not found" },
        { status: 404 }
      );
    }

    if (action === "EDIT") {
      if (!editedMessageText || typeof editedMessageText !== "string") {
        return NextResponse.json(
          { success: false, error: "editedMessageText is required" },
          { status: 400 }
        );
      }

      const updated = await prisma.messageQueue.update({
        where: { id: queueId },
        data: {
          messageText: editedMessageText.trim(),
        },
      });

      await logActivity({
        userId: user.userId,
        action: "GUARANTOR_ESCALATION_MESSAGE_EDITED",
        entityType: "MessageQueue",
        entityId: queueId,
        details: { customerAccount: item.customer?.account },
        ipAddress: req.headers.get("x-forwarded-for") || undefined,
      });

      return NextResponse.json({
        success: true,
        message: "Message updated successfully",
        data: updated,
      });
    }

    if (action === "APPROVE") {
      const updated = await prisma.messageQueue.update({
        where: { id: queueId },
        data: {
          approvalStatus: "APPROVED",
          approvedByUserId: user.userId,
          approvedAt: new Date(),
          status: "QUEUED",
          messageText: editedMessageText ? editedMessageText.trim() : item.messageText,
        },
      });

      await logActivity({
        userId: user.userId,
        action: "GUARANTOR_ESCALATION_APPROVED",
        entityType: "MessageQueue",
        entityId: queueId,
        details: { customerAccount: item.customer?.account, recipientPhone: item.recipientPhone },
        ipAddress: req.headers.get("x-forwarded-for") || undefined,
      });

      return NextResponse.json({
        success: true,
        message: "Escalation approved and queued for AlwaysData worker dispatch",
        data: updated,
      });
    }

    if (action === "REJECT") {
      const updated = await prisma.messageQueue.update({
        where: { id: queueId },
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
        action: "GUARANTOR_ESCALATION_REJECTED",
        entityType: "MessageQueue",
        entityId: queueId,
        details: { customerAccount: item.customer?.account, rejectionReason },
        ipAddress: req.headers.get("x-forwarded-for") || undefined,
      });

      return NextResponse.json({
        success: true,
        message: "Escalation rejected and cancelled",
        data: updated,
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action. Must be 'APPROVE', 'REJECT', or 'EDIT'" },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update escalation approval" },
      { status: 500 }
    );
  }
}
