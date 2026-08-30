import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider-factory";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const provider = getWhatsAppProvider();

    // Start connection / QR generation
    await provider.init();

    await logActivity({
      userId: session?.userId,
      action: "WHATSAPP_CONNECT_INIT",
      details: { provider: provider.name },
    });

    const info = await provider.getConnectedInfo();

    return NextResponse.json({
      success: true,
      message: "WhatsApp connection initialized. Please scan the QR code.",
      ...info,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to initialize WhatsApp connection" }, { status: 500 });
  }
}
