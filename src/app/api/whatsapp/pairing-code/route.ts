import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { waWebProvider } from "@/lib/whatsapp/web-provider";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const body = await req.json().catch(() => ({}));
    const { phone } = body;

    if (!phone || typeof phone !== "string" || phone.trim().length < 9) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid WhatsApp phone number (e.g. 03001234567 or 923001234567)" },
        { status: 400 }
      );
    }

    const serviceUrl = (process.env.WHATSAPP_SERVICE_URL || "").replace(/\/$/, "");

    // 1. If AlwaysData remote worker is configured, request pairing code from it
    if (serviceUrl) {
      try {
        const workerRes = await fetch(`${serviceUrl}/api/wa/pairing-code`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-whatsapp-secret": process.env.WHATSAPP_SERVICE_SECRET || "",
          },
          body: JSON.stringify({ phone }),
        });

        if (workerRes.ok) {
          const workerData = await workerRes.json();
          if (workerData.pairingCode) {
            return NextResponse.json({
              success: true,
              pairingCode: workerData.pairingCode,
              message: "Pairing code generated successfully from worker",
            });
          }
        }
      } catch (err: any) {
        console.warn("[AlwaysData Pairing Code Warning]:", err.message);
      }
    }

    // 2. Direct provider fallback
    try {
      const pairingCode = await waWebProvider.requestPairingCode(phone);
      return NextResponse.json({
        success: true,
        pairingCode,
        message: "Pairing code generated successfully",
      });
    } catch (localErr: any) {
      return NextResponse.json(
        { success: false, error: localErr.message || "Failed to generate pairing code" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to request pairing code" },
      { status: 500 }
    );
  }
}
