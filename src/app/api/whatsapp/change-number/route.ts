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
    const secret = process.env.WHATSAPP_SERVICE_SECRET || "";

    // 1. Tell worker to wipe credentials and close socket
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

    // 2. Delete local session folder if it exists on this server
    try {
      const dir = path.join(process.cwd(), "whatsapp_sessions", userId);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    } catch {}

    // 3. Reset DB to LOGGED_OUT — clears all phone ownership
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
      action: "WHATSAPP_CHANGE_NUMBER",
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      status: "LOGGED_OUT",
      message: "WhatsApp account removed. You can now connect a new WhatsApp number.",
    });
  } catch (error: any) {
    console.error(`[WhatsApp Change Number] userId=${userId}:`, error.message);
    return NextResponse.json(
      { success: false, error: "Failed to remove WhatsApp account. Please try again." },
      { status: 500 }
    );
  }
}
