import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || (session.role !== "ADMIN" && session.role !== "MANAGER")) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branch: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ users });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (session?.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can create new staff accounts" }, { status: 403 });
    }

    const { name, email, password, role, branch, phone } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase().trim(),
        passwordHash,
        role: role || "RECOVERY_OFFICER",
        branch: branch || "QBLAN",
        phone,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branch: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
    });

    await logActivity({
      userId: session?.userId,
      action: "USER_CREATE",
      entityType: "User",
      entityId: user.id,
      details: { email: user.email, role: user.role, name: user.name },
    });

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || "Failed to create user" }, { status: 500 });
  }
}
