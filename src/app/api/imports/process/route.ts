import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { validateImportRows } from "@/lib/excel/validator";
import { calculateInstallmentStatus } from "@/lib/installment-engine";
import { ExcelColumnMapping } from "@/lib/excel/types";
import { mapRowToCustomer } from "@/lib/excel/mapper";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const body = await req.json().catch(() => ({}));
    const { fileName, fileSize, rows, mapping, initializeOnly, totalRows, importId } = body;

    const tenantId = session?.tenantId || "default";

    // 1. INITIALIZATION ONLY
    if (initializeOnly) {
      if (!mapping) {
        return NextResponse.json({ success: false, error: "Missing mapping" }, { status: 400 });
      }
      
      const totalCustomersBefore = await prisma.customer.count({ where: { tenantId } });
      const totalInstallmentsBefore = await prisma.installment.count({ where: { customer: { tenantId } } });

      const snapshot = await prisma.backupSnapshot.create({
        data: {
          name: `Pre-Import Snapshot (${fileName || "report"})`,
          type: "AUTO_PRE_IMPORT",
          tenantId,
          recordCounts: JSON.stringify({
            customers: totalCustomersBefore,
            installments: totalInstallmentsBefore,
            importFile: fileName,
          }),
          userId: session?.userId,
        },
      }).catch(() => ({ id: "auto_snapshot" }));

      const excelImport = await prisma.excelImport.create({
        data: {
          fileName: fileName || "qistbazar_import.xlsx",
          fileSize: fileSize || 0,
          totalRows: totalRows || 0,
          newRecords: 0,
          updatedRecords: 0,
          errorCount: 0,
          status: "IN_PROGRESS",
          columnMapping: JSON.stringify(mapping),
          errorsJson: "{}",
          snapshotJson: JSON.stringify({ snapshotId: snapshot.id }),
          tenantId,
          userId: session?.userId,
        },
      });

      return NextResponse.json({ success: true, importId: excelImport.id });
    }

    // 2. CHUNK PROCESSING
    if (!importId) {
      return NextResponse.json({ success: false, error: "Missing importId" }, { status: 400 });
    }
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, error: "No data rows provided" }, { status: 400 });
    }

    const excelImport = await prisma.excelImport.findUnique({ where: { id: importId } });
    if (!excelImport) {
      return NextResponse.json({ success: false, error: "Invalid importId" }, { status: 404 });
    }

    // Pre-fetch ONLY the accounts/installments present in THIS chunk for speed
    const accountsInChunk = rows.map(r => r[mapping.account]).filter(Boolean);
    
    const [existingCustomersList, existingInstallmentsList] = await Promise.all([
      prisma.customer.findMany({ 
        where: { tenantId, account: { in: accountsInChunk } }, 
        select: { id: true, account: true } 
      }),
      prisma.installment.findMany({
        where: { customer: { tenantId, account: { in: accountsInChunk } } },
        select: { id: true, customerId: true },
      }),
    ]);

    const existingCustomerMap = new Map(existingCustomersList.map((c) => [c.account, c.id]));
    const existingInstallmentMap = new Map(existingInstallmentsList.map((i) => [i.customerId, i.id]));

    const validation = validateImportRows(
      rows,
      mapping as ExcelColumnMapping,
      new Set(existingCustomerMap.keys())
    );

    let newCount = 0;
    let updatedCount = 0;
    const importRowsToLog: any[] = [];

    const mappedValidRecords = rows
      .map((r, idx) => mapRowToCustomer(r, mapping as ExcelColumnMapping, idx + 2))
      .filter((r) => r.isValid && r.account);

    const CHUNK_SIZE = 25;
    for (let i = 0; i < mappedValidRecords.length; i += CHUNK_SIZE) {
      const chunk = mappedValidRecords.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (record) => {
          try {
            const isExisting = existingCustomerMap.has(record.account);
            let customer;

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

    if (importRowsToLog.length > 0) {
      await prisma.excelImportRow.createMany({
        data: importRowsToLog,
        skipDuplicates: true,
      }).catch((e) => console.warn("[ExcelImportRow bulk log error]:", e.message));
    }

    await prisma.excelImport.update({
      where: { id: excelImport.id },
      data: {
        newRecords: { increment: newCount },
        updatedRecords: { increment: updatedCount },
        errorCount: { increment: validation.invalidRows },
        status: (excelImport.errorCount + validation.invalidRows) > 0 ? "PARTIAL" : "SUCCESS",
      },
    }).catch(() => {});
    
    return NextResponse.json({
      success: true,
      importId: excelImport.id,
      chunkRows: rows.length,
      newRecords: newCount,
      updatedRecords: updatedCount,
      errorCount: validation.invalidRows,
    });
  } catch (error: any) {
    console.error("[Import Process Global Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process Excel import chunk" },
      { status: 500 }
    );
  }
}
