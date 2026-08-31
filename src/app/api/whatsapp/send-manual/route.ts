import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { enqueueMessage } from "@/lib/whatsapp/message-queue";
import { prisma } from "@/lib/prisma";
import { canAccessCustomer } from "@/lib/rbac";
import { getEscalationConfig } from "@/lib/escalation/escalation-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const body = await req.json().catch(() => ({}));
    const customerId = body.customerId;
    const recipientPhone = body.recipientPhone || body.phone;
    const recipientName = body.recipientName;
    const recipientType = body.recipientType || "CUSTOMER";
    const guarantorId = body.guarantorId || (recipientType !== "CUSTOMER" ? recipientType : undefined);
    const messageText = body.messageText || body.message;
    const installmentId = body.installmentId;
    const messageType = body.messageType || (recipientType !== "CUSTOMER" ? "GUARANTOR_FIRST_NOTICE" : "MANUAL");
    const escalationLevel = Number(body.escalationLevel) || (recipientType !== "CUSTOMER" ? 1 : 0);

    if (!recipientPhone || !messageText) {
      return NextResponse.json(
        { success: false, error: "Recipient phone and message text are required" },
        { status: 400 }
      );
    }

    // Role & Customer Scope Authorization Check
    if (session && customerId) {
      const isAllowed = await canAccessCustomer(session, customerId);
      if (!isAllowed) {
        return NextResponse.json(
          {
            success: false,
            error: "Access denied. Customer outside your assigned portfolio.",
          },
          { status: 403 }
        );
      }
    }

    // Normalize phone number to international E.164 without plus: 92300XXXXXXX
    let cleanPhone = String(recipientPhone).replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("03") && cleanPhone.length === 11) {
      cleanPhone = "92" + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith("3") && cleanPhone.length === 10) {
      cleanPhone = "92" + cleanPhone;
    }

    // Check opt-out status
    if (customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { optedOut: true, customerName: true },
      });

      if (customer?.optedOut) {
        return NextResponse.json(
          {
            success: false,
            error: "Customer has opted out of WhatsApp messages.",
          },
          { status: 400 }
        );
      }
    }

    // Check if guarantor escalation requires manager approval
    let approvalStatus: "NOT_REQUIRED" | "PENDING_APPROVAL" = "NOT_REQUIRED";
    if (recipientType !== "CUSTOMER") {
      const escConfig = await getEscalationConfig();
      if (escConfig.requireManagerApproval && session?.role === "RECOVERY_OFFICER") {
        approvalStatus = "PENDING_APPROVAL";
      }
    }

    // Fast queue insertion
    const queueResult = await enqueueMessage({
      recipientPhone: cleanPhone,
      recipientName,
      recipientType,
      guarantorId,
      customerId: customerId || undefined,
      installmentId: installmentId || undefined,
      messageType,
      escalationLevel,
      approvalStatus,
      escalationReason: "Manual Dispatch / Officer Request",
      messageText,
      priority: 100, // Highest priority
    });

    if (!queueResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: queueResult.error || "Failed to queue message",
          isDuplicate: queueResult.isDuplicate,
        },
        { status: 400 }
      );
    }

    // Audit log
    await logActivity({
      userId: session?.userId || null,
      action: approvalStatus === "PENDING_APPROVAL" ? "GUARANTOR_ESCALATION_REQUESTED" : "WHATSAPP_MANUAL_QUEUED",
      entityType: "MessageQueue",
      entityId: queueResult.queueId,
      details: {
        recipientPhone: cleanPhone,
        recipientType,
        guarantorId,
        customerId,
        priority: 100,
        approvalStatus,
      },
    }).catch(() => {});

    // Notify AlwaysData worker if not pending approval
    if (approvalStatus !== "PENDING_APPROVAL") {
      const workerUrl = process.env.WHATSAPP_SERVICE_URL;
      const workerSecret = process.env.WHATSAPP_SERVICE_SECRET;
      if (workerUrl) {
        fetch(`${workerUrl}/api/wa/trigger-queue`, {
          method: "POST",
          headers: {
            "x-whatsapp-secret": workerSecret || "",
          },
          signal: AbortSignal.timeout(1000),
        }).catch(() => {});
      }
    }

    // Return immediate non-blocking JSON response
    return NextResponse.json({
      success: true,
      status: approvalStatus === "PENDING_APPROVAL" ? "PENDING_APPROVAL" : "QUEUED",
      queueId: queueResult.queueId,
      recipientPhone: cleanPhone,
      message:
        approvalStatus === "PENDING_APPROVAL"
          ? "Guarantor escalation notice submitted for Manager Approval."
          : "Message queued successfully. Fast dispatcher is delivering to WhatsApp.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to process message request",
      },
      { status: 500 }
    );
  }
}
