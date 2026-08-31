import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { calculateInstallmentStatus } from "@/lib/installment-engine";
import { getUserCustomerScope, canAccessCustomer } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "";
    const branch = searchParams.get("branch") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "30", 10);
    const skip = (page - 1) * limit;

    const where: any = {};

    // 1. RBAC Customer Scope
    let customerFilter: any = {};
    if (session) {
      customerFilter = getUserCustomerScope(session);
    }

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (branch && branch !== "ALL") {
      customerFilter.branch = branch;
    }

    if (search) {
      customerFilter.OR = [
        { customerName: { contains: search, mode: "insensitive" } },
        { account: { contains: search } },
        { primaryPhone: { contains: search } },
        { recoveryPerson: { contains: search, mode: "insensitive" } },
      ];
    }

    where.customer = customerFilter;

    const [total, installments] = await Promise.all([
      prisma.installment.count({ where }),
      prisma.installment.findMany({
        where,
        include: {
          customer: {
            include: {
              assignedTo: { select: { id: true, name: true } },
              assignedManager: { select: { id: true, name: true } },
            },
          },
          payments: { orderBy: { paymentDate: "desc" }, take: 5 },
        },
        orderBy: { dueDate: "asc" },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      installments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load installments" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const body = await req.json().catch(() => ({}));
    const { action, installmentId, customerId, amount, paymentDate, paymentMethod, overrideStatus, overrideReason } = body;

    if (customerId && session) {
      const isAllowed = await canAccessCustomer(session, customerId);
      if (!isAllowed) {
        return NextResponse.json(
          { success: false, error: "Access denied. Customer outside your assigned scope." },
          { status: 403 }
        );
      }
    }

    if (action === "record-payment") {
      if (!customerId || !amount || amount <= 0) {
        return NextResponse.json(
          { success: false, error: "Customer ID and positive amount are required" },
          { status: 400 }
        );
      }

      const pDate = paymentDate ? new Date(paymentDate) : new Date();

      const payment = await prisma.payment.create({
        data: {
          customerId,
          installmentId: installmentId || undefined,
          amount: parseFloat(amount),
          paymentDate: pDate,
          paymentMethod: paymentMethod || "CASH",
          isVerified: true,
        },
      });

      // Update Installment balance
      if (installmentId) {
        const inst = await prisma.installment.findUnique({ where: { id: installmentId } });
        if (inst) {
          const newBalance = Math.max(0, inst.balance - parseFloat(amount));
          const evalResult = calculateInstallmentStatus({
            dueDate: inst.dueDate,
            balance: newBalance,
            emi: inst.emi,
          });

          await prisma.installment.update({
            where: { id: installmentId },
            data: {
              balance: newBalance,
              status: evalResult.status,
              lastPaymentDate: pDate,
              lastPaymentAmount: parseFloat(amount),
            },
          });
        }
      }

      await logActivity({
        userId: session?.userId || null,
        action: "PAYMENT_RECORDED",
        entityType: "Payment",
        entityId: payment.id,
        details: { customerId, amount: parseFloat(amount), paymentMethod },
      });

      return NextResponse.json({ success: true, payment });
    }

    if (action === "override-status") {
      if (!installmentId || !overrideStatus) {
        return NextResponse.json(
          { success: false, error: "Installment ID and status are required" },
          { status: 400 }
        );
      }

      const updated = await prisma.installment.update({
        where: { id: installmentId },
        data: {
          status: overrideStatus,
          statusOverridden: true,
          overrideReason: overrideReason || `Overridden by ${session?.name || "User"}`,
        },
      });

      await logActivity({
        userId: session?.userId || null,
        action: "INSTALLMENT_STATUS_OVERRIDE",
        entityType: "Installment",
        entityId: installmentId,
        details: { overrideStatus, overrideReason },
      });

      return NextResponse.json({ success: true, installment: updated });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Operation failed" },
      { status: 500 }
    );
  }
}
