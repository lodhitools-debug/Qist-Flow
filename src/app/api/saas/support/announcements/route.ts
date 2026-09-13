import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export async function GET() { try { const announcements = await prisma.announcement.findMany(); return NextResponse.json({ announcements }); } catch (e) { return NextResponse.json({error: "Failed"}, {status: 500}); } }