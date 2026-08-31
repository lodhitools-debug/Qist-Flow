import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { formatPhoneNumber } from "@/lib/excel/mapper";
import { canAccessCustomer } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser(req);
    if (session) {
      const isAllowed = await canAccessCustomer(session, params.id);
      if (!isAllowed) {
        return NextResponse.json(
          { success: false, error: "Access denied. This customer is outside your assigned scope." },
          { status: 403 }
        );
      }
    }

    const customer = await prisma.customer.findUnique({
      where: { id: params.id },
      include: {
        assignedTo: {
          select: { id: true, name: true, phone: true, email: true, role: true },
        },
        assignedManager: {
          select: { id: true, name: true, phone: true, email: true },
        },
        assignments: {
          include: {
            user: { select: { id: true, name: true, role: true } },
            assignedBy: { select: { id: true, name: true } },
          },
          orderBy: { assignedAt: "desc" },
          take: 10,
        },
        installments: {
          orderBy: { createdAt: "desc" },
          include: { payments: true },
        },
        payments: {
          orderBy: { paymentDate: "desc" },
        },
        messageLogs: {
          orderBy: { sentAt: "desc" },
          take: 50,
        },
        messageQueues: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, customer });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Failed to load customer" }, { status: 500 });
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

    const isAllowed = await canAccessCustomer(session, params.id);
    if (!isAllowed) {
      return NextResponse.json(
        { success: false, error: "Access denied. Cannot modify customer outside your scope." },
        { status: 403 }
      );
    }

    const body = await req.json();

    const {
      customerName,
      primaryPhone,
      secondaryPhone,
      cnic,
      webNo,
      address,
      branch,
      productName,
      brand,
      imei1,
      imei2,
      guarantor1Name,
      guarantor1Phone,
      guarantor2Name,
      guarantor2Phone,
      salesPerson,
      recoveryPerson,
      comment,
      assignedToUserId,
      assignedManagerId,
      optedOut,
    } = body;

    const data: any = {
      customerName,
      primaryPhone: primaryPhone ? formatPhoneNumber(primaryPhone).clean : undefined,
      secondaryPhone: secondaryPhone ? formatPhoneNumber(secondaryPhone).clean : undefined,
      cnic,
      webNo,
      address,
      branch,
      productName,
      brand,
      imei1,
      imei2,
      guarantor1Name,
      guarantor1Phone,
      guarantor2Name,
      guarantor2Phone,
      salesPerson,
      recoveryPerson,
      comment,
      optedOut: typeof optedOut === "boolean" ? optedOut : undefined,
    };

    // Role-guarded assignment update
    if (session.role === "ADMIN") {
      if (assignedToUserId !== undefined) data.assignedToUserId = assignedToUserId || null;
      if (assignedManagerId !== undefined) data.assignedManagerId = assignedManagerId || null;
    } else if (session.role === "MANAGER") {
      if (assignedToUserId !== undefined) data.assignedToUserId = assignedToUserId || null;
    }

    const updated = await prisma.customer.update({
      where: { id: params.id },
      data,
    });

    await logActivity({
      userId: session?.userId,
      action: "CUSTOMER_UPDATE",
      entityType: "Customer",
      entityId: params.id,
      details: { account: updated.account, customerName: updated.customerName },
    });

    return NextResponse.json({ success: true, customer: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Failed to update customer" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser(req);
    if (!session || session.role === "RECOVERY_OFFICER") {
      return NextResponse.json(
        { success: false, error: "Access denied. Only Admins and Managers can delete customer records." },
        { status: 403 }
      );
    }

    const isAllowed = await canAccessCustomer(session, params.id);
    if (!isAllowed) {
      return NextResponse.json(
        { success: false, error: "Access denied. Cannot delete customer outside your assigned portfolio." },
        { status: 403 }
      );
    }

    const existing = await prisma.customer.findUnique({
      where: { id: params.id },
      select: { id: true, account: true, customerName: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });
    }

    await prisma.customer.delete({
      where: { id: params.id },
    });

    await logActivity({
      userId: session.userId,
      action: "CUSTOMER_DELETE",
      entityType: "Customer",
      entityId: params.id,
      details: { account: existing.account, customerName: existing.customerName },
    });

    return NextResponse.json({
      success: true,
      message: `Customer ${existing.customerName} (${existing.account}) deleted successfully.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete customer" },
      { status: 500 }
    );
  }
}
