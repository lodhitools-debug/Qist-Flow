import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  const targetUserId = user.userId || (user as any).id || (user as any).sub;
  if (!targetUserId) {
    return NextResponse.json({ success: false, error: "User session invalid. Please log in again." }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { phone } = body;

    if (!phone || typeof phone !== "string" || phone.trim().length < 9) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid WhatsApp phone number (e.g. 03001234567 or 923001234567)" },
        { status: 400 }
      );
    }

    let cleanPhone = phone.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("03") && cleanPhone.length === 11) {
      cleanPhone = "92" + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith("3") && cleanPhone.length === 10) {
      cleanPhone = "92" + cleanPhone;
    }

    // 1. Write pairing request to Supabase DB for this user
    await prisma.whatsAppSession.upsert({
      where: { userId: targetUserId },
      update: {
        status: "PAIRING",
        requestedPhone: cleanPhone,
        pairingCode: null,
        errorMessage: null,
        updatedAt: new Date(),
      },
      create: {
        userId: targetUserId,
        status: "PAIRING",
        requestedPhone: cleanPhone,
      },
    });

    // 2. Also notify AlwaysData worker endpoint if configured
    const serviceUrl = (process.env.WHATSAPP_SERVICE_URL || "").replace(/\/$/, "");
    if (serviceUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        await fetch(`${serviceUrl}/api/wa/pairing-code`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-whatsapp-secret": process.env.WHATSAPP_SERVICE_SECRET || "",
          },
          body: JSON.stringify({ userId: targetUserId, phone: cleanPhone }),
          signal: controller.signal,
        }).catch(() => {});
        clearTimeout(timeoutId);
      } catch {}
    }

    // 3. Poll DB for up to 6 seconds awaiting worker to generate pairing code
    for (let i = 0; i < 6; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const updated = await prisma.whatsAppSession.findUnique({ where: { userId: targetUserId } });
      if (updated?.pairingCode) {
        return NextResponse.json({
          success: true,
          pairingCode: updated.pairingCode,
          message: "Pairing code generated successfully!",
        });
      }
      if (updated?.errorMessage) {
        return NextResponse.json(
          { success: false, error: updated.errorMessage },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      pending: true,
      message: "Pairing code requested. Generating code from background worker...",
    });
  } catch (error: any) {
    console.error(`[WhatsApp Pairing Code Error] userId=${targetUserId}:`, error.message);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to request pairing code" },
      { status: 500 }
    );
  }
}

