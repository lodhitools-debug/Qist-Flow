import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { renderTemplate, TEMPLATE_VARIABLES } from "@/lib/template-renderer";

export async function GET(req: NextRequest) {
  try {
    const templates = await prisma.messageTemplate.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { reminderRules: true, messageQueues: true } },
      },
    });

    return NextResponse.json({
      templates,
      availableVariables: TEMPLATE_VARIABLES,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load templates" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const body = await req.json();

    const { name, slug, type, language, body: templateBody, isActive } = body;

    if (!name || !templateBody) {
      return NextResponse.json({ error: "Name and template body are required" }, { status: 400 });
    }

    const cleanSlug =
      slug ||
      name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-");

    const template = await prisma.messageTemplate.create({
      data: {
        name,
        slug: cleanSlug,
        type: type || "DUE_TODAY",
        language: language || "ROMAN_URDU",
        body: templateBody,
        isActive: typeof isActive === "boolean" ? isActive : true,
      },
    });

    await logActivity({
      userId: session?.userId,
      action: "TEMPLATE_CHANGE",
      entityType: "MessageTemplate",
      entityId: template.id,
      details: { action: "CREATE", name: template.name },
    });

    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "A template with this identifier already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || "Failed to create template" }, { status: 500 });
  }
}
