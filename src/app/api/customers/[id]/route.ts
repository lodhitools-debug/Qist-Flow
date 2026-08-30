import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { formatPhoneNumber } from "@/lib/excel/mapper";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: params.id },
      include: {
        installments: {
          orderBy: { createdAt: "desc" },
          include: { payments: true },
        },
        payments: {
          orderBy: { paymentDate: "desc" },
        },
        messageLogs: {
          orderBy: { sentAt: "desc" },
          take: 15,
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({ customer });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load customer" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser(req);
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
      optedOut,
    } = body;

    let cleanPrimary = primaryPhone;
    if (primaryPhone) {
      const phoneObj = formatPhoneNumber(primaryPhone);
      if (phoneObj.isValid) {
        cleanPrimary = phoneObj.clean;
      }
    }

    const updated = await prisma.customer.update({
      where: { id: params.id },
      data: {
        customerName,
        primaryPhone: cleanPrimary,
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
      },
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
    return NextResponse.json({ error: error.message || "Failed to update customer" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser(req);
    if (session?.role !== "ADMIN") {
      return NextResponse.json({ error: "Only Admins can delete customer records" }, { status: 403 });
    }

    const deleted = await prisma.customer.delete({
      where: { id: params.id },
    });

    await logActivity({
      userId: session?.userId,
      action: "CUSTOMER_DELETE",
      entityType: "Customer",
      entityId: params.id,
      details: { account: deleted.account, customerName: deleted.customerName },
    });

    return NextResponse.json({ success: true, message: "Customer deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete customer" }, { status: 500 });
  }
}
