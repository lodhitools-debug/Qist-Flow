import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { errorResponse } = await requireSuperAdmin(req);
  if (errorResponse) return errorResponse;

  try {
    const { id } = params;
    const body = await req.json();
    const { name, price, maxUsers, maxCustomers, features, isPublic } = body;

    const plan = await prisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(price !== undefined && { price: Number(price) }),
        ...(maxUsers !== undefined && { maxUsers: Number(maxUsers) }),
        ...(maxCustomers !== undefined && { maxCustomers: Number(maxCustomers) }),
        ...(features !== undefined && { features }),
        ...(isPublic !== undefined && { isPublic }),
      },
    });

    return NextResponse.json({ success: true, plan });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { errorResponse } = await requireSuperAdmin(req);
  if (errorResponse) return errorResponse;

  try {
    const { id } = params;

    // Check if any tenants are using this plan before deleting
    const tenantsWithPlan = await prisma.tenant.count({
      where: { customPlanId: id }
    });

    if (tenantsWithPlan > 0) {
      return NextResponse.json(
        { success: false, error: `Cannot delete plan. It is currently assigned to ${tenantsWithPlan} branch(es).` }, 
        { status: 400 }
      );
    }

    await prisma.subscriptionPlan.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
