import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tenantId, waApiToken, waPhoneNumberId, waAccountId } = body;

    if (!tenantId || !waApiToken || !waPhoneNumberId) {
      return NextResponse.json({ error: "Missing required WhatsApp credentials" }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        waApiToken,
        waPhoneNumberId,
      },
    });

    return NextResponse.json({ success: true, tenant: updatedTenant });
  } catch (error: any) {
    console.error("[WA_ONBOARDING_POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
