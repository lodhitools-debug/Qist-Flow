import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider-factory";
import { getQueueStats } from "@/lib/whatsapp/message-queue";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // 1. Fetch live DB session record (synced with AlwaysData / Baileys worker)
    const dbSession = await prisma.whatsAppSession.findUnique({
      where: { id: "default" },
    }).catch(() => null);

    // 2. Fetch live queue metrics
    const queueStats = await getQueueStats().catch(() => ({
      queued: 0,
      sending: 0,
      sentToday: 0,
      failedToday: 0,
    }));

    // 3. Check provider state
    let providerName = "WhatsApp Web (Baileys)";
    let liveInfo: any = {};
    try {
      const provider = getWhatsAppProvider();
      providerName = provider.name;
      liveInfo = await provider.getConnectedInfo().catch(() => ({}));
    } catch {}

    const finalStatus = liveInfo.status || dbSession?.status || "DISCONNECTED";
    const finalQrCode = liveInfo.qrCode || dbSession?.qrCode || null;

    return NextResponse.json({
      success: true,
      providerName,
      status: finalStatus,
      qrCode: finalQrCode,
      phone: liveInfo.phone || dbSession?.connectedPhone || null,
      name: liveInfo.name || dbSession?.connectedName || null,
      connectedAt: liveInfo.connectedAt || dbSession?.connectedAt || null,
      lastActiveAt: liveInfo.lastActiveAt || dbSession?.lastActiveAt || null,
      errorMessage: liveInfo.errorMessage || dbSession?.errorMessage || null,
      queueStats,
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
