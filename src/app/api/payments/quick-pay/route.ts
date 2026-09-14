import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { customerId, installmentId, amount } = body;

    if (!customerId || !installmentId || amount === undefined || amount <= 0) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);

    // 1. Create Payment record
    const payment = await prisma.payment.create({
      data: {
        customerId,
        installmentId,
        amount: parsedAmount,
        paymentMethod: "QUICK_PAY",
        notes: `Quick Payment by ${session.name || "User"}`,
        isVerified: true
      }
    });

    // 2. Update Installment
    // Get existing installment to calculate new balance
    const existing = await prisma.installment.findUnique({
      where: { id: installmentId }
    });

    if (!existing) {
      return NextResponse.json({ error: "Installment not found" }, { status: 404 });
    }

    const newBalance = Math.max(0, existing.balance - parsedAmount);

    const updatedInstallment = await prisma.installment.update({
      where: { id: installmentId },
      data: {
        balance: newBalance,
        lastPaymentAmount: parsedAmount,
        lastPaymentDate: new Date(),
        status: newBalance <= 0 ? "PAID" : existing.status
      }
    });

    return NextResponse.json({ 
      success: true, 
      payment, 
      installment: updatedInstallment 
    });

  } catch (error: any) {
    console.error("[Quick Pay Error]", error);
    return NextResponse.json({ error: error.message || "Failed to process quick payment" }, { status: 500 });
  }
}
