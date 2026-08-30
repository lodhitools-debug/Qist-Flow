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
        await fetch(`${serviceUrl}/api/wa/connect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-whatsapp-secret": process.env.WHATSAPP_SERVICE_SECRET || "",
          },
        });
      } catch (err: any) {
        console.warn("[AlwaysData Worker Connect Warning]:", err.message);
      }
    }

    // 2. Fetch current session or initialize
    const currentSession = await prisma.whatsAppSession.findUnique({ where: { id: "default" } });
    const targetStatus = currentSession?.status === "QR_READY" ? "QR_READY" : "CONNECTING";

    const updatedSession = await prisma.whatsAppSession.upsert({
      where: { id: "default" },
      update: {
        status: targetStatus,
        errorMessage: null,
        updatedAt: new Date(),
      },
      create: {
        id: "default",
        status: targetStatus,
      },
    });

    await logActivity({
      userId: session?.userId,
      action: "WHATSAPP_CONNECT_INIT",
      details: { serviceUrl: serviceUrl || "Supabase DB sync" },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      status: updatedSession.status,
      qrCode: updatedSession.qrCode,
      message: "WhatsApp connection initialized. Awaiting QR code...",
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      status: "CONNECTING",
      error: error.message || "Failed to initialize WhatsApp connection",
    });
  }
}
