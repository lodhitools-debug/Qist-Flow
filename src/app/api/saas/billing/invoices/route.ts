import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export async function GET() { try { const invoices = await prisma.invoice.findMany({ include: { tenant: true } }); return NextResponse.json({ invoices }); } catch (e) { return NextResponse.json({error: "Failed"}, {status: 500}); } }