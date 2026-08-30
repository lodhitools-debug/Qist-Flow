import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const backups = await prisma.backupSnapshot.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
      },
      take: 20,
    });

    return NextResponse.json({ backups });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load backups" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const body = await req.json().catch(() => ({}));
    const name = body.name || `Manual Backup ${new Date().toISOString().split("T")[0]}`;

    // Export entire database snapshot
    const [customers, installments, payments, templates, rules, settings] = await Promise.all([
      prisma.customer.findMany(),
      prisma.installment.findMany(),
      prisma.payment.findMany(),
      prisma.messageTemplate.findMany(),
      prisma.reminderRule.findMany(),
      prisma.systemSetting.findMany(),
    ]);

    const snapshotPayload = {
      timestamp: new Date().toISOString(),
      counts: {
        customers: customers.length,
        installments: installments.length,
        payments: payments.length,
        templates: templates.length,
        rules: rules.length,
      },
      data: {
        customers,
        installments,
        payments,
        templates,
        rules,
        settings,
      },
    };

    const backup = await prisma.backupSnapshot.create({
      data: {
        name,
        type: "MANUAL",
        recordCounts: JSON.stringify(snapshotPayload.counts),
        dataJson: JSON.stringify(snapshotPayload),
        userId: session?.userId,
      },
    });

    await logActivity({
      userId: session?.userId,
      action: "BACKUP_CREATED",
      entityType: "BackupSnapshot",
      entityId: backup.id,
      details: snapshotPayload.counts,
    });

    return NextResponse.json({
      success: true,
      message: "Database backup snapshot created successfully",
      backup: {
        id: backup.id,
        name: backup.name,
        type: backup.type,
        recordCounts: snapshotPayload.counts,
        createdAt: backup.createdAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create database backup" }, { status: 500 });
  }
}
