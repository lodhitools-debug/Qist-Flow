import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser(req);
    const body = await req.json();

    const { name, type, language, body: templateBody, isActive } = body;

    const updated = await prisma.messageTemplate.update({
      where: { id: params.id },
      data: {
        name,
        type,
        language,
        body: templateBody,
        isActive: typeof isActive === "boolean" ? isActive : undefined,
      },
    });

    await logActivity({
      userId: session?.userId,
      action: "TEMPLATE_CHANGE",
      entityType: "MessageTemplate",
      entityId: params.id,
      details: { action: "UPDATE", name: updated.name },
    });

    return NextResponse.json({ success: true, template: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser(req);
    if (session?.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can delete templates" }, { status: 403 });
    }

    const template = await prisma.messageTemplate.findUnique({ where: { id: params.id } });
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    if (template.isActive) {
      const updated = await prisma.messageTemplate.update({
        where: { id: params.id },
        data: { isActive: false },
      });

      await logActivity({
        userId: session?.userId,
        action: "TEMPLATE_CHANGE",
        entityType: "MessageTemplate",
        entityId: params.id,
        details: { action: "SOFT_DELETE", name: updated.name },
      });

      return NextResponse.json({ success: true, message: "Template moved to drafts" });
    } else {
      const deleted = await prisma.messageTemplate.delete({
        where: { id: params.id },
      });

      await logActivity({
        userId: session?.userId,
        action: "TEMPLATE_CHANGE",
        entityType: "MessageTemplate",
        entityId: params.id,
        details: { action: "HARD_DELETE", name: deleted.name },
      });

      return NextResponse.json({ success: true, message: "Template permanently deleted" });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete template" }, { status: 500 });
  }
}
