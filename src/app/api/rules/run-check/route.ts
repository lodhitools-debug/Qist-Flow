import { NextRequest, NextResponse } from "next/server";
import { runReminderScheduler } from "@/lib/scheduler/reminder-cron";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const body = await req.json().catch(() => ({}));
    const bypassTimeWindow = body.bypassTimeWindow ?? true;

    const result = await runReminderScheduler(!bypassTimeWindow);

    await logActivity({
      userId: session?.userId,
      action: "REMINDER_CHECK_MANUAL",
      details: {
        rulesChecked: result.rulesChecked,
        totalEligible: result.totalEligible,
        enqueued: result.enqueued,
        duplicatesSkipped: result.duplicatesSkipped,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Checked ${result.rulesChecked} rules. Enqueued ${result.enqueued} reminder(s), skipped ${result.duplicatesSkipped} duplicate(s).`,
      result,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Reminder scheduler check failed" }, { status: 500 });
  }
}
