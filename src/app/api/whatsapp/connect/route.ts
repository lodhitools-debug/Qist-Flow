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

    // 1. Fetch current user session
    const currentSession = await prisma.whatsAppSession.findUnique({
      where: { userId: user.userId },
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

    // 2. If AlwaysData remote worker is configured via WHATSAPP_SERVICE_URL, notify it with userId
    if (serviceUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const workerRes = await fetch(`${serviceUrl}/api/wa/connect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-whatsapp-secret": process.env.WHATSAPP_SERVICE_SECRET || "",
          },
          body: JSON.stringify({ userId: user.userId }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (workerRes.ok) {
          workerConnected = true;
          const data = await workerRes.json();
          if (data.qrCode) {
            return NextResponse.json({
              success: true,
              status: "QR_READY",
              qrCode: data.qrCode,
              message: "QR code generated!",
            });
          }
        }
      } catch (err: any) {
        console.warn(`[AlwaysData Worker Connect Warning for ${user.userId}]:`, err.message);
      }
    }

    // 3. Update DB session status to CONNECTING for worker polling loop
    const updatedSession = await prisma.whatsAppSession.upsert({
      where: { userId: user.userId },
      update: {
        status: "CONNECTING",
        errorMessage: null,
        pairingCode: null,
        requestedPhone: null,
        qrCode: null,
        qrExpiresAt: null,
        updatedAt: new Date(),
      },
      create: {
        userId: user.userId,
        status: "CONNECTING",
        errorMessage: null,
        pairingCode: null,
        requestedPhone: null,
        qrCode: null,
      },
    });

    await logActivity({
      userId: user.userId,
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

