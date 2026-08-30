import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "";
    const messageType = searchParams.get("messageType") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "30", 10);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (messageType && messageType !== "ALL") {
      where.messageType = messageType;
    }

    if (search) {
      where.OR = [
        { recipientPhone: { contains: search } },
        { messageText: { contains: search } },
        { customer: { customerName: { contains: search } } },
        { customer: { account: { contains: search } } },
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.messageLog.count({ where }),
      prisma.messageLog.findMany({
        where,
        include: {
          customer: {
            select: {
              customerName: true,
              account: true,
              branch: true,
              recoveryPerson: true,
            },
          },
        },
        orderBy: { sentAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load message history" }, { status: 500 });
  }
}
