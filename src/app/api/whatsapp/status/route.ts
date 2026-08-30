import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider-factory";
import { getQueueStats } from "@/lib/whatsapp/message-queue";

export async function GET(req: NextRequest) {
  try {
    const provider = getWhatsAppProvider();
    const info = await provider.getConnectedInfo();
    const queueStats = await getQueueStats();

    return NextResponse.json({
      providerName: provider.name,
      ...info,
      queueStats,
    });
  } catch (error: any) {
    return NextResponse.json({
      status: "DISCONNECTED",
      error: error.message || "Failed to retrieve WhatsApp status",
    }, { status: 500 });
  }
}
