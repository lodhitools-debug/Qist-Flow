import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export async function GET() { try { const logs = await prisma.saaSAuditLog.findMany({ include: { tenant: true }}); return NextResponse.json({ logs }); } catch (e) { return NextResponse.json({error: "Failed"}, {status: 500}); } }