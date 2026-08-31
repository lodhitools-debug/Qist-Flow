import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, signToken } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      await logActivity({
        action: "LOGIN_FAILED",
        details: { email: cleanEmail, reason: "User not found" },
        ipAddress: req.headers.get("x-forwarded-for") || undefined,
      });
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      await logActivity({
        userId: user.id,
        action: "LOGIN_FAILED_INACTIVE",
        details: { email: user.email, reason: "Account inactive" },
        ipAddress: req.headers.get("x-forwarded-for") || undefined,
      });
      return NextResponse.json(
        { success: false, error: "Account has been deactivated. Please contact your administrator." },
        { status: 401 }
      );
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      await logActivity({
        userId: user.id,
        action: "LOGIN_FAILED",
        details: { email: user.email, reason: "Password mismatch" },
        ipAddress: req.headers.get("x-forwarded-for") || undefined,
      });
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }).catch(() => {});

    const token = await signToken({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role as any,
      branch: user.branch,
      managerId: user.managerId,
      mustChangePassword: user.mustChangePassword,
    });

    await logActivity({
      userId: user.id,
      action: "LOGIN_SUCCESS",
      details: { email: user.email, role: user.role },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        branch: user.branch,
        mustChangePassword: user.mustChangePassword,
        managerId: user.managerId,
      },
      token,
    });

    // Set HTTP-only secure cookie
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
      { success: false, error: error.message || "Failed to authenticate" },
      { status: 500 }
    );
  }
}
