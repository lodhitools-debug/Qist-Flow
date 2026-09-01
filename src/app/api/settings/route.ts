import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const tenantId = session?.tenantId || "default";

    const settings = await prisma.systemSetting.findMany({
      where: { tenantId }, // ← Multi-tenant: only this company's settings
    });
    const settingsMap: Record<string, any> = {};

    settings.forEach((s) => {
      try {
        settingsMap[s.key] = JSON.parse(s.value);
      } catch {
        settingsMap[s.key] = s.value;
      }
    });

    return NextResponse.json({ settings: settingsMap });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (session?.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can update system settings" }, { status: 403 });
    }

    const tenantId = session.tenantId;
    const { key, value, description } = await req.json();

    if (!key || value === undefined) {
      return NextResponse.json({ error: "Key and value are required" }, { status: 400 });
    }

    const valString = typeof value === "object" ? JSON.stringify(value) : String(value);

    const setting = await prisma.systemSetting.upsert({
      where: { key_tenantId: { key, tenantId } }, // ← Multi-tenant unique key
      update: { value: valString, description },
      create: { key, tenantId, value: valString, description },
    });

    await logActivity({
      userId: session?.userId,
      tenantId,
      action: "SETTINGS_UPDATE",
      details: { key, updatedBy: session.email },
    });

    return NextResponse.json({ success: true, setting });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update setting" }, { status: 500 });
  }
}
