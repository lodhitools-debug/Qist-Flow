import fs from "fs";
import { parseExcelFile } from "../src/lib/excel/parser";
import { autoDetectMapping, mapRowToCustomer } from "../src/lib/excel/mapper";
import { validateImportRows } from "../src/lib/excel/validator";
import { calculateInstallmentStatus } from "../src/lib/installment-engine";
import { prisma } from "../src/lib/prisma";

async function importInitialDataset() {
  const filePath = "C:\\Users\\umar hayat\\Downloads\\ud-recovery_QBLAN_without_2026-08-30.xlsx";
  console.log("📂 Checking for initial Excel dataset at:", filePath);

  if (!fs.existsSync(filePath)) {
    console.log("ℹ️ No local download file found at that exact path. Skipping initial data load.");
    return;
  }

  console.log("📊 Reading and parsing Excel file...");
  const buffer = fs.readFileSync(filePath);
  const parsed = parseExcelFile(buffer);
  const detectedMapping = autoDetectMapping(parsed.headers);

  console.log(`✅ Detected ${parsed.rows.length} rows with ${parsed.headers.length} headers.`);
  const validation = validateImportRows(parsed.rows, detectedMapping);
  console.log(`✅ Validation passed: ${validation.validRows} valid rows, ${validation.invalidRows} errors.`);

  // Find Admin user for audit attribution
  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  const defaultOfficer = await prisma.user.findFirst({ where: { role: "RECOVERY_OFFICER" } });

  console.log("💾 Inserting / updating customers in database...");

  // Pre-fetch in parallel
  const [existingCustomers, existingInstallments] = await Promise.all([
    prisma.customer.findMany({ select: { id: true, account: true } }),
    prisma.installment.findMany({ select: { id: true, customerId: true } }),
  ]);

  const existingCustomerMap = new Map(existingCustomers.map((c) => [c.account, c.id]));
  const existingInstallmentMap = new Map(existingInstallments.map((i) => [i.customerId, i.id]));

  let insertedCount = 0;
  let updatedCount = 0;

  const validMapped = parsed.rows
    .map((r, idx) => mapRowToCustomer(r, detectedMapping, idx + 2))
    .filter((r) => r.isValid && r.account);

  for (const record of validMapped) {
    try {
      const isExisting = existingCustomerMap.has(record.account);

      let customer;
      const tenantId = "default";
      if (isExisting) {
        customer = await prisma.customer.update({
          where: { account_tenantId: { account: record.account, tenantId } },
          data: {
            customerName: record.customerName,
            primaryPhone: record.primaryPhone,
            secondaryPhone: record.secondaryPhone || null,
            cnic: record.cnic || null,
            webNo: record.webNo || null,
            address: record.address || null,
            branch: record.branch || "QBLAN",
            productName: record.productName || null,
            brand: record.brand || null,
            imei1: record.imei1 || null,
            imei2: record.imei2 || null,
            guarantor1Name: record.guarantor1Name || null,
            guarantor1Phone: record.guarantor1Phone || null,
            guarantor2Name: record.guarantor2Name || null,
            guarantor2Phone: record.guarantor2Phone || null,
            salesPerson: record.salesPerson || null,
            recoveryPerson: record.recoveryPerson || "Ghulam Ahmed razaqi",
            omsRecoveryPerson: record.omsRecoveryPerson || null,
            comment: record.comment || null,
            assignedToUserId: defaultOfficer?.id || null,
          },
        });
      } else {
        customer = await prisma.customer.create({
          data: {
            account: record.account,
            tenantId,
            customerName: record.customerName,
            primaryPhone: record.primaryPhone,
            secondaryPhone: record.secondaryPhone || null,
            cnic: record.cnic || null,
            webNo: record.webNo || null,
            address: record.address || null,
            branch: record.branch || "QBLAN",
            productName: record.productName || null,
            brand: record.brand || null,
            imei1: record.imei1 || null,
            imei2: record.imei2 || null,
            guarantor1Name: record.guarantor1Name || null,
            guarantor1Phone: record.guarantor1Phone || null,
            guarantor2Name: record.guarantor2Name || null,
            guarantor2Phone: record.guarantor2Phone || null,
            salesPerson: record.salesPerson || null,
            recoveryPerson: record.recoveryPerson || "Ghulam Ahmed razaqi",
            omsRecoveryPerson: record.omsRecoveryPerson || null,
            comment: record.comment || null,
            assignedToUserId: defaultOfficer?.id || null,
          },
        });
      }

      const statusResult = calculateInstallmentStatus({
        dueDate: record.dueDate,
        emi: record.emi,
        balance: record.balance,
        shortExcess: record.shortExcess,
        lastPaymentDate: record.lastPaymentDate,
        lastPaymentAmount: record.lastPaymentAmount,
        installmentTotal: record.installmentTotal,
        advanceReceived: record.advanceReceived,
      });

      const existingInstId = existingInstallmentMap.get(customer.id);
      let installmentId = existingInstId || "";

      if (existingInstId) {
        const updatedInst = await prisma.installment.update({
          where: { id: existingInstId },
          data: {
            emi: record.emi,
            balance: record.balance,
            shortExcess: record.shortExcess,
            advanceReceived: record.advanceReceived,
            dueDate: record.dueDate,
            saleDate: record.saleDate,
            noOfMonths: record.noOfMonths,
            installmentTotal: record.installmentTotal,
            lastPaymentDate: record.lastPaymentDate,
            lastPaymentAmount: record.lastPaymentAmount,
            status: statusResult.status as any,
          },
        });
        installmentId = updatedInst.id;
      } else {
        const newInst = await prisma.installment.create({
          data: {
            customerId: customer.id,
            emi: record.emi,
            balance: record.balance,
            shortExcess: record.shortExcess,
            advanceReceived: record.advanceReceived,
            dueDate: record.dueDate,
            saleDate: record.saleDate,
            noOfMonths: record.noOfMonths,
            installmentTotal: record.installmentTotal,
            lastPaymentDate: record.lastPaymentDate,
            lastPaymentAmount: record.lastPaymentAmount,
            status: statusResult.status as any,
          },
        });
        installmentId = newInst.id;
        existingInstallmentMap.set(customer.id, newInst.id);
      }

      if (record.lastPaymentAmount && record.lastPaymentAmount > 0 && record.lastPaymentDate) {
        await prisma.payment.create({
          data: {
            customerId: customer.id,
            installmentId,
            amount: record.lastPaymentAmount,
            paymentDate: record.lastPaymentDate,
            paymentMethod: "REPORT_IMPORT",
            notes: "Initial reference sheet import",
          },
        }).catch(() => {});
      }

      if (isExisting) {
        updatedCount++;
      } else {
        insertedCount++;
        existingCustomerMap.set(record.account, customer.id);
      }
    } catch (e: any) {
      console.error(`Error importing account ${record.account}:`, e.message);
    }
  }

  console.log(`\n🎉 Successfully imported! Inserted: ${insertedCount}, Updated: ${updatedCount}`);
}

importInitialDataset()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
