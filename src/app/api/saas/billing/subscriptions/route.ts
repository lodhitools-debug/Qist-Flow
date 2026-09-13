import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: {
        tenant: true,
        planVersion: true
      }
    });
    return NextResponse.json({ subscriptions });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
  }
}