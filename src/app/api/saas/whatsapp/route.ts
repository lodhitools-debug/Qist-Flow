import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const accounts = await prisma.whatsAppAccountStatus.findMany({
      include: { tenant: true }
    });
    return NextResponse.json({ accounts });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const acc = await prisma.whatsAppAccountStatus.create({
      data: {
        tenantId: body.tenantId,
        wabaId: body.wabaId,
        phoneNumberId: body.phoneNumberId,
        connectionStatus: 'CONNECTED',
        qualityRating: 'GREEN',
        messagingLimit: '1K / 24h'
      }
    });
    return NextResponse.json({ account: acc });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
