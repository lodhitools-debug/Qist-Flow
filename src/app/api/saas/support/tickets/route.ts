import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export async function GET() { try { const tickets = await prisma.supportTicket.findMany({ include: { tenant: true } }); return NextResponse.json({ tickets }); } catch (e) { return NextResponse.json({error: "Failed"}, {status: 500}); } }