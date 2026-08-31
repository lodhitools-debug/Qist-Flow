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

  const targetUserId = user.userId || (user as any).id || (user as any).sub;
  if (!targetUserId) {
    return NextResponse.json({ success: false, error: "User session invalid. Please log in again." }, { status: 401 });
  }

  try {
    const serviceUrl = (process.env.WHATSAPP_SERVICE_URL || "").replace(/\/$/, "");

    // 1. If AlwaysData remote worker is configured, notify it to logout and purge
    if (serviceUrl) {
      try {
        await fetch(`${serviceUrl}/api/wa/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-whatsapp-secret": process.env.WHATSAPP_SERVICE_SECRET || "",
          },
          body: JSON.stringify({ userId: targetUserId }),
        });
      } catch (err: any) {
        console.warn(`[AlwaysData Worker Logout Warning for ${targetUserId}]:`, err.message);
      }
    }

    // 2. Delete local session directory on server if present
    try {
      const userSessionDir = path.join(process.cwd(), "whatsapp_sessions", targetUserId);
      if (fs.existsSync(userSessionDir)) {
        fs.rmSync(userSessionDir, { recursive: true, force: true });
      }
    } catch {}

    // 3. Reset DB session record to LOGGED_OUT and purge credentials
    await prisma.whatsAppSession.upsert({
      where: { userId: targetUserId },
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
        userId: targetUserId,
        status: "LOGGED_OUT",
        qrCode: null,
        pairingCode: null,
        requestedPhone: null,
      },
    });

    await logActivity({
      userId: targetUserId,
      action: "WHATSAPP_LOGOUT_REMOVE",
      details: { serviceUrl: serviceUrl || "Supabase DB sync" },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      status: "LOGGED_OUT",
      message: "WhatsApp session logged out and credentials purged successfully.",
    });
  } catch (error: any) {
    console.error(`[WhatsApp Logout Error] userId=${targetUserId}:`, error.message);
    return NextResponse.json(
      {
        success: false,
        error: "WHATSAPP_LOGOUT_FAILED",
        message: error.message || "Failed to log out WhatsApp session",
      },
      { status: 500 }
    );
  }
}
