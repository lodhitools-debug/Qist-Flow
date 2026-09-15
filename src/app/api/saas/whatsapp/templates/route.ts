import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { errorResponse } = await requireSuperAdmin(req);
  if (errorResponse) return errorResponse;

  try {
    const templates = await prisma.messageTemplate.findMany({
      where: { tenantId: "default" },
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { reminderRules: true, messageQueues: true } },
      },
    });

    return NextResponse.json({ templates });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { errorResponse } = await requireSuperAdmin(req);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { name, slug, type, language, body: templateBody, isActive } = body;

    if (!name || !templateBody) {
      return NextResponse.json({ error: "Name and template body are required" }, { status: 400 });
    }

    const cleanSlug = slug || name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");

    const template = await prisma.messageTemplate.create({
      data: {
        name,
        slug: cleanSlug,
        type: type || "CUSTOM",
        language: language || "ROMAN_URDU",
        body: templateBody,
        isActive: typeof isActive === "boolean" ? isActive : true,
        tenantId: "default",
      },
    });

    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "A template with this slug already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}