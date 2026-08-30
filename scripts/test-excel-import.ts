import fs from "fs";
import { parseExcelFile } from "../src/lib/excel/parser";
import { autoDetectMapping } from "../src/lib/excel/mapper";
import { validateImportRows } from "../src/lib/excel/validator";
import { calculateInstallmentStatus } from "../src/lib/installment-engine";

async function runTest() {
  const filePath = "C:\\Users\\umar hayat\\Downloads\\ud-recovery_QBLAN_without_2026-08-30.xlsx";
  console.log("🔍 Reading Excel File:", filePath);

  if (!fs.existsSync(filePath)) {
    console.error("❌ File not found!");
    return;
  }

  const buffer = fs.readFileSync(filePath);
  const parsed = parseExcelFile(buffer);

  console.log(`✅ Parsed Workbook Sheet: "${parsed.activeSheet}"`);
  console.log(`✅ Total Rows Found: ${parsed.totalRows}`);
  console.log(`✅ Headers (${parsed.headers.length}):`, parsed.headers);

  const detectedMapping = autoDetectMapping(parsed.headers);
  console.log("\n📋 Auto-Detected Column Mapping:");
  console.log(JSON.stringify(detectedMapping, null, 2));

  const validation = validateImportRows(parsed.rows, detectedMapping);
  console.log("\n📊 Validation Summary:");
  console.log(`  Total Rows: ${validation.totalRows}`);
  console.log(`  Valid Rows: ${validation.validRows}`);
  console.log(`  Invalid Rows: ${validation.invalidRows}`);
  console.log(`  Duplicate Records: ${validation.duplicateRecords}`);
  console.log(`  Invalid Phones: ${validation.invalidPhoneNumbers}`);
  console.log(`  Missing Names: ${validation.missingCustomerNames}`);
  console.log(`  Missing Due Dates: ${validation.missingDueDates}`);

  console.log("\n🧪 First 3 Parsed & Evaluated Customers:");
  for (let i = 0; i < Math.min(3, validation.previewRows.length); i++) {
    const cust = validation.previewRows[i];
    const statusRes = calculateInstallmentStatus({
      dueDate: cust.dueDate,
      emi: cust.emi,
      balance: cust.balance,
      shortExcess: cust.shortExcess,
      lastPaymentDate: cust.lastPaymentDate,
      lastPaymentAmount: cust.lastPaymentAmount,
      installmentTotal: cust.installmentTotal,
    });

    console.log(`\n--- Customer #${i + 1} ---`);
    console.log(`  Account: ${cust.account}`);
    console.log(`  Name: ${cust.customerName}`);
    console.log(`  Phone: ${cust.primaryPhone}`);
    console.log(`  Product: ${cust.productName} (${cust.brand})`);
    console.log(`  IMEI: ${cust.imei1 || "N/A"}`);
    console.log(`  EMI: Rs. ${cust.emi}`);
    console.log(`  Balance: Rs. ${cust.balance}`);
    console.log(`  Due Date: ${cust.dueDate?.toISOString().split("T")[0]}`);
    console.log(`  Status Evaluated: ${statusRes.status} (${statusRes.reason})`);
    console.log(`  Days Overdue: ${statusRes.daysOverdue}`);
    console.log(`  Guarantor 1: ${cust.guarantor1Name} (${cust.guarantor1Phone || "No phone"})`);
  }

  console.log("\n🎉 Excel Import Engine Test Completed Successfully!");
}

runTest().catch(console.error);
