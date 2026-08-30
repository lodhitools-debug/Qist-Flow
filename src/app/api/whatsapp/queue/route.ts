import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processQueueWorker, getQueueStats } from "@/lib/whatsapp/message-queue";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "25", 10);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status && status !== "ALL") {
      where.status = status;
    }

    const [total, items, stats] = await Promise.all([
      prisma.messageQueue.count({ where }),
      prisma.messageQueue.findMany({
        where,
        include: {
          customer: { select: { customerName: true, account: true, branch: true } },
          template: { select: { name: true } },
        },
        orderBy: [{ priority: "desc" }, { scheduledFor: "asc" }],
        skip,
        take: limit,
      }),
      getQueueStats(),
    ]);

    return NextResponse.json({
      items,
      stats,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load queue" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const { action, queueId } = await req.json();

    if (action === "process") {
      const result = await processQueueWorker(15);
      return NextResponse.json({
        success: true,
        message: `Processed ${result.processed} messages (${result.sent} sent, ${result.failed} failed)`,
        result,
      });
    }

    if (action === "retry" && queueId) {
      const updated = await prisma.messageQueue.update({
        where: { id: queueId },
        data: {
          status: "QUEUED",
          errorMessage: null,
          scheduledFor: new Date(),
        },
      });

      await logActivity({
        userId: session?.userId,
        action: "QUEUE_ITEM_RETRY",
        entityId: queueId,
      });

      return NextResponse.json({ success: true, item: updated });
    }

    if (action === "cancel" && queueId) {
      const updated = await prisma.messageQueue.update({
        where: { id: queueId },
        data: { status: "CANCELLED" },
      });

      await logActivity({
        userId: session?.userId,
        action: "QUEUE_ITEM_CANCEL",
        entityId: queueId,
      });

      return NextResponse.json({ success: true, item: updated });
    }

    if (action === "clear-completed") {
      await prisma.messageQueue.deleteMany({
        where: {
          status: { in: ["SENT", "CANCELLED"] },
        },
      });

      return NextResponse.json({ success: true, message: "Cleared completed queue entries" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Queue action failed" }, { status: 500 });
  }
}
