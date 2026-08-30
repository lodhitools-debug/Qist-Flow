import { ExcelColumnMapping, ImportValidationSummary, ParsedCustomerRecord } from "./types";
import { mapRowToCustomer } from "./mapper";
import * as XLSX from "xlsx";

/**
 * Validates a set of raw rows against the column mapping and existing account numbers
 */
export function validateImportRows(
  rows: Record<string, any>[],
  mapping: ExcelColumnMapping,
  existingAccountSet: Set<string> = new Set()
): ImportValidationSummary {
  const seenAccountsInFile = new Set<string>();
  const parsedRecords: ParsedCustomerRecord[] = [];
  const errorsList: ImportValidationSummary["errors"] = [];

  let invalidPhoneNumbers = 0;
  let missingCustomerNames = 0;
  let missingDueDates = 0;
  let missingEmi = 0;
  let duplicateRecords = 0;
  let newCustomers = 0;
  let existingCustomers = 0;

  rows.forEach((rawRow, index) => {
    const rowNum = index + 2; // Excel row index (1-based header is row 1)
    const record = mapRowToCustomer(rawRow, mapping, rowNum);

    // Duplicate account check in same file
    if (record.account) {
      if (seenAccountsInFile.has(record.account)) {
        duplicateRecords++;
        record.errors.push(`Duplicate account "${record.account}" found in the same file.`);
        record.isValid = false;
      } else {
        seenAccountsInFile.add(record.account);
      }

      // Check if existing in database
      if (existingAccountSet.has(record.account)) {
        record.isExisting = true;
        existingCustomers++;
      } else {
        record.isExisting = false;
        newCustomers++;
      }
    }

    // Specific error counts
    record.errors.forEach((err) => {
      let field = "General";
      if (err.includes("phone")) {
        field = "Primary Phone";
        invalidPhoneNumbers++;
      } else if (err.includes("Customer name")) {
        field = "Customer Name";
        missingCustomerNames++;
      } else if (err.includes("Due date")) {
        field = "Due Date";
        missingDueDates++;
      } else if (err.includes("EMI")) {
        field = "EMI";
        missingEmi++;
      } else if (err.includes("Duplicate")) {
        field = "Account";
      }

      errorsList.push({
        rowNumber: rowNum,
        account: record.account,
        customerName: record.customerName,
        field,
        message: err,
      });
    });

    parsedRecords.push(record);
  });

  const validRows = parsedRecords.filter((r) => r.isValid).length;
  const invalidRows = parsedRecords.length - validRows;

  return {
    totalRows: parsedRecords.length,
    validRows,
    invalidRows,
    newCustomers,
    existingCustomers,
    duplicateRecords,
    invalidPhoneNumbers,
    missingCustomerNames,
    missingDueDates,
    missingEmi,
    errors: errorsList,
    previewRows: parsedRecords,
  };
}

/**
 * Generates an Excel buffer containing detailed validation errors for download
 */
export function generateErrorExcelBuffer(
  errors: ImportValidationSummary["errors"],
  rows: Record<string, any>[]
): Buffer {
  const data = errors.map((err) => {
    const rawRow = rows[err.rowNumber - 2] || {};
    return {
      "Excel Row": err.rowNumber,
      "Account No": err.account || "",
      "Customer Name": err.customerName || "",
      "Error Field": err.field,
      "Error Reason": err.message,
      ...rawRow,
    };
  });

  const ws = XLSX.utils.json_to_sheet(data.length > 0 ? data : [{ Message: "No validation errors found" }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Import_Errors");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
