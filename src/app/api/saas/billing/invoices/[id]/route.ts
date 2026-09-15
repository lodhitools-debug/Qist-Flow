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

    if (!["PAID", "PENDING", "OVERDUE", "CANCELLED", "REFUNDED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data: {
        status,
        paidAt: status === "PAID" ? new Date() : null,
      },
    });

    return NextResponse.json({ success: true, invoice });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
