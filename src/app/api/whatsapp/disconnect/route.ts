import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  const userId = user.userId;
  if (!userId) {
    return NextResponse.json({ success: false, error: "Session expired. Please log in again." }, { status: 401 });
  }

  try {
    const serviceUrl = (process.env.WHATSAPP_SERVICE_URL || "").replace(/\/$/, "");
    const secret = process.env.WHATSAPP_SERVICE_SECRET || "";

    // 1. Tell the worker to close the socket immediately
    if (serviceUrl) {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 5_000);
        await fetch(`${serviceUrl}/api/wa/disconnect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-whatsapp-secret": secret,
          },
          body: JSON.stringify({ userId }),
          signal: controller.signal,
        }).catch(() => {});
        clearTimeout(t);
      } catch {}
    }

    // 2. Update DB — preserve credentials (DISCONNECTED, not LOGGED_OUT)
    await prisma.whatsAppSession.upsert({
      where: { userId },
      update: {
        status: "DISCONNECTED",
        qrCode: null,
        qrExpiresAt: null,
        pairingCode: null,
        lastDisconnectedAt: new Date(),
        errorMessage: null,
        updatedAt: new Date(),
      },
      create: {
        userId,
        status: "DISCONNECTED",
        qrCode: null,
        pairingCode: null,
        requestedPhone: null,
      },
    });

    await logActivity({
      userId,
      action: "WHATSAPP_DISCONNECT",
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      status: "DISCONNECTED",
      message: "WhatsApp disconnected. Your session is preserved — reconnect any time without scanning a new QR.",
    });
  } catch (error: any) {
    console.error(`[WhatsApp Disconnect] userId=${userId}:`, error.message);
    return NextResponse.json(
      { success: false, error: "Failed to disconnect. Please try again." },
      { status: 500 }
    );
  }
}
