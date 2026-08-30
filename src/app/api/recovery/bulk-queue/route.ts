import { NextRequest, NextResponse } from "next/server";
import { enqueueBatch } from "@/lib/whatsapp/message-queue";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const { items, batchLabel } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No reminder items provided" }, { status: 400 });
    }

    const payload = items.map((item) => ({
      recipientPhone: item.primaryPhone,
      messageText: item.messageText,
      customerId: item.customerId,
      installmentId: item.installmentId,
      templateId: item.templateId,
      messageType: "REMINDER" as const,
      dueDate: item.dueDate,
      priority: item.daysOverdue >= 7 ? 3 : 1,
    }));

    const result = await enqueueBatch(payload);

    await logActivity({
      userId: session?.userId,
      action: "BULK_MESSAGE",
      details: {
        batchLabel: batchLabel || "Manual Bulk Reminder",
        totalRequested: items.length,
        enqueued: result.enqueued,
        duplicates: result.duplicates,
        errors: result.errors,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully queued ${result.enqueued} reminder messages. (${result.duplicates} duplicate(s) protected, ${result.errors} error(s)).`,
      result,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Bulk reminder queueing failed" }, { status: 500 });
  }
}
