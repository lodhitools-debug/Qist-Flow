import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const plans = await prisma.planVersion.findMany({
      orderBy: { priceMonthly: 'asc' }
    });
    return NextResponse.json({ plans });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch plans" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const plan = await prisma.planVersion.create({
      data: {
        name: body.name,
        priceMonthly: parseFloat(body.priceMonthly),
        maxUsers: parseInt(body.maxUsers),
        maxBranches: parseInt(body.maxBranches),
        maxWaAccounts: parseInt(body.maxWaAccounts),
        maxMessagesPerMonth: parseInt(body.maxMessagesPerMonth),
        isTrial: body.isTrial || false,
        isRecommended: body.isRecommended || false,
        isActive: true
      }
    });
    return NextResponse.json({ plan });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
