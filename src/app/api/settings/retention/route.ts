import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getTenantRetentionPolicy, saveTenantRetentionPolicy } from "@/lib/retention/retention-engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth(req, ["ADMIN", "SUPER_ADMIN"]);
    if (errorResponse) return errorResponse;

    const tenantId = user.tenantId || "default";
    const policy = await getTenantRetentionPolicy(tenantId);

    return NextResponse.json({
      success: true,
      policy,
      tenantId,
    });
  } catch (error: any) {
    console.error("[Retention Settings GET Error]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load retention settings" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth(req, ["ADMIN", "SUPER_ADMIN"]);
    if (errorResponse) return errorResponse;

    const tenantId = user.tenantId || "default";
    const body = await req.json().catch(() => ({}));

    // Validation
    if (body.retentionDays !== undefined && ![30, 60, 90].includes(body.retentionDays)) {
      return NextResponse.json(
        { success: false, error: "Retention period must be 30, 60, or 90 days" },
        { status: 400 }
      );
    }

    if (body.policyType !== undefined && !["INACTIVITY", "COMPLETION", "BOTH"].includes(body.policyType)) {
      return NextResponse.json(
        { success: false, error: "Policy type must be INACTIVITY, COMPLETION, or BOTH" },
        { status: 400 }
      );
    }

    if (body.actionType !== undefined && !["ARCHIVE", "PERMANENT_DELETE"].includes(body.actionType)) {
      return NextResponse.json(
        { success: false, error: "Action type must be ARCHIVE or PERMANENT_DELETE" },
        { status: 400 }
      );
    }

    const updatedPolicy = await saveTenantRetentionPolicy(tenantId, body, user.userId);

    return NextResponse.json({
      success: true,
      message: "Data Retention & Cleanup policy saved successfully",
      policy: updatedPolicy,
    });
  } catch (error: any) {
    console.error("[Retention Settings PUT Error]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update retention policy" },
      { status: 500 }
    );
  }
}
