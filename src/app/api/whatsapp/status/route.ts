import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider-factory";
import { getQueueStats } from "@/lib/whatsapp/message-queue";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const provider = getWhatsAppProvider();
    const info = await provider.getConnectedInfo();
    const queueStats = await getQueueStats().catch(() => ({ queued: 0, sending: 0, sent: 0, failed: 0 }));

    return NextResponse.json({
      providerName: provider.name,
      ...info,
      queueStats,
    });
  } catch (error: any) {
    // Database fallback
    const dbSession = await prisma.whatsAppSession.findUnique({ where: { id: "default" } }).catch(() => null);

    return NextResponse.json({
      status: dbSession?.status || "DISCONNECTED",
      qrCode: dbSession?.qrCode || null,
      phone: dbSession?.connectedPhone || undefined,
      name: dbSession?.connectedName || undefined,
      connectedAt: dbSession?.connectedAt || undefined,
      errorMessage: dbSession?.errorMessage || error.message || null,
      queueStats: { queued: 0, sending: 0, sent: 0, failed: 0 },
    });
  }
}
