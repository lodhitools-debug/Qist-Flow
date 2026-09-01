import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, getSessionUser, generateTemporaryPassword } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || (session.role !== "ADMIN" && session.role !== "MANAGER")) {
      return NextResponse.json(
        { success: false, error: "Access denied. Only Admins and Managers can access users." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const roleFilter = searchParams.get("role");
    const statusFilter = searchParams.get("status");
    const managerFilter = searchParams.get("managerId");
    const search = searchParams.get("search")?.trim().toLowerCase() || "";

    const where: any = {
      tenantId: session.tenantId, // ← Multi-tenant: only show users of this company
    };

    // Role-based scoping
    if (session.role === "MANAGER") {
      // Managers only see officers assigned to them
      where.role = "RECOVERY_OFFICER";
      where.managerId = session.userId;
    } else if (session.role === "ADMIN") {
      if (roleFilter && roleFilter !== "ALL") where.role = roleFilter;
      if (managerFilter && managerFilter !== "ALL") where.managerId = managerFilter;
    }

    if (statusFilter === "ACTIVE") where.isActive = true;
    if (statusFilter === "INACTIVE") where.isActive = false;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { employeeCode: { contains: search, mode: "insensitive" } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
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
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            subordinates: true,
            assignedCustomers: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Also fetch managers list if admin for filter/dropdowns
    let managers: any[] = [];
    if (session.role === "ADMIN") {
      managers = await prisma.user.findMany({
        where: { role: "MANAGER", isActive: true, tenantId: session.tenantId },
        select: { id: true, name: true, email: true, branch: true },
        orderBy: { name: "asc" },
      });
    }

    return NextResponse.json({
      success: true,
      users,
      managers,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load users" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || (session.role !== "ADMIN" && session.role !== "MANAGER")) {
      return NextResponse.json(
        { success: false, error: "Access denied. Insufficient permissions." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { name, email, password, role, branch, phone, employeeCode, department, managerId } = body;

    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: "Full name and email are required" },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const targetRole = role || "RECOVERY_OFFICER";

    // Anti-privilege-escalation & manager hierarchy rules
    let effectiveManagerId: string | null = null;

    if (session.role === "MANAGER") {
      // Manager can ONLY create Recovery Officers under their own team
      if (targetRole !== "RECOVERY_OFFICER") {
        return NextResponse.json(
          { success: false, error: "Managers can only create Recovery Officers" },
          { status: 403 }
        );
      }
      effectiveManagerId = session.userId;
    } else if (session.role === "ADMIN") {
      if (targetRole === "ADMIN" || targetRole === "MANAGER") {
        effectiveManagerId = null; // Admins and Managers have no superior manager
      } else {
        if (managerId) {
          // Verify manager exists and has role MANAGER
          const managerUser = await prisma.user.findUnique({
            where: { id: managerId },
            select: { role: true, isActive: true },
          });
          if (!managerUser || managerUser.role !== "MANAGER" || !managerUser.isActive) {
            return NextResponse.json(
              { success: false, error: "Selected manager must be an active Manager" },
              { status: 400 }
            );
          }
          effectiveManagerId = managerId;
        }
      }
    }

    // Temporary password generation or admin provided
    const tempPassword = password && password.trim().length >= 6 ? password.trim() : generateTemporaryPassword();
    const passwordHash = await hashPassword(tempPassword);

    const user = await prisma.user.create({
      data: {
        name,
        email: cleanEmail,
        passwordHash,
        role: targetRole,
        tenantId: session.tenantId, // ← Inherit tenant from creating admin
        branch: branch || "MAIN",
        phone: phone || null,
        employeeCode: employeeCode || null,
        department: department || null,
        managerId: effectiveManagerId,
        mustChangePassword: true,
        isActive: true,
      },
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
        createdAt: true,
        managerId: true,
        manager: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await logActivity({
      userId: session.userId,
      action: "USER_CREATE",
      entityType: "User",
      entityId: user.id,
      details: { email: user.email, role: user.role, name: user.name, managerId: effectiveManagerId },
    });

    return NextResponse.json({
      success: true,
      user,
      temporaryPassword: tempPassword,
      message: `User ${user.name} created successfully!`,
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      const target = error.meta?.target || [];
      if (Array.isArray(target) && target.includes("employeeCode")) {
        return NextResponse.json({ success: false, error: "Employee code is already in use" }, { status: 409 });
      }
      return NextResponse.json({ success: false, error: "A user with this email already exists" }, { status: 409 });
    }
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create user" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Only admins can remove users" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { userIds } = body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ success: false, error: "Please provide user IDs to delete" }, { status: 400 });
    }

    // Exclude current admin's own ID from deletion
    const filteredIds = userIds.filter((id) => id !== session.userId);

    const result = await prisma.user.deleteMany({
      where: {
        id: { in: filteredIds },
        tenantId: session.tenantId, // ← Only delete users of this company
        role: { not: "ADMIN" },
      },
    });

    await logActivity({
      userId: session.userId,
      action: "USER_BULK_DELETE",
      entityType: "User",
      details: { deletedCount: result.count },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${result.count} user(s).`,
      count: result.count,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Failed to delete users" }, { status: 500 });
  }
}

