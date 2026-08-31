import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { canAccessCustomer } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || session.role === "RECOVERY_OFFICER") {
      return NextResponse.json(
        { success: false, error: "Access denied. Only Admins and Managers can assign customers." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { customerId, customerIds, targetOfficerId, targetManagerId, notes } = body;

    // Normalizing single vs bulk customer IDs
    const targetCustomerIds: string[] = [];
    if (customerId) targetCustomerIds.push(customerId);
    if (Array.isArray(customerIds)) {
      customerIds.forEach((id) => {
        if (typeof id === "string" && id.trim() && !targetCustomerIds.includes(id)) {
          targetCustomerIds.push(id);
        }
      });
    }

    if (targetCustomerIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "No customer(s) specified for assignment" },
        { status: 400 }
      );
    }

    // Verify target officer if specified
    let targetOfficer: any = null;
    if (targetOfficerId) {
      targetOfficer = await prisma.user.findUnique({
        where: { id: targetOfficerId },
        select: { id: true, name: true, role: true, managerId: true, isActive: true },
      });

      if (!targetOfficer || !targetOfficer.isActive) {
        return NextResponse.json(
          { success: false, error: "Selected Recovery Officer is invalid or inactive" },
          { status: 400 }
        );
      }

      if (session.role === "MANAGER") {
        // Manager can only assign to officers in their own team or to themselves
        const isTeamMember =
          targetOfficer.id === session.userId ||
          (targetOfficer.role === "RECOVERY_OFFICER" && targetOfficer.managerId === session.userId);

        if (!isTeamMember) {
          return NextResponse.json(
            { success: false, error: "You can only assign customers to Recovery Officers in your team" },
            { status: 403 }
          );
        }
      }
    }

    // Verify target manager if specified
    let targetManager: any = null;
    if (targetManagerId) {
      targetManager = await prisma.user.findUnique({
        where: { id: targetManagerId },
        select: { id: true, name: true, role: true, isActive: true },
      });

      if (!targetManager || targetManager.role !== "MANAGER" || !targetManager.isActive) {
        return NextResponse.json(
          { success: false, error: "Selected Manager is invalid or inactive" },
          { status: 400 }
        );
      }

      if (session.role === "MANAGER" && targetManager.id !== session.userId) {
        return NextResponse.json(
          { success: false, error: "Managers cannot reassign customers to other Managers" },
          { status: 403 }
        );
      }
    }

    // Automatic manager resolution: if assigning to an officer who has a manager, auto-set managerId
    let effectiveManagerId = targetManagerId || null;
    if (!effectiveManagerId && targetOfficer?.managerId) {
      effectiveManagerId = targetOfficer.managerId;
    } else if (session.role === "MANAGER") {
      effectiveManagerId = session.userId;
    }

    // Check permissions for all target customers
    if (session.role === "MANAGER") {
      for (const cId of targetCustomerIds) {
        const hasAccess = await canAccessCustomer(session, cId);
        if (!hasAccess) {
          return NextResponse.json(
            { success: false, error: `Unauthorized to assign customer (ID: ${cId}) outside your team` },
            { status: 403 }
          );
        }
      }
    }

    const now = new Date();

    // Perform atomic assignment updates
    await prisma.$transaction(async (tx) => {
      // 1. Mark existing active assignments as unassigned
      await tx.customerAssignment.updateMany({
        where: {
          customerId: { in: targetCustomerIds },
          isActive: true,
        },
        data: {
          isActive: false,
          unassignedAt: now,
        },
      });

      // 2. Create new active assignment records
      const newAssignments = targetCustomerIds.map((cId) => ({
        customerId: cId,
        userId: targetOfficerId || effectiveManagerId || session.userId,
        assignedById: session.userId,
        role: targetOfficerId ? "RECOVERY_OFFICER" : "MANAGER",
        assignedAt: now,
        isActive: true,
        notes: notes || `Assigned by ${session.name}`,
      }));

      await tx.customerAssignment.createMany({
        data: newAssignments,
      });

      // 3. Update Customer records
      await tx.customer.updateMany({
        where: {
          id: { in: targetCustomerIds },
        },
        data: {
          assignedToUserId: targetOfficerId || null,
          assignedManagerId: effectiveManagerId,
          recoveryPerson: targetOfficer ? targetOfficer.name : undefined,
        },
      });
    });

    await logActivity({
      userId: session.userId,
      action: "CUSTOMER_ASSIGN",
      entityType: "Customer",
      details: {
        totalCustomers: targetCustomerIds.length,
        targetOfficerId,
        targetOfficerName: targetOfficer?.name,
        targetManagerId: effectiveManagerId,
      },
    });

    return NextResponse.json({
      success: true,
      count: targetCustomerIds.length,
      message: `Successfully assigned ${targetCustomerIds.length} customer(s) to ${
        targetOfficer ? targetOfficer.name : "team"
      }!`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to assign customer(s)" },
      { status: 500 }
    );
  }
}
