import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider-factory";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { enqueueMessage } from "@/lib/whatsapp/message-queue";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const { customerId, recipientPhone, messageText, installmentId } = await req.json();

    if (!recipientPhone || !messageText) {
      return NextResponse.json({ error: "Recipient phone and message text are required" }, { status: 400 });
    }

    if (customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { optedOut: true, customerName: true },
      });

      if (customer?.optedOut) {
        return NextResponse.json({
          error: "Customer has opted out of WhatsApp reminders. Cannot send message.",
        }, { status: 400 });
      }
    }

    const provider = getWhatsAppProvider();
    const connState = await provider.getConnectionState();

    if (connState === "CONNECTED") {
      // Direct send
      const sendRes = await provider.sendMessage({
        recipientPhone,
        messageText,
        customerId,
        installmentId,
      });

      if (sendRes.success) {
        await prisma.messageLog.create({
          data: {
            direction: "OUTBOUND",
            recipientPhone,
            customerId,
            messageText,
            messageType: "MANUAL",
            status: "SENT",
            waMessageId: sendRes.messageId,
          },
        });

        await logActivity({
          userId: session?.userId,
          action: "MANUAL_MESSAGE",
          entityType: "Customer",
          entityId: customerId,
          details: { recipientPhone, messageText: messageText.substring(0, 60) + "..." },
        });

        return NextResponse.json({
          success: true,
          message: "WhatsApp message sent successfully!",
          messageId: sendRes.messageId,
        });
      } else {
        // Enqueue fallback
        const qRes = await enqueueMessage({
          recipientPhone,
          messageText,
          customerId,
          installmentId,
          messageType: "MANUAL",
          priority: 5,
        });

        return NextResponse.json({
          success: true,
          message: "Message queued for delivery due to temporary connection issue.",
          queueId: qRes.queueId,
        });
      }
    } else {
      // WhatsApp not currently connected, queue it
      const qRes = await enqueueMessage({
        recipientPhone,
        messageText,
        customerId,
        installmentId,
        messageType: "MANUAL",
        priority: 5,
      });

      return NextResponse.json({
        success: true,
        message: "Message added to WhatsApp sending queue (will send once WhatsApp is connected).",
        queueId: qRes.queueId,
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to send manual message" }, { status: 500 });
  }
}
