import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const history = await prisma.excelImport.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
      },
      take: 50,
    });

    return NextResponse.json({ history });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load import history" }, { status: 500 });
  }
}
