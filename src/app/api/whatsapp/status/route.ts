import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  const userId = user.userId;
  if (!userId) {
    return NextResponse.json({ success: false, error: "Session expired. Please log in again." }, { status: 401 });
  }

  try {
    const dbSession = await prisma.whatsAppSession.findUnique({
      where: { userId },
    }).catch(() => null);

    // Queue stats scoped to this user AND tenant
    let queueStats = { queued: 0, sending: 0, sentToday: 0, failedToday: 0 };
    const tenantId = user.tenantId;
    try {
      const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
      const [queued, sending, sentToday, failedToday] = await Promise.all([
        prisma.messageQueue.count({ where: { senderUserId: userId, tenantId, status: "QUEUED" } }),
        prisma.messageQueue.count({ where: { senderUserId: userId, tenantId, status: "SENDING" } }),
        prisma.messageLog.count({ where: { tenantId, sentAt: { gte: todayStart } } }),
        prisma.messageLog.count({ where: { tenantId, status: "FAILED", sentAt: { gte: todayStart } } }),
      ]);
      queueStats = { queued, sending, sentToday, failedToday };
    } catch {}

    const token = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN || "EAAZA8rZAVvxkABSkJZA30xX7Tf2LzUXISuvkWAZCQ6u6RoSnpCwgCGPGcZCZCErREoueVnxFp0OlGwBNpkXdYyaiXOkVLZCHzGEi1M0GYDn8ZBTqTvcDm2DeNzZAwaDKZBKzZAMAnxcYYDQeQsIbOnbkGfeukxvI4lxM3INPcD8lYk4c1Po2WYWpeHjj0TIPrM1nIYZChDlJveqvF9G0AjnbtndIju5WBA6o6ZBBTYhtMptZB0Wi4W1KhLQ12OJkEzgnZBJoz5gZAgT1k0ZC7CLilfKoKFcV78Ot6";
    const phoneId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID || "1328348923692461";
    
    const hasCloudCreds = !!(token && phoneId);
    const isConnected = hasCloudCreds || (dbSession?.status === "CONNECTED" && !!dbSession?.connectedPhone);
    let computedStatus = isConnected ? "CONNECTED" : (dbSession?.status || "NOT_CONNECTED");

    // Clear expired QR from DB
    let qrCode = dbSession?.qrCode || null;
    if (dbSession?.qrExpiresAt && new Date() > dbSession.qrExpiresAt && computedStatus === "QR_READY") {
      qrCode = null;
      computedStatus = "NOT_CONNECTED";
      prisma.whatsAppSession.update({
        where: { userId },
        data: { qrCode: null, status: "NOT_CONNECTED" },
      }).catch(() => {});
    }

    return NextResponse.json(
      {
        success: true,
        status: computedStatus,
        qrCode: isConnected ? null : qrCode,
        qrExpiresAt: dbSession?.qrExpiresAt || null,
        pairingCode: isConnected ? null : (dbSession?.pairingCode || null),
        phone: hasCloudCreds ? "Cloud API" : (dbSession?.connectedPhone || null),
        name: hasCloudCreds ? "Meta Business" : (dbSession?.connectedName || null),
        connectedAt: dbSession?.connectedAt || null,
        lastDisconnectedAt: dbSession?.lastDisconnectedAt || null,
        errorMessage: dbSession?.errorMessage || null,
        queueStats,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error: any) {
    console.error(`[WhatsApp Status] userId=${userId}:`, error.message);
    return NextResponse.json(
      { success: false, status: "ERROR", error: "Failed to fetch status. Please refresh." },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
