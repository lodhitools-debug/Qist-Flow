import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider-factory";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const provider = getWhatsAppProvider();

    // 1. Mark session as CONNECTING in database
    await prisma.whatsAppSession.upsert({
      where: { id: "default" },
      update: {
        status: "CONNECTING",
        qrCode: null,
        errorMessage: null,
        updatedAt: new Date(),
      },
      create: {
        id: "default",
        status: "CONNECTING",
      },
    }).catch(() => {});

    // 2. Initialize provider (Local or Remote AlwaysData worker)
    try {
      await provider.init();
    } catch (initErr: any) {
      console.warn("[WhatsApp Connect Warning]:", initErr.message);
    }

    await logActivity({
      userId: session?.userId,
      action: "WHATSAPP_CONNECT_INIT",
      details: { provider: provider.name },
    }).catch(() => {});

    const info = await provider.getConnectedInfo();

    return NextResponse.json({
      success: true,
      message: "WhatsApp connection initialized. Awaiting QR code generation...",
      ...info,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        status: "CONNECTING",
        error: error.message || "Failed to initialize WhatsApp connection",
      },
      { status: 200 } // Return 200 with error payload so frontend safely parses JSON
    );
  }
}
