import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";

export async function GET() { 
  try { 
    const announcements = await prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } }); 
    return NextResponse.json({ announcements }); 
  } catch (e) { 
    return NextResponse.json({error: "Failed"}, {status: 500}); 
  } 
}

export async function POST(req: NextRequest) {
  const { errorResponse } = await requireSuperAdmin(req);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const ann = await prisma.announcement.create({
      data: {
        title: body.title,
        content: body.content,
        type: body.type,
      }
    });
    return NextResponse.json({ announcement: ann });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}