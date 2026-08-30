import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  let dbStatus = "disconnected";
  let dbLatencyMs = 0;
  let totalCustomers = 0;
  let queuedMessages = 0;
  let waSessionStatus = "DISCONNECTED";
  let lastImportTime: string | null = null;
  let lastBackupTime: string | null = null;

  try {
    const dbStart = Date.now();
    // 1. Check database connectivity
    const [custCount, qCount, waSession, latestImport, latestBackup] = await Promise.all([
      prisma.customer.count(),
      prisma.messageQueue.count({ where: { status: "QUEUED" } }),
      prisma.whatsAppSession.findUnique({ where: { id: "default" } }),
      prisma.excelImport.findFirst({ orderBy: { createdAt: "desc" } }),
      prisma.backupSnapshot.findFirst({ orderBy: { createdAt: "desc" } }),
    ]);

    dbLatencyMs = Date.now() - dbStart;
    dbStatus = "connected";
    totalCustomers = custCount;
    queuedMessages = qCount;
    waSessionStatus = waSession?.status || "DISCONNECTED";
    lastImportTime = latestImport?.createdAt ? latestImport.createdAt.toISOString() : null;
    lastBackupTime = latestBackup?.createdAt ? latestBackup.createdAt.toISOString() : null;
  } catch (err: any) {
    dbStatus = `error: ${err.message}`;
  }

  const isHealthy = dbStatus === "connected";

  return NextResponse.json(
    {
      status: isHealthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      responseTimeMs: Date.now() - startTime,
      environment: process.env.NODE_ENV || "development",
      services: {
        webServer: "online",
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
          totalCustomers,
        },
        whatsApp: {
          sessionStatus: waSessionStatus,
          queuedMessages,
        },
        scheduler: {
          status: "active",
          ruleEvaluationIntervalMinutes: 15,
        },
        backups: {
          lastBackup: lastBackupTime,
        },
        imports: {
          lastImport: lastImportTime,
        },
      },
    },
    { status: isHealthy ? 200 : 503 }
  );
}
