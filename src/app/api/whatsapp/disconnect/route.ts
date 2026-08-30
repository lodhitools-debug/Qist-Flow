import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);

    // 1. If AlwaysData remote worker is configured via WHATSAPP_SERVICE_URL, notify it
    const serviceUrl = (process.env.WHATSAPP_SERVICE_URL || "").replace(/\/$/, "");
    if (serviceUrl) {
      try {
        await fetch(`${serviceUrl}/api/wa/disconnect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-whatsapp-secret": process.env.WHATSAPP_SERVICE_SECRET || "",
          },
        });
      } catch (err: any) {
        console.warn("[AlwaysData Worker Disconnect Warning]:", err.message);
      }
    }

    // 2. Set DB session to DISCONNECTED
    await prisma.whatsAppSession.upsert({
      where: { id: "default" },
      update: {
        status: "DISCONNECTED",
        qrCode: null,
        connectedPhone: null,
        connectedName: null,
        errorMessage: null,
        updatedAt: new Date(),
      },
      create: {
        id: "default",
        status: "DISCONNECTED",
      },
    });

    await logActivity({
      userId: session?.userId,
      action: "WHATSAPP_DISCONNECT",
      details: { serviceUrl: serviceUrl || "Supabase DB sync" },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: "WhatsApp session disconnected successfully.",
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to disconnect WhatsApp session",
    });
  }
}
