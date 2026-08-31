import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const serviceUrl = (process.env.WHATSAPP_SERVICE_URL || "").replace(/\/$/, "");
    let workerConnected = false;

    const targetUserId = user.userId || (user as any).id || (user as any).sub;
    if (!targetUserId) {
      return NextResponse.json({ success: false, error: "User session invalid. Please log in again." }, { status: 401 });
    }

    // 1. Fetch current user session
    const currentSession = await prisma.whatsAppSession.findUnique({
      where: { userId: targetUserId },
    }).catch(() => null);

    if (currentSession?.status === "CONNECTED" && currentSession?.connectedPhone) {
      return NextResponse.json({
        success: true,
        status: "CONNECTED",
        phone: currentSession.connectedPhone,
        name: currentSession.connectedName,
        message: "WhatsApp is already connected.",
      });
    }

    // 2. Update DB session status to INIT_QR for worker polling loop
    const updatedSession = await prisma.whatsAppSession.upsert({
      where: { userId: targetUserId },
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
        userId: targetUserId,
        status: "INIT_QR",
        errorMessage: null,
        pairingCode: null,
        requestedPhone: null,
        qrCode: null,
      },
    });

    await logActivity({
      userId: targetUserId,
      action: "WHATSAPP_CONNECT_INIT",
      details: { serviceUrl: serviceUrl || "Supabase DB sync", workerConnected },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      status: updatedSession.status,
      qrCode: updatedSession.qrCode,
      message: "WhatsApp session initializing. Awaiting QR code...",
    });
  } catch (error: any) {
    console.error(`[WhatsApp Connect Error] userId=${user.userId}:`, error.message);
    return NextResponse.json(
      {
        success: false,
        error: "WHATSAPP_CONNECT_FAILED",
        message: error.message || "Failed to initialize WhatsApp connection",
      },
      { status: 500 }
    );
  }
}

