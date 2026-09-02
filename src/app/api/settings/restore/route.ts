import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (session?.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can restore database snapshots" }, { status: 403 });
    }

    const { snapshotId } = await req.json();
    if (!snapshotId) {
      return NextResponse.json({ error: "Snapshot ID is required" }, { status: 400 });
    }

    const snapshot = await prisma.backupSnapshot.findUnique({
      where: { id: snapshotId },
    });

    if (!snapshot || !snapshot.dataJson) {
      return NextResponse.json({ error: "Snapshot data not found" }, { status: 404 });
    }

    const payload = JSON.parse(snapshot.dataJson);
    const { customers, installments, payments } = payload.data || {};

    if (customers && Array.isArray(customers)) {
      for (const c of customers) {
        const tenantId = c.tenantId || "default";
        const existing = await prisma.customer.findFirst({ where: { account: c.account, tenantId } });
        if (existing) {
          await prisma.customer.update({
            where: { id: existing.id },
            data: { ...c, id: undefined, createdAt: undefined, updatedAt: undefined },
          });
        } else {
          await prisma.customer.create({
            data: { ...c, id: undefined, createdAt: undefined, updatedAt: undefined, tenantId },
          });
        }
      }
    }

    await logActivity({
      userId: session?.userId,
      action: "BACKUP_RESTORED",
      entityType: "BackupSnapshot",
      entityId: snapshot.id,
      details: { snapshotName: snapshot.name, counts: payload.counts },
    });

    return NextResponse.json({
      success: true,
      message: `Database successfully restored from snapshot "${snapshot.name}"`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to restore database snapshot" }, { status: 500 });
  }
}
