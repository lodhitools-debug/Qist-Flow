import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateImportRows } from "@/lib/excel/validator";
import { ExcelColumnMapping } from "@/lib/excel/types";

export async function POST(req: NextRequest) {
  try {
    const { rows, mapping } = await req.json();

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows provided for validation" }, { status: 400 });
    }

    if (!mapping || !mapping.account || !mapping.customerName || !mapping.primaryPhone || !mapping.emi || !mapping.dueDate) {
      return NextResponse.json({
        error: "Missing required column mappings (Account, Customer Name, Primary Phone, EMI, Due Date)",
      }, { status: 400 });
    }

    // Fetch existing customer accounts from database
    const existingAccounts = await prisma.customer.findMany({
      select: { account: true },
    });
    const existingAccountSet = new Set(existingAccounts.map((a) => a.account));

    // Validate rows
    const validationSummary = validateImportRows(
      rows,
      mapping as ExcelColumnMapping,
      existingAccountSet
    );

    return NextResponse.json({
      success: true,
      summary: validationSummary,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to validate import data" }, { status: 500 });
  }
}
