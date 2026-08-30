import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { calculateInstallmentStatus } from "@/lib/installment-engine";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "";
    const branch = searchParams.get("branch") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "30", 10);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (branch && branch !== "ALL") {
      where.customer = { branch };
    }

    if (search) {
      where.customer = {
        ...where.customer,
        OR: [
          { customerName: { contains: search } },
          { account: { contains: search } },
          { primaryPhone: { contains: search } },
          { recoveryPerson: { contains: search } },
        ],
      };
    }

    const [total, installments] = await Promise.all([
      prisma.installment.count({ where }),
      prisma.installment.findMany({
        where,
        include: {
          customer: true,
          payments: { orderBy: { paymentDate: "desc" }, take: 5 },
        },
        orderBy: { dueDate: "asc" },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      installments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load installments" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const { action, installmentId, customerId, amount, paymentDate, paymentMethod, overrideStatus, overrideReason } = await req.json();

    if (action === "record-payment") {
      if (!customerId || !amount || amount <= 0) {
        return NextResponse.json({ error: "Customer ID and positive amount are required" }, { status: 400 });
      }

      const pDate = paymentDate ? new Date(paymentDate) : new Date();

      const payment = await prisma.payment.create({
        data: {
          customerId,
          installmentId,
          amount: parseFloat(amount),
          paymentDate: pDate,
          paymentMethod: paymentMethod || "CASH",
          notes: `Recorded by ${session?.name || "Staff"}`,
        },
      });

      // Update installment balance and status
      if (installmentId) {
        const inst = await prisma.installment.findUnique({ where: { id: installmentId } });
        if (inst) {
          const newBalance = Math.max(0, inst.balance - parseFloat(amount));
          const statusRes = calculateInstallmentStatus({
            dueDate: inst.dueDate,
            emi: inst.emi,
            balance: newBalance,
            lastPaymentDate: pDate,
            lastPaymentAmount: parseFloat(amount),
            installmentTotal: inst.installmentTotal,
          });

          await prisma.installment.update({
            where: { id: installmentId },
            data: {
              balance: newBalance,
              lastPaymentDate: pDate,
              lastPaymentAmount: parseFloat(amount),
              status: statusRes.status as any,
            },
          });
        }
      }

      await logActivity({
        userId: session?.userId,
        action: "MANUAL_PAYMENT",
        entityType: "Payment",
        entityId: payment.id,
        details: { customerId, amount: parseFloat(amount), paymentDate: pDate },
      });

      return NextResponse.json({ success: true, message: "Payment recorded successfully", payment });
    }

    if (action === "override-status") {
      if (!installmentId || !overrideStatus) {
        return NextResponse.json({ error: "Installment ID and override status are required" }, { status: 400 });
      }

      const updated = await prisma.installment.update({
        where: { id: installmentId },
        data: {
          status: overrideStatus,
          statusOverridden: true,
          overrideReason: overrideReason || `Manually overridden by ${session?.name || "Admin"}`,
        },
      });

      await logActivity({
        userId: session?.userId,
        action: "STATUS_OVERRIDE",
        entityType: "Installment",
        entityId: installmentId,
        details: { status: overrideStatus, reason: overrideReason },
      });

      return NextResponse.json({ success: true, installment: updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to process installment action" }, { status: 500 });
  }
}
