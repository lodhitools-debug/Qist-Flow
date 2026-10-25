import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeRetentionCleanup } from "@/lib/retention/retention-engine";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // 1. Authorization: Allow either CRON_SECRET or authenticated SUPER_ADMIN session
    const authHeader = req.headers.get("authorization");
    const isCronAuthorized =
      process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;

    let isSuperAdmin = false;
    if (!isCronAuthorized) {
      const session = await getSessionUser(req);
      if (session?.role === "SUPER_ADMIN" || session?.role === "ADMIN") {
        isSuperAdmin = true;
      }
    }

    if (!isCronAuthorized && !isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch all active companies/tenants
    const tenants = await prisma.tenant.findMany({
      where: { isActive: true, isDeleted: false },
      select: { id: true, name: true, slug: true },
    });

    const results: Array<{
      tenantId: string;
      tenantName: string;
      status: string;
      processedCount: number;
      eligibleCount: number;
      protectedCount: number;
      reason?: string;
    }> = [];

    // 3. Execute safe, tenant-scoped retention policies
    for (const tenant of tenants) {
      try {
        const runRes = await executeRetentionCleanup(tenant.id, {
          automated: true,
        });

        results.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          status: runRes.status,
          processedCount: runRes.processedCount,
          eligibleCount: runRes.eligibleCount,
          protectedCount: runRes.protectedCount,
          reason: runRes.reason,
        });
      } catch (err: any) {
        results.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          status: "FAILED",
          processedCount: 0,
          eligibleCount: 0,
          protectedCount: 0,
          reason: err.message,
        });
      }
    }

    // 4. Safe maintenance: Clean up temporary import error rows older than 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    let purgedImportRows = 0;
    try {
      const cleanErrors = await prisma.excelImportRow.deleteMany({
        where: {
          status: "ERROR",
          excelImport: {
            createdAt: { lt: ninetyDaysAgo },
          },
        },
      });
      purgedImportRows = cleanErrors.count;
    } catch {}

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      tenantsEvaluated: tenants.length,
      retentionResults: results,
      purgedOldImportErrorLogs: purgedImportRows,
      safetyDeclaration: "Active customer records, unpaid balances, ongoing loans, and legal ledgers strictly protected across all tenants.",
    });
  } catch (error: any) {
    console.error("[CRON Cleanup Error]", error);
    return NextResponse.json({ error: error.message || "Cron cleanup execution failed" }, { status: 500 });
  }
}

