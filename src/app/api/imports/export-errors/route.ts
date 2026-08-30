import { NextRequest, NextResponse } from "next/server";
import { generateErrorExcelBuffer } from "@/lib/excel/validator";

export async function POST(req: NextRequest) {
  try {
    const { errors, rawRows } = await req.json();

    if (!errors || !Array.isArray(errors)) {
      return NextResponse.json({ error: "No errors provided" }, { status: 400 });
    }

    const buffer = generateErrorExcelBuffer(errors, rawRows || []);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="qistflow_import_errors_${Date.now()}.xlsx"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to export error report" }, { status: 500 });
  }
}
