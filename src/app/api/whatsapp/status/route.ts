import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const [dbSession, queuedCount, sendingCount, sentToday, failedToday] = await Promise.all([
      prisma.whatsAppSession.findUnique({ where: { id: "default" } }),
      prisma.messageQueue.count({ where: { status: "QUEUED" } }),
      prisma.messageQueue.count({ where: { status: "SENDING" } }),
      prisma.messageLog.count({
        where: {
          status: "SENT",
          sentAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      prisma.messageLog.count({
        where: {
          status: "FAILED",
          sentAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      status: dbSession?.status || "DISCONNECTED",
      qrCode: dbSession?.qrCode || null,
      phone: dbSession?.connectedPhone || null,
      name: dbSession?.connectedName || null,
      connectedAt: dbSession?.connectedAt || null,
      lastActiveAt: dbSession?.lastActiveAt || null,
      errorMessage: dbSession?.errorMessage || null,
      queueStats: {
        queued: queuedCount,
        sending: sendingCount,
        sentToday,
        failedToday,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      status: "DISCONNECTED",
      qrCode: null,
      error: error.message || "Failed to retrieve status",
      queueStats: { queued: 0, sending: 0, sentToday: 0, failedToday: 0 },
    });
  }
}
