import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { formatPhoneNumber } from "@/lib/excel/mapper";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const branch = searchParams.get("branch") || "";
    const status = searchParams.get("status") || "";
    const recoveryPerson = searchParams.get("recoveryPerson") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "25", 10);
    const skip = (page - 1) * limit;

    const where: any = {};

    // Global Search across Name, Phone, CNIC, Account, Web No, IMEI, Recovery Person
    if (search) {
      where.OR = [
        { customerName: { contains: search } },
        { primaryPhone: { contains: search } },
        { secondaryPhone: { contains: search } },
        { account: { contains: search } },
        { cnic: { contains: search } },
        { webNo: { contains: search } },
        { imei1: { contains: search } },
        { imei2: { contains: search } },
        { recoveryPerson: { contains: search } },
        { productName: { contains: search } },
      ];
    }

    if (branch && branch !== "ALL") {
      where.branch = branch;
    }

    if (recoveryPerson && recoveryPerson !== "ALL") {
      where.recoveryPerson = recoveryPerson;
    }

    if (status && status !== "ALL") {
      where.installments = {
        some: {
          status: status,
        },
      };
    }

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        include: {
          installments: {
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      customers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch customers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const body = await req.json();

    const {
      account,
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
      emi,
      balance,
      dueDate,
      installmentTotal,
    } = body;

    if (!account || !customerName || !primaryPhone) {
      return NextResponse.json({ error: "Account, Customer Name, and Primary Phone are required" }, { status: 400 });
    }

    const phoneObj = formatPhoneNumber(primaryPhone);
    if (!phoneObj.isValid) {
      return NextResponse.json({ error: "Invalid primary phone number format" }, { status: 400 });
    }

    const customer = await prisma.customer.create({
      data: {
        account,
        customerName,
        primaryPhone: phoneObj.clean,
        secondaryPhone: secondaryPhone ? formatPhoneNumber(secondaryPhone).clean : undefined,
        cnic,
        webNo,
        address,
        branch: branch || "MAIN",
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
        installments: {
          create: {
            emi: parseFloat(emi) || 0,
            balance: parseFloat(balance) || parseFloat(emi) || 0,
            installmentTotal: parseFloat(installmentTotal) || 0,
            dueDate: dueDate ? new Date(dueDate) : null,
            status: "UNKNOWN",
          },
        },
      },
    });

    await logActivity({
      userId: session?.userId,
      action: "CUSTOMER_CREATE",
      entityType: "Customer",
      entityId: customer.id,
      details: { account, customerName, primaryPhone: phoneObj.clean },
    });

    return NextResponse.json({ success: true, customer });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "A customer with this Account number already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || "Failed to create customer" }, { status: 500 });
  }
}
