import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser(req);
    if (session?.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can modify users" }, { status: 403 });
    }

    const { name, role, branch, phone, isActive, newPassword } = await req.json();

    const data: any = {
      name,
      role,
      branch,
      phone,
      isActive: typeof isActive === "boolean" ? isActive : undefined,
    };

    if (newPassword && newPassword.trim().length >= 6) {
      data.passwordHash = await hashPassword(newPassword.trim());
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
        isActive: true,
      },
    });

    await logActivity({
      userId: session?.userId,
      action: "USER_UPDATE",
      entityType: "User",
      entityId: params.id,
      details: { email: updated.email, role: updated.role },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser(req);
    if (session?.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can delete users" }, { status: 403 });
    }

    if (session.userId === params.id) {
      return NextResponse.json({ error: "Cannot delete your own admin account" }, { status: 400 });
    }

    const deleted = await prisma.user.delete({
      where: { id: params.id },
    });

    await logActivity({
      userId: session?.userId,
      action: "USER_DELETE",
      entityType: "User",
      entityId: params.id,
      details: { email: deleted.email, name: deleted.name },
    });

    return NextResponse.json({ success: true, message: "User deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete user" }, { status: 500 });
  }
}
