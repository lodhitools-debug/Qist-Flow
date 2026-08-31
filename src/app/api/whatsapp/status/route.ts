import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const dbSession = await prisma.whatsAppSession.findUnique({
      where: { userId: user.userId },
    }).catch(() => null);

    let queuedCount = 0;
    let sendingCount = 0;
    let sentToday = 0;
    let failedToday = 0;

    try {
      queuedCount = await prisma.messageQueue.count({
        where: { senderUserId: user.userId, status: "QUEUED" },
      }).catch(() => 0);
      sendingCount = await prisma.messageQueue.count({
        where: { senderUserId: user.userId, status: "SENDING" },
      }).catch(() => 0);
      sentToday = await prisma.messageLog.count({
        where: { sentAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }).catch(() => 0);
      failedToday = await prisma.messageLog.count({
        where: { status: "FAILED", sentAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }).catch(() => 0);
    } catch {}

    const isConnected = dbSession?.status === "CONNECTED" && !!dbSession?.connectedPhone;
    let computedStatus = isConnected ? "CONNECTED" : (dbSession?.status || "NOT_CONNECTED");

    // Check if QR code has expired
    let qrCode = dbSession?.qrCode || null;
    if (dbSession?.qrExpiresAt && new Date() > dbSession.qrExpiresAt && computedStatus === "QR_READY") {
      qrCode = null;
      computedStatus = "NOT_CONNECTED";
      prisma.whatsAppSession.update({
        where: { userId: user.userId },
        data: { qrCode: null, status: "NOT_CONNECTED" },
      }).catch(() => {});
    }

    return NextResponse.json(
      {
        success: true,
        userId: user.userId,
        userName: user.name,
        status: computedStatus,
        qrCode: isConnected ? null : qrCode,
        qrExpiresAt: dbSession?.qrExpiresAt || null,
        pairingCode: isConnected ? null : (dbSession?.pairingCode || null),
        phone: dbSession?.connectedPhone || null,
        name: dbSession?.connectedName || null,
        connectedAt: dbSession?.connectedAt || null,
        lastDisconnectedAt: dbSession?.lastDisconnectedAt || null,
        lastActiveAt: dbSession?.lastActiveAt || null,
        errorMessage: dbSession?.errorMessage || null,
        queueStats: {
          queued: queuedCount,
          sending: sendingCount,
          sentToday,
          failedToday,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error: any) {
    console.error(`[WhatsApp Status Error] userId=${user.userId}:`, error.message);
    return NextResponse.json(
      {
        success: false,
        error: "WHATSAPP_STATUS_ERROR",
        message: error.message || "Failed to retrieve WhatsApp status",
        status: "ERROR",
        qrCode: null,
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  }
}

