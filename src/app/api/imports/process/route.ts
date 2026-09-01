import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { validateImportRows } from "@/lib/excel/validator";
import { calculateInstallmentStatus } from "@/lib/installment-engine";
import { ExcelColumnMapping } from "@/lib/excel/types";
import { mapRowToCustomer } from "@/lib/excel/mapper";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const body = await req.json().catch(() => ({}));
    const { fileName, fileSize, rows, mapping } = body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "No data rows provided for import" },
        { status: 400 }
      );
    }

    if (!mapping || !mapping.account || !mapping.customerName || !mapping.primaryPhone || !mapping.emi || !mapping.dueDate) {
      return NextResponse.json(
        { success: false, error: "Missing required column mappings (Account, Customer, Phone, EMI, Due Date)" },
        { status: 400 }
      );
    }

    console.log(`[Import Process] Processing ${rows.length} rows for file: ${fileName || "unknown"}`);

    // 1. Pre-fetch existing accounts and existing installments in parallel for maximum speed
    // ← Tenant-scoped: only fetch this company's customers
    const tenantId = session?.tenantId || "default";
    const [existingCustomersList, existingInstallmentsList] = await Promise.all([
      prisma.customer.findMany({ where: { tenantId }, select: { id: true, account: true } }),
      prisma.installment.findMany({
        where: { customer: { tenantId } },
        select: { id: true, customerId: true },
      }),
    ]);

    const existingCustomerMap = new Map(existingCustomersList.map((c) => [c.account, c.id]));
    const existingInstallmentMap = new Map(existingInstallmentsList.map((i) => [i.customerId, i.id]));

    // 2. Validate
    const validation = validateImportRows(
      rows,
      mapping as ExcelColumnMapping,
      new Set(existingCustomerMap.keys())
    );

    // 3. Pre-Import Snapshot for Rollback Safety
    const totalCustomersBefore = existingCustomersList.length;
    const totalInstallmentsBefore = existingInstallmentsList.length;

    const snapshot = await prisma.backupSnapshot.create({
      data: {
        name: `Pre-Import Snapshot (${fileName || "report"})`,
        type: "AUTO_PRE_IMPORT",
        tenantId, // ← Multi-tenant
        recordCounts: JSON.stringify({
          customers: totalCustomersBefore,
          installments: totalInstallmentsBefore,
          importFile: fileName,
        }),
        userId: session?.userId,
      },
    }).catch(() => ({ id: "auto_snapshot" }));

    // 4. Create ExcelImport audit record
    const excelImport = await prisma.excelImport.create({
      data: {
        fileName: fileName || "qistbazar_import.xlsx",
        fileSize: fileSize || 0,
        totalRows: rows.length,
        newRecords: 0,
        updatedRecords: 0,
        errorCount: validation.invalidRows,
        status: validation.invalidRows > 0 ? "PARTIAL" : "SUCCESS",
        columnMapping: JSON.stringify(mapping),
        errorsJson: JSON.stringify(validation.errors),
        snapshotJson: JSON.stringify({ snapshotId: snapshot.id }),
        tenantId, // ← Multi-tenant
        userId: session?.userId,
      },
    });

    let newCount = 0;
    let updatedCount = 0;
    const importRowsToLog: any[] = [];

    // 5. Map all valid records
    const mappedValidRecords = rows
      .map((r, idx) => mapRowToCustomer(r, mapping as ExcelColumnMapping, idx + 2))
      .filter((r) => r.isValid && r.account);

    // 6. Process in parallel chunks of 25 to maximize throughput and stay well below serverless timeout
    const CHUNK_SIZE = 25;
    for (let i = 0; i < mappedValidRecords.length; i += CHUNK_SIZE) {
      const chunk = mappedValidRecords.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (record) => {
          try {
            const isExisting = existingCustomerMap.has(record.account);

            // Upsert customer — tenant-scoped unique key
            const customer = await prisma.customer.upsert({
              where: { account_tenantId: { account: record.account, tenantId } },
              update: {
                customerName: record.customerName,
                primaryPhone: record.primaryPhone,
                secondaryPhone: record.secondaryPhone || null,
                cnic: record.cnic || null,
                webNo: record.webNo || null,
                address: record.address || null,
                branch: record.branch || "MAIN",
                productName: record.productName || null,
                brand: record.brand || null,
                imei1: record.imei1 || null,
                imei2: record.imei2 || null,
                guarantor1Name: record.guarantor1Name || null,
                guarantor1Phone: record.guarantor1Phone || null,
                guarantor2Name: record.guarantor2Name || null,
                guarantor2Phone: record.guarantor2Phone || null,
                salesPerson: record.salesPerson || null,
                recoveryPerson: record.recoveryPerson || null,
                omsRecoveryPerson: record.omsRecoveryPerson || null,
                comment: record.comment || null,
              },
              create: {
                account: record.account,
                tenantId, // ← Multi-tenant
                customerName: record.customerName,
                primaryPhone: record.primaryPhone,
                secondaryPhone: record.secondaryPhone || null,
                cnic: record.cnic || null,
                webNo: record.webNo || null,
                address: record.address || null,
                branch: record.branch || "MAIN",
                productName: record.productName || null,
                brand: record.brand || null,
                imei1: record.imei1 || null,
                imei2: record.imei2 || null,
                guarantor1Name: record.guarantor1Name || null,
                guarantor1Phone: record.guarantor1Phone || null,
                guarantor2Name: record.guarantor2Name || null,
                guarantor2Phone: record.guarantor2Phone || null,
                salesPerson: record.salesPerson || null,
                recoveryPerson: record.recoveryPerson || null,
                omsRecoveryPerson: record.omsRecoveryPerson || null,
                comment: record.comment || null,
              },
            });

            // Compute status
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

            // Upsert latest installment using in-memory ID lookup
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

            // Record payment if last payment data exists
            if (record.lastPaymentAmount && record.lastPaymentAmount > 0 && record.lastPaymentDate) {
              await prisma.payment.create({
                data: {
                  customerId: customer.id,
                  installmentId,
                  amount: record.lastPaymentAmount,
                  paymentDate: record.lastPaymentDate,
                  paymentMethod: "REPORT_IMPORT",
                  notes: `Imported from ${fileName || "Excel Report"}`,
                },
              }).catch(() => {});
            }

            if (isExisting) {
              updatedCount++;
            } else {
              newCount++;
              existingCustomerMap.set(record.account, customer.id);
            }

            importRowsToLog.push({
              importId: excelImport.id,
              rowNumber: record.rowNumber,
              accountNumber: record.account,
              customerName: record.customerName,
              phone: record.primaryPhone,
              status: "SUCCESS",
              rawDataJson: JSON.stringify(record.rawRow || {}),
            });
          } catch (rowErr: any) {
            console.error(`[Import Row Error] Account ${record.account}:`, rowErr.message);
            importRowsToLog.push({
              importId: excelImport.id,
              rowNumber: record.rowNumber,
              accountNumber: record.account,
              customerName: record.customerName,
              phone: record.primaryPhone,
              status: "ERROR",
              errorMessage: rowErr.message,
              rawDataJson: JSON.stringify(record.rawRow || {}),
            });
          }
        })
      );
    }

    // 7. Bulk insert import audit rows in a single batch query
    if (importRowsToLog.length > 0) {
      await prisma.excelImportRow.createMany({
        data: importRowsToLog,
        skipDuplicates: true,
      }).catch((e) => console.warn("[ExcelImportRow bulk log error]:", e.message));
    }

    // 8. Update ExcelImport totals
    await prisma.excelImport.update({
      where: { id: excelImport.id },
      data: {
        newRecords: newCount,
        updatedRecords: updatedCount,
      },
    }).catch(() => {});

    await logActivity({
      userId: session?.userId,
      tenantId,
      action: "EXCEL_IMPORT",
      entityType: "ExcelImport",
      entityId: excelImport.id,
      details: {
        fileName,
        totalRows: rows.length,
        newRecords: newCount,
        updatedRecords: updatedCount,
        errors: validation.invalidRows,
      },
    }).catch(() => {});

    console.log(`[Import Process] Finished! New: ${newCount}, Updated: ${updatedCount}`);

    return NextResponse.json({
      success: true,
      importId: excelImport.id,
      fileName,
      totalRows: rows.length,
      newRecords: newCount,
      updatedRecords: updatedCount,
      errorCount: validation.invalidRows,
      status: excelImport.status,
    });
  } catch (error: any) {
    console.error("[Import Process Global Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to process Excel import",
      },
      { status: 500 }
    );
  }
}
