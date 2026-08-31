import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const serviceUrl = (process.env.WHATSAPP_SERVICE_URL || "").replace(/\/$/, "");

    let workerConnected = false;
    let workerError: string | null = null;

    // 1. If AlwaysData remote worker is configured via WHATSAPP_SERVICE_URL, notify it with a timeout
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
              message: "QR code generated from AlwaysData worker!",
            });
          }
        }
      } catch (err: any) {
        workerError = `AlwaysData worker at ${serviceUrl} is unreachable (${err.name === 'AbortError' ? 'timed out' : err.message})`;
        console.warn("[AlwaysData Worker Connect Warning]:", workerError);
      }
    }

    // 2. Fetch current session or initialize
    const currentSession = await prisma.whatsAppSession.findUnique({ where: { id: "default" } });
    if (currentSession?.connectedPhone || currentSession?.status === "CONNECTED") {
      return NextResponse.json({
        success: true,
        status: "CONNECTED",
        phone: currentSession.connectedPhone,
        name: currentSession.connectedName,
        message: "WhatsApp is already connected.",
      });
    }

    const updatedSession = await prisma.whatsAppSession.upsert({
      where: { id: "default" },
      update: {
        status: "CONNECTING",
        errorMessage: null,
        pairingCode: null,
        requestedPhone: null,
        qrCode: null,
        updatedAt: new Date(),
      },
      create: {
        id: "default",
        status: "CONNECTING",
        errorMessage: null,
        pairingCode: null,
        requestedPhone: null,
        qrCode: null,
      },
    });

    await logActivity({
      userId: session?.userId,
      action: "WHATSAPP_CONNECT_INIT",
      details: { serviceUrl: serviceUrl || "Supabase DB sync", workerConnected },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      status: updatedSession.status,
      qrCode: updatedSession.qrCode,
      workerOffline: !workerConnected && !!serviceUrl,
      message: workerConnected
        ? "WhatsApp session initializing. Awaiting QR code..."
        : workerError || "Awaiting AlwaysData background worker initialization...",
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      status: "DISCONNECTED",
      error: error.message || "Failed to initialize WhatsApp connection",
    });
  }
}
