import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, hashPassword, comparePassword, signToken } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { currentPassword, newPassword } = body;

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: "New password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
    });

    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // If user is not under forced password change, require current password validation
    if (!dbUser.mustChangePassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { success: false, error: "Current password is required" },
          { status: 400 }
        );
      }
      const isMatch = await comparePassword(currentPassword, dbUser.passwordHash);
      if (!isMatch) {
        return NextResponse.json(
          { success: false, error: "Current password is incorrect" },
          { status: 400 }
        );
      }
    }

    const newHash = await hashPassword(newPassword);

    const updatedUser = await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        lastPasswordChangeAt: new Date(),
      },
    });

    await logActivity({
      userId: dbUser.id,
      action: "PASSWORD_CHANGED",
      details: { email: dbUser.email },
    });

    // Refresh JWT token with mustChangePassword = false
    const newToken = await signToken({
      userId: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role as any,
      branch: updatedUser.branch,
      managerId: updatedUser.managerId,
      mustChangePassword: false,
      tenantId: updatedUser.tenantId || "default",
    });

    const response = NextResponse.json({
      success: true,
      message: "Password updated successfully!",
      mustChangePassword: false,
    });

    response.cookies.set({
      name: "qistflow_token",
      value: newToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update password" },
      { status: 500 }
    );
  }
}
