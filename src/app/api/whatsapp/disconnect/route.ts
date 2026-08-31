import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

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

    // 1. If AlwaysData remote worker is configured, notify it with userId
    if (serviceUrl) {
      try {
        await fetch(`${serviceUrl}/api/wa/disconnect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-whatsapp-secret": process.env.WHATSAPP_SERVICE_SECRET || "",
          },
          body: JSON.stringify({ userId: targetUserId }),
        });
      } catch (err: any) {
        console.warn(`[AlwaysData Worker Disconnect Warning for ${targetUserId}]:`, err.message);
      }
    }

    // 2. Set DB session to DISCONNECTED for this user (keeps saved auth on disk)
    await prisma.whatsAppSession.upsert({
      where: { userId: targetUserId },
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
        userId: targetUserId,
        status: "DISCONNECTED",
        qrCode: null,
        pairingCode: null,
        requestedPhone: null,
      },
    });

    await logActivity({
      userId: targetUserId,
      action: "WHATSAPP_DISCONNECT",
      details: { serviceUrl: serviceUrl || "Supabase DB sync" },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      status: "DISCONNECTED",
      message: "WhatsApp session disconnected temporarily (saved credentials preserved).",
    });
  } catch (error: any) {
    console.error(`[WhatsApp Disconnect Error] userId=${targetUserId}:`, error.message);
    return NextResponse.json(
      {
        success: false,
        error: "WHATSAPP_DISCONNECT_FAILED",
        message: error.message || "Failed to disconnect WhatsApp session",
      },
      { status: 500 }
    );
  }
}

