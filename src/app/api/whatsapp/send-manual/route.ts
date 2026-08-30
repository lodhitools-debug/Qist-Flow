import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider-factory";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { enqueueMessage } from "@/lib/whatsapp/message-queue";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const body = await req.json().catch(() => ({}));
    const { customerId, recipientPhone, messageText, installmentId } = body;

    if (!recipientPhone || !messageText) {
      return NextResponse.json(
        { success: false, error: "Recipient phone and message text are required" },
        { status: 400 }
      );
    }

    // Normalize phone number to standard format
    let cleanPhone = String(recipientPhone).replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("03") && cleanPhone.length === 11) {
      cleanPhone = "92" + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith("3") && cleanPhone.length === 10) {
      cleanPhone = "92" + cleanPhone;
    }

    // Check opt-out
    if (customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { optedOut: true, customerName: true },
      });

      if (customer?.optedOut) {
        return NextResponse.json(
          {
            success: false,
            error: "Customer has opted out of WhatsApp reminders. Cannot send message.",
          },
          { status: 400 }
        );
      }
    }

    // Attempt direct dispatch via provider
    let sendResult = { success: false, messageId: undefined as string | undefined, error: undefined as string | undefined };
    try {
      const provider = getWhatsAppProvider();
      const connState = await provider.getConnectionState();

      if (connState === "CONNECTED") {
        const directRes = await provider.sendMessage({
          recipientPhone: cleanPhone,
          messageText,
          customerId,
          installmentId,
        });

        if (directRes && directRes.success) {
          sendResult = {
            success: true,
            messageId: directRes.messageId,
            error: undefined,
          };
        } else {
          sendResult = {
            success: false,
            messageId: undefined,
            error: directRes?.error || "Direct dispatch failed",
          };
        }
      }
    } catch (provErr: any) {
      console.warn("[Send Manual Direct Send Warning]:", provErr.message);
      sendResult = {
        success: false,
        messageId: undefined,
        error: provErr.message,
      };
    }

    if (sendResult.success) {
      // 1. Log sent message in MessageLog
      await prisma.messageLog.create({
        data: {
          direction: "OUTBOUND",
          recipientPhone: cleanPhone,
          customerId: customerId || null,
          messageText,
          messageType: "MANUAL",
          status: "SENT",
          waMessageId: sendResult.messageId || "wa_manual_" + Date.now(),
          sentAt: new Date(),
        },
      }).catch(() => {});

      await logActivity({
        userId: session?.userId,
        action: "MANUAL_MESSAGE",
        entityType: "Customer",
        entityId: customerId,
        details: { recipientPhone: cleanPhone, messageText: messageText.substring(0, 60) + "..." },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        status: "SENT",
        message: "WhatsApp message sent successfully!",
        messageId: sendResult.messageId,
      });
    }

    // Fallback: Enqueue message in persistent MessageQueue for background worker delivery
    const qRes = await enqueueMessage({
      recipientPhone: cleanPhone,
      messageText,
      customerId,
      installmentId,
      messageType: "MANUAL",
      priority: 10, // High priority for manual messages
    });

    if (qRes.success) {
      await logActivity({
        userId: session?.userId,
        action: "MANUAL_MESSAGE_QUEUED",
        entityType: "Customer",
        entityId: customerId,
        details: { recipientPhone: cleanPhone, queueId: qRes.queueId },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        status: "QUEUED",
        message: "Message queued for delivery to WhatsApp.",
        queueId: qRes.queueId,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: qRes.error || "Failed to deliver or queue message",
      },
      { status: 500 }
    );
  } catch (error: any) {
    console.error("[Send Manual Exception]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error occurred while sending message",
      },
      { status: 500 }
    );
  }
}
