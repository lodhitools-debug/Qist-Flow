import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { executeRetentionCleanup } from "@/lib/retention/retention-engine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth(req, ["ADMIN", "SUPER_ADMIN"]);
    if (errorResponse) return errorResponse;

    const tenantId = user.tenantId || "default";
    const body = await req.json().catch(() => ({}));

    // Explicit confirmation guard
    if (body.confirmation !== "CONFIRM_CLEANUP") {
      return NextResponse.json(
        {
          success: false,
          error: "Explicit confirmation required. Please provide confirmation: 'CONFIRM_CLEANUP'",
        },
        { status: 400 }
      );
    }

    const result = await executeRetentionCleanup(tenantId, {
      actorUserId: user.userId,
      automated: false,
      dryRun: false,
    });

    return NextResponse.json({
      success: result.status === "SUCCESS",
      result,
    });
  } catch (error: any) {
    console.error("[Retention Execute POST Error]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to execute retention cleanup" },
      { status: 500 }
    );
  }
}
