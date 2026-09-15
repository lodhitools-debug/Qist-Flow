import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { errorResponse, session } = await requireSuperAdmin(req);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { name, monthlyPrice, maxUsers, maxBranches, maxWaAccounts, maxMonthlyMessages, trialDays, isRecommended, status } = body;

    const plan = await prisma.planVersion.update({
      where: { id: params.id },
      data: {
        name,
        monthlyPrice: monthlyPrice ? parseFloat(monthlyPrice) : undefined,
        maxUsers: maxUsers !== undefined ? parseInt(maxUsers) : undefined,
        maxBranches: maxBranches !== undefined ? parseInt(maxBranches) : undefined,
        maxWaAccounts: maxWaAccounts !== undefined ? parseInt(maxWaAccounts) : undefined,
        maxMonthlyMessages: maxMonthlyMessages !== undefined ? parseInt(maxMonthlyMessages) : undefined,
        trialDays: trialDays !== undefined ? parseInt(trialDays) : undefined,
        isRecommended: isRecommended !== undefined ? isRecommended : undefined,
        status
      }
    });

    await logActivity({
      userId: session?.userId,
      action: "PLAN_UPDATED",
      entityType: "PlanVersion",
      entityId: plan.id,
      details: JSON.stringify({ action: "UPDATE", name: plan.name })
    });

    return NextResponse.json({ success: true, plan });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
