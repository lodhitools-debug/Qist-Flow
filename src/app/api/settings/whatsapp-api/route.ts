import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { session, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { waApiEndpoint: true, waApiToken: true, waPhoneNumberId: true, waAccountId: true }
  });

  return NextResponse.json({ success: true, credentials: tenant });
}

export async function PUT(req: NextRequest) {
  const { session, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { waApiEndpoint, waApiToken, waPhoneNumberId, waAccountId } = await req.json();

    const tenant = await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: { waApiEndpoint, waApiToken, waPhoneNumberId, waAccountId },
    });

    return NextResponse.json({ success: true, credentials: tenant });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
