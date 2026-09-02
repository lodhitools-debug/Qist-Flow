import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, email, password, phone, branch } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).toLowerCase().trim();

    // Check if an admin already exists
    const existingAdmin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    });

    const existingEmail = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingEmail) {
      return NextResponse.json(
        { success: false, error: "An account with this email address already exists" },
        { status: 400 }
      );
    }

    // Only allow self-signup as ADMIN if no admin exists yet
    if (existingAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: "An Administrator account is already configured. Please ask your administrator to create your user account or sign in with Google.",
        },
        { status: 403 }
      );
    }

    const passwordHash = await hashPassword(password);

    const newAdmin = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: cleanEmail,
        passwordHash,
        phone: phone ? String(phone).trim() : null,
        role: "ADMIN",
        branch: branch || "MAIN",
        isActive: true,
        mustChangePassword: false,
      },
    });

    await logActivity({
      userId: newAdmin.id,
      action: "INITIAL_ADMIN_CREATED",
      details: { email: cleanEmail, name },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    const token = await signToken({
      userId: newAdmin.id,
      name: newAdmin.name,
      email: newAdmin.email,
      role: "ADMIN",
      branch: newAdmin.branch,
      mustChangePassword: false,
      tenantId: newAdmin.tenantId || "default",
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: newAdmin.id,
        name: newAdmin.name,
        email: newAdmin.email,
        role: newAdmin.role,
      },
      token,
    });

    response.cookies.set({
      name: "qistflow_token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create administrator account" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const adminCount = await prisma.user.count({
      where: { role: "ADMIN" },
    });

    return NextResponse.json({
      success: true,
      needsInitialAdmin: adminCount === 0,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
