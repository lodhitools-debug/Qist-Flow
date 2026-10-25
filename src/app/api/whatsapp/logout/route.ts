import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import fs from "fs";
import path from "path";

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
    const secret = process.env.WHATSAPP_SERVICE_SECRET || "cc6c5a96c0f8f1b73e9635c431e72327171db73d17d589ed8aaa2039fcd5017a";

    if (serviceUrl) {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 8_000);
        await fetch(`${serviceUrl}/api/wa/logout`, {
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

    // Delete local session folder if present
    try {
      const dir = path.join(process.cwd(), "whatsapp_sessions", userId);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    } catch {}

    // Reset DB — full credential wipe
    await prisma.whatsAppSession.upsert({
      where: { userId },
      update: {
        status: "LOGGED_OUT",
        qrCode: null,
        qrExpiresAt: null,
        pairingCode: null,
        requestedPhone: null,
        connectedPhone: null,
        connectedName: null,
        connectedAt: null,
        lastDisconnectedAt: new Date(),
        reconnectAttempts: 0,
        errorMessage: null,
        updatedAt: new Date(),
      },
      create: {
        userId,
        status: "LOGGED_OUT",
        qrCode: null,
        pairingCode: null,
        requestedPhone: null,
      },
    });

    await logActivity({
      userId,
      action: "WHATSAPP_LOGOUT_REMOVE",
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      status: "LOGGED_OUT",
      message: "WhatsApp account fully unlinked. You will need to scan a fresh QR code to reconnect.",
    });
  } catch (error: any) {
    console.error(`[WhatsApp Logout] userId=${userId}:`, error.message);
    return NextResponse.json(
      { success: false, error: "Failed to logout. Please try again." },
      { status: 500 }
    );
  }
}
