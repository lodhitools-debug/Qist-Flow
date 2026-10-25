import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getRetentionPreview } from "@/lib/retention/retention-engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth(req, ["ADMIN", "SUPER_ADMIN"]);
    if (errorResponse) return errorResponse;

    const tenantId = user.tenantId || "default";
    const preview = await getRetentionPreview(tenantId);

    return NextResponse.json({
      success: true,
      preview,
    });
  } catch (error: any) {
    console.error("[Retention Preview GET Error]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate retention preview" },
      { status: 500 }
    );
  }
}
