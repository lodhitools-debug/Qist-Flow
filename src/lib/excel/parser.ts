import * as XLSX from "xlsx";

export interface ParsedSheetData {
  sheetNames: string[];
  activeSheet: string;
  headers: string[];
  rows: Record<string, any>[];
  totalRows: number;
}

/**
 * Parses an Excel or CSV file buffer into structured JSON
 */
export function parseExcelFile(buffer: Buffer | ArrayBuffer): ParsedSheetData {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    cellText: false,
    raw: true,
  });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("The uploaded Excel workbook contains no sheets.");
  }

  const activeSheet = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[activeSheet];

  // Convert worksheet to json rows (header: 1 gets raw rows array)
  const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  if (rawData.length === 0) {
    return {
      sheetNames: workbook.SheetNames,
      activeSheet,
      headers: [],
      rows: [],
      totalRows: 0,
    };
  }

  // Row 0 is the headers
  const rawHeaders = rawData[0].map((h: any) => String(h || "").trim());
  const headers = rawHeaders.filter((h) => h.length > 0);

  const rows: Record<string, any>[] = [];
  for (let i = 1; i < rawData.length; i++) {
    const rowArray = rawData[i];
    // Skip completely empty rows
    const hasData = rowArray.some((cell: any) => cell !== undefined && cell !== null && String(cell).trim() !== "");
    if (!hasData) continue;

    const rowObj: Record<string, any> = {};
    headers.forEach((header, index) => {
      rowObj[header] = rowArray[index] !== undefined ? rowArray[index] : "";
    });
    rows.push(rowObj);
  }

  return {
    sheetNames: workbook.SheetNames,
    activeSheet,
    headers,
    rows,
    totalRows: rows.length,
  };
}
