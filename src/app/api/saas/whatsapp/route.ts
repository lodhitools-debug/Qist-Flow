import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const accounts = await prisma.whatsAppAccountStatus.findMany({
      include: {
        tenant: true
      }
    });
    return NextResponse.json({ accounts });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
  }
}