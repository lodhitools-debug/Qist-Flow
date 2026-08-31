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

    // Check if already connected — short-circuit
    const current = await prisma.whatsAppSession.findUnique({
      where: { userId },
      select: { status: true, connectedPhone: true, connectedName: true },
    }).catch(() => null);

    if (current?.status === "CONNECTED" && current?.connectedPhone) {
      return NextResponse.json({
        success: true,
        status: "CONNECTED",
        phone: current.connectedPhone,
        name: current.connectedName,
        message: "WhatsApp is already connected.",
      });
    }

    // Set DB to INIT_QR so the worker's DB-watch loop or direct call picks it up
    await prisma.whatsAppSession.upsert({
      where: { userId },
      update: {
        status: "INIT_QR",
        errorMessage: null,
        pairingCode: null,
        requestedPhone: null,
        qrCode: null,
        qrExpiresAt: null,
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

    // Notify the AlwaysData worker directly so it does not have to wait for the 2s poll
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
          body: JSON.stringify({ userId, forceFresh: true }),
          signal: controller.signal,
        }).catch(() => {});
        clearTimeout(t);
      } catch {}
    }

    await logActivity({
      userId,
      action: "WHATSAPP_CONNECT_INIT",
      details: { worker: !!serviceUrl },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      status: "INIT_QR",
      message: "Connecting to WhatsApp... QR code will appear shortly.",
    });
  } catch (error: any) {
    console.error(`[WhatsApp Connect] userId=${userId}:`, error.message);
    return NextResponse.json(
      { success: false, error: "Failed to start WhatsApp connection. Please try again." },
      { status: 500 }
    );
  }
}
