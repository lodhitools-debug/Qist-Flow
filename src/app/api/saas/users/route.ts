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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password, globalRole } = body;

    if (!name || !email || !password || !globalRole) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 409 });
    }

    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(password, 12);

    // SaaS users belong to the "default" tenant
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        globalRole,
        role: "ADMIN", // Usually they are admins in the default tenant
        tenantId: "default",
        isActive: true
      }
    });

    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, globalRole: user.globalRole } });
  } catch (error: any) {
    console.error("[SAAS_USERS_POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
