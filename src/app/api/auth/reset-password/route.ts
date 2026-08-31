import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { token, newPassword } = body;

    if (!token || !newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: "Valid reset token and password (min 6 chars) are required" },
        { status: 400 }
      );
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const resetRecord = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() },
        usedAt: null,
      },
      include: { user: true },
    });

    if (!resetRecord || !resetRecord.user || !resetRecord.user.isActive) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired password reset token" },
        { status: 400 }
      );
    }

    const newHash = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: {
          passwordHash: newHash,
          mustChangePassword: false,
          lastPasswordChangeAt: new Date(),
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await logActivity({
      userId: resetRecord.userId,
      action: "PASSWORD_RESET_SUCCESS",
      details: { email: resetRecord.user.email },
    });

    return NextResponse.json({
      success: true,
      message: "Password has been successfully reset. Please log in with your new password.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to reset password" },
      { status: 500 }
    );
  }
}
