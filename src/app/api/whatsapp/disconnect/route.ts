import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider-factory";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const provider = getWhatsAppProvider();

    await provider.disconnect();

    await logActivity({
      userId: session?.userId,
      action: "WHATSAPP_DISCONNECT",
      details: { provider: provider.name },
    });

    return NextResponse.json({
      success: true,
      message: "WhatsApp session disconnected successfully.",
      status: "DISCONNECTED",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to disconnect WhatsApp" }, { status: 500 });
  }
}
