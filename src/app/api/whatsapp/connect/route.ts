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

    const body = await req.json().catch(() => ({}));
    const forceFresh = body.forceFresh === true;

    // Check if already connected — short-circuit
    const current = await prisma.whatsAppSession.findUnique({
      where: { userId },
      select: { status: true, connectedPhone: true, connectedName: true },
    }).catch(() => null);

    if (current?.status === "CONNECTED" && current?.connectedPhone && !forceFresh) {
      return NextResponse.json({
        success: true,
        status: "CONNECTED",
        phone: current.connectedPhone,
        name: current.connectedName,
        message: "WhatsApp is already connected.",
      });
    }

    // Determine target status:
    // - forceFresh, LOGGED_OUT, NOT_CONNECTED, ERROR → INIT_QR (new QR or no creds)
    // - DISCONNECTED (has saved creds, wants to reconnect) → CONNECTING (no QR wipe)
    const needsFreshQr = forceFresh 
      || !current  // no session yet
      || current.status === "LOGGED_OUT"
      || current.status === "NOT_CONNECTED"
      || current.status === "ERROR";
    const targetStatus = needsFreshQr ? "INIT_QR" : "CONNECTING";

    // Set DB to targetStatus so the worker's DB-watch loop or direct call picks it up
    await prisma.whatsAppSession.upsert({
      where: { userId },
      update: {
        status: targetStatus,
        errorMessage: null,
        pairingCode: null,
        requestedPhone: null,
        ...(targetStatus === "INIT_QR" && {
          qrCode: null,
          qrExpiresAt: null,
        }),
        updatedAt: new Date(),
      },
      create: {
        userId,
        status: "INIT_QR",
        errorMessage: null,
        pairingCode: null,
        requestedPhone: null,
        qrCode: null,
      },
    });

    // Notify the AlwaysData worker directly so it does not have to wait for the poll
    if (serviceUrl) {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 5_000);
        await fetch(`${serviceUrl}/api/wa/connect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-whatsapp-secret": secret,
          },
          body: JSON.stringify({ userId, forceFresh }),
          signal: controller.signal,
        }).catch(() => {});
        clearTimeout(t);
      } catch {}
    }

    await logActivity({
      userId,
      action: forceFresh ? "WHATSAPP_CONNECT_INIT" : "WHATSAPP_RECONNECT",
      details: { worker: !!serviceUrl, forceFresh },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      status: targetStatus,
      message: targetStatus === "INIT_QR" ? "Connecting to WhatsApp... QR code will appear shortly." : "Reconnecting to WhatsApp...",
    });
  } catch (error: any) {
    console.error(`[WhatsApp Connect] userId=${userId}:`, error.message);
    return NextResponse.json(
      { success: false, error: "Failed to start WhatsApp connection. Please try again." },
      { status: 500 }
    );
  }
}
