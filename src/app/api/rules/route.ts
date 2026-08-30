import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const rules = await prisma.reminderRule.findMany({
      orderBy: { daysOffset: "asc" },
      include: {
        template: true,
      },
    });

    return NextResponse.json({ rules });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load reminder rules" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const body = await req.json();

    const {
      name,
      ruleType,
      daysOffset,
      timeWindowStart,
      timeWindowEnd,
      templateId,
      maxReminders,
      minGapDays,
      isActive,
    } = body;

    if (!name || !templateId) {
      return NextResponse.json({ error: "Rule name and template are required" }, { status: 400 });
    }

    const rule = await prisma.reminderRule.create({
      data: {
        name,
        ruleType: ruleType || "DUE_TODAY",
        daysOffset: parseInt(daysOffset) || 0,
        timeWindowStart: timeWindowStart || "10:00",
        timeWindowEnd: timeWindowEnd || "19:00",
        templateId,
        maxReminders: parseInt(maxReminders) || 1,
        minGapDays: parseInt(minGapDays) || 1,
        isActive: typeof isActive === "boolean" ? isActive : true,
      },
      include: { template: true },
    });

    await logActivity({
      userId: session?.userId,
      action: "REMINDER_RULE_CHANGE",
      entityType: "ReminderRule",
      entityId: rule.id,
      details: { action: "CREATE", name: rule.name },
    });

    return NextResponse.json({ success: true, rule });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create reminder rule" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const body = await req.json();
    const { id, name, daysOffset, timeWindowStart, timeWindowEnd, templateId, maxReminders, minGapDays, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "Rule ID is required" }, { status: 400 });
    }

    const updated = await prisma.reminderRule.update({
      where: { id },
      data: {
        name,
        daysOffset: daysOffset !== undefined ? parseInt(daysOffset) : undefined,
        timeWindowStart,
        timeWindowEnd,
        templateId,
        maxReminders: maxReminders !== undefined ? parseInt(maxReminders) : undefined,
        minGapDays: minGapDays !== undefined ? parseInt(minGapDays) : undefined,
        isActive: typeof isActive === "boolean" ? isActive : undefined,
      },
      include: { template: true },
    });

    await logActivity({
      userId: session?.userId,
      action: "REMINDER_RULE_CHANGE",
      entityType: "ReminderRule",
      entityId: id,
      details: { action: "UPDATE", name: updated.name, isActive: updated.isActive },
    });

    return NextResponse.json({ success: true, rule: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update reminder rule" }, { status: 500 });
  }
}
