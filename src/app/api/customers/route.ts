import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { formatPhoneNumber } from "@/lib/excel/mapper";
import { getUserCustomerScope } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const branch = searchParams.get("branch") || "";
    const status = searchParams.get("status") || "";
    const recoveryPerson = searchParams.get("recoveryPerson") || "";
    const assignedToUserId = searchParams.get("assignedToUserId") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "25", 10);
    const skip = (page - 1) * limit;

    const where: any = {};

    // 1. Enforce Server-Side RBAC Scoping
    if (session) {
      const scope = getUserCustomerScope(session);
      Object.assign(where, scope);
    }

    // 2. Global Search
    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { customerName: { contains: search, mode: "insensitive" } },
            { primaryPhone: { contains: search } },
            { secondaryPhone: { contains: search } },
            { account: { contains: search } },
            { cnic: { contains: search } },
            { webNo: { contains: search, mode: "insensitive" } },
            { imei1: { contains: search } },
            { imei2: { contains: search } },
            { recoveryPerson: { contains: search, mode: "insensitive" } },
            { productName: { contains: search, mode: "insensitive" } },
          ],
        },
      ];
    }

    if (branch && branch !== "ALL") {
      where.branch = branch;
    }

    if (recoveryPerson && recoveryPerson !== "ALL") {
      where.recoveryPerson = recoveryPerson;
    }

    if (assignedToUserId && assignedToUserId !== "ALL") {
      where.assignedToUserId = assignedToUserId;
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
          assignedTo: {
            select: { id: true, name: true, phone: true },
          },
          assignedManager: {
            select: { id: true, name: true },
          },
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
      success: true,
      customers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch customers" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || session.role === "RECOVERY_OFFICER") {
      return NextResponse.json(
        { success: false, error: "Access denied. Only Admins and Managers can create customers manually." },
        { status: 403 }
      );
    }

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
      assignedToUserId,
    } = body;

    if (!account || !customerName || !primaryPhone) {
      return NextResponse.json(
        { success: false, error: "Account, Customer Name, and Primary Phone are required" },
        { status: 400 }
      );
    }

    const cleanPrimary = formatPhoneNumber(primaryPhone).clean;
    const cleanSecondary = secondaryPhone ? formatPhoneNumber(secondaryPhone).clean : undefined;

    const customer = await prisma.customer.create({
      data: {
        account,
        customerName,
        primaryPhone: cleanPrimary,
        secondaryPhone: cleanSecondary,
        cnic,
        webNo,
        address,
        branch: branch || "MAIN",
        productName,
        brand,
        imei1,
        imei2,
        guarantor1Name,
        guarantor1Phone: guarantor1Phone ? formatPhoneNumber(guarantor1Phone).clean : undefined,
        guarantor2Name,
        guarantor2Phone: guarantor2Phone ? formatPhoneNumber(guarantor2Phone).clean : undefined,
        salesPerson,
        recoveryPerson,
        comment,
        assignedToUserId: assignedToUserId || null,
        assignedManagerId: session.role === "MANAGER" ? session.userId : null,
      },
    });

    await logActivity({
      userId: session?.userId,
      action: "CUSTOMER_CREATE",
      entityType: "Customer",
      entityId: customer.id,
      details: { account: customer.account, customerName: customer.customerName },
    });

    return NextResponse.json({ success: true, customer });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { success: false, error: "A customer with this Account number already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create customer" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || session.role === "RECOVERY_OFFICER") {
      return NextResponse.json(
        { success: false, error: "Access denied. Only Admins and Managers can delete customers." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { ids, all } = body;

    const customerScope = getUserCustomerScope(session);

    if (all === true) {
      if (session.role !== "ADMIN") {
        return NextResponse.json(
          { success: false, error: "Only Super Admins can purge all customer records." },
          { status: 403 }
        );
      }

      // Purge all customer test data
      const result = await prisma.customer.deleteMany({});

      await logActivity({
        userId: session.userId,
        action: "CUSTOMER_PURGE_ALL",
        entityType: "Customer",
        details: { deletedCount: result.count },
      });

      return NextResponse.json({
        success: true,
        message: `Successfully purged all ${result.count} customer records from database.`,
        count: result.count,
      });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please provide an array of customer IDs to delete." },
        { status: 400 }
      );
    }

    const result = await prisma.customer.deleteMany({
      where: {
        id: { in: ids },
        ...customerScope,
      },
    });

    await logActivity({
      userId: session.userId,
      action: "CUSTOMER_BULK_DELETE",
      entityType: "Customer",
      details: { deletedCount: result.count, requestedIdsCount: ids.length },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${result.count} customer(s).`,
      count: result.count,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete customers" },
      { status: 500 }
    );
  }
}

