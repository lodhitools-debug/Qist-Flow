import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const dbSession = await prisma.whatsAppSession.findUnique({
      where: { id: "default" },
    }).catch(() => null);

    let queuedCount = 0;
    let sendingCount = 0;
    let sentToday = 0;
    let failedToday = 0;

    try {
      queuedCount = await prisma.messageQueue.count({ where: { status: "QUEUED" } }).catch(() => 0);
      sendingCount = await prisma.messageQueue.count({ where: { status: "SENDING" } }).catch(() => 0);
      sentToday = await prisma.messageLog.count({
        where: { status: "SENT", sentAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }).catch(() => 0);
      failedToday = await prisma.messageLog.count({
        where: { status: "FAILED", sentAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }).catch(() => 0);
    } catch {}

    const isConnected = !!dbSession?.connectedPhone;
    let computedStatus = isConnected ? "CONNECTED" : (dbSession?.status || "DISCONNECTED");

    // Auto-expire stale CONNECTING status if worker hasn't generated a QR code in 20 seconds
    const updatedAt = dbSession?.updatedAt ? new Date(dbSession.updatedAt).getTime() : 0;
    const now = Date.now();
    let workerOffline = false;

    if (!isConnected && computedStatus === "CONNECTING" && !dbSession?.qrCode && now - updatedAt > 20000) {
      computedStatus = "DISCONNECTED";
      workerOffline = true;
      // Auto-heal DB state
      prisma.whatsAppSession.update({
        where: { id: "default" },
        data: { status: "DISCONNECTED" },
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      status: computedStatus,
      qrCode: isConnected ? null : (dbSession?.qrCode || null),
      pairingCode: isConnected ? null : (dbSession?.pairingCode || null),
      phone: dbSession?.connectedPhone || null,
      name: dbSession?.connectedName || null,
      connectedAt: dbSession?.connectedAt || null,
      lastActiveAt: dbSession?.lastActiveAt || null,
      errorMessage: dbSession?.errorMessage || null,
      workerOffline,
      queueStats: {
        queued: queuedCount,
        sending: sendingCount,
        sentToday,
        failedToday,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: true,
      status: "DISCONNECTED",
      qrCode: null,
      workerOffline: true,
      error: error.message,
      queueStats: { queued: 0, sending: 0, sentToday: 0, failedToday: 0 },
    });
  }
}
