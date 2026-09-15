import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { errorResponse } = await requireSuperAdmin(req);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { status } = body;

    if (!["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const ticket = await prisma.supportTicket.update({
      where: { id: params.id },
      data: { status },
    });

    return NextResponse.json({ success: true, ticket });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
