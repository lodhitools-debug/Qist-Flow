import { NextRequest, NextResponse } from "next/server";
import { parseExcelFile } from "@/lib/excel/parser";
import { autoDetectMapping, DEFAULT_QISTBAZAR_MAPPING } from "@/lib/excel/mapper";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No Excel file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse Excel workbook
    const parsed = parseExcelFile(buffer);

    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      return NextResponse.json({
        error: "The uploaded Excel file appears to be empty or has no data rows.",
      }, { status: 400 });
    }

    // Auto-detect column mapping
    const detectedMapping = autoDetectMapping(parsed.headers);

    return NextResponse.json({
      fileName: file.name,
      fileSize: file.size,
      sheetNames: parsed.sheetNames,
      activeSheet: parsed.activeSheet,
      headers: parsed.headers,
      totalRows: parsed.totalRows,
      detectedMapping,
      defaultMapping: DEFAULT_QISTBAZAR_MAPPING,
      sampleRows: parsed.rows.slice(0, 10),
      rawRows: parsed.rows, // full raw rows for subsequent validation & processing
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to parse Excel file" }, { status: 500 });
  }
}
