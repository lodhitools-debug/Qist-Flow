import { prisma } from "./prisma";

export async function logActivity(params: {
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, any> | string;
  ipAddress?: string;
}) {
  try {
    const detailsStr =
      typeof params.details === "object"
        ? JSON.stringify(params.details)
        : params.details || null;

    await prisma.activityLog.create({
      data: {
        userId: params.userId || null,
        action: params.action,
        entityType: params.entityType || null,
        entityId: params.entityId || null,
        details: detailsStr,
        ipAddress: params.ipAddress || null,
      },
    });
  } catch (err) {
    console.error("Failed to write activity log:", err);
  }
}
