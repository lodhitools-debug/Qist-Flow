import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, getSessionUser, generateTemporaryPassword } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { canManageUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const isSelf = session.userId === params.id;
    const isManagerAllowed = await canManageUser(session, params.id);

    if (!isSelf && !isManagerAllowed) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branch: true,
        phone: true,
        employeeCode: true,
        department: true,
        isActive: true,
        mustChangePassword: true,
        lastLoginAt: true,
        createdAt: true,
        managerId: true,
        manager: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Failed to load user" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const isAuthorized = await canManageUser(session, params.id);
    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: "Access denied. Cannot modify this user." }, { status: 403 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, role: true, managerId: true },
    });

    if (!targetUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { name, role, branch, phone, employeeCode, department, isActive, managerId, resetPassword } = body;

    const data: any = {};

    if (name) data.name = name;
    if (branch !== undefined) data.branch = branch;
    if (phone !== undefined) data.phone = phone || null;
    if (employeeCode !== undefined) data.employeeCode = employeeCode || null;
    if (department !== undefined) data.department = department || null;
    if (typeof isActive === "boolean") data.isActive = isActive;

    let generatedPassword: string | undefined = undefined;

    // Role & Hierarchy modifications
    if (session.role === "ADMIN") {
      // Prevent admin from demoting or locking their own admin role
      if (session.userId === params.id && role && role !== "ADMIN") {
        return NextResponse.json({ success: false, error: "Cannot change your own Admin role" }, { status: 400 });
      }

      if (role) {
        data.role = role;
        if (role === "ADMIN" || role === "MANAGER") {
          data.managerId = null;
        } else if (managerId !== undefined) {
          data.managerId = managerId || null;
        }
      } else if (managerId !== undefined) {
        data.managerId = managerId || null;
      }
    } else if (session.role === "MANAGER") {
      // Manager cannot change role or change managerId
      if (role && role !== "RECOVERY_OFFICER") {
        return NextResponse.json({ success: false, error: "Managers cannot change user roles" }, { status: 403 });
      }
    }

    // Force password reset workflow
    if (resetPassword) {
      generatedPassword = generateTemporaryPassword();
      data.passwordHash = await hashPassword(generatedPassword);
      data.mustChangePassword = true;
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branch: true,
        phone: true,
        employeeCode: true,
        department: true,
        isActive: true,
        mustChangePassword: true,
        managerId: true,
        manager: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await logActivity({
      userId: session.userId,
      action: "USER_UPDATE",
      entityType: "User",
      entityId: params.id,
      details: { email: updated.email, role: updated.role, isActive: updated.isActive, resetPassword: !!resetPassword },
    });

    return NextResponse.json({
      success: true,
      user: updated,
      temporaryPassword: generatedPassword,
      message: generatedPassword
        ? `Password for ${updated.name} has been reset!`
        : `User ${updated.name} updated successfully.`,
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ success: false, error: "Employee code is already in use" }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: error.message || "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser(req);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Only admins can delete users" }, { status: 403 });
    }

    if (session.userId === params.id) {
      return NextResponse.json({ success: false, error: "Cannot delete your own admin account" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!existingUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // Try hard delete first, fallback to soft deactivation if relations prevent hard delete
    try {
      await prisma.user.delete({
        where: { id: params.id },
      });
    } catch {
      await prisma.user.update({
        where: { id: params.id },
        data: { isActive: false },
      });
    }

    await logActivity({
      userId: session.userId,
      action: "USER_DELETE",
      entityType: "User",
      entityId: params.id,
      details: { email: existingUser.email, name: existingUser.name, role: existingUser.role },
    });

    return NextResponse.json({
      success: true,
      message: `User ${existingUser.name} has been removed successfully.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Failed to delete user" }, { status: 500 });
  }
}
