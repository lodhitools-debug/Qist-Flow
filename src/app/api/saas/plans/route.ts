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