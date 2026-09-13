import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: {
        globalRole: {
          not: null
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        globalRole: true,
        isActive: true,
        lastLoginAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error("[SAAS_USERS_GET]", error);
    return NextResponse.json({ error: "Failed to fetch saas users" }, { status: 500 });
  }
}
