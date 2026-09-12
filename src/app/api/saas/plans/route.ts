import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { errorResponse } = await requireSuperAdmin(req);
  if (errorResponse) return errorResponse;

  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: { price: "asc" },
  });

  return NextResponse.json({ success: true, plans });
}

export async function POST(req: NextRequest) {
  const { errorResponse } = await requireSuperAdmin(req);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { name, price, maxUsers, maxCustomers, features, isPublic } = body;

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        price: Number(price),
        maxUsers: Number(maxUsers),
        maxCustomers: Number(maxCustomers),
        features: features || null,
        isPublic: isPublic !== undefined ? isPublic : true,
      },
    });

    return NextResponse.json({ success: true, plan });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
