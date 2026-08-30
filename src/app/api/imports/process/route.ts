import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { validateImportRows } from "@/lib/excel/validator";
import { calculateInstallmentStatus } from "@/lib/installment-engine";
import { ExcelColumnMapping } from "@/lib/excel/types";
import { mapRowToCustomer } from "@/lib/excel/mapper";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const { fileName, fileSize, rows, mapping } = await req.json();

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No data rows provided for import" }, { status: 400 });
    }

    // 1. Fetch existing accounts to detect new vs updated
    const existingCustomersList = await prisma.customer.findMany({
      select: { id: true, account: true },
    });
    const existingAccountMap = new Map(existingCustomersList.map((c) => [c.account, c.id]));

    // 2. Validate
    const validation = validateImportRows(
      rows,
      mapping as ExcelColumnMapping,
      new Set(existingAccountMap.keys())
    );

    // 3. Automated Pre-Import Snapshot for Rollback Safety
    const totalCustomersBefore = await prisma.customer.count();
    const totalInstallmentsBefore = await prisma.installment.count();

    const snapshot = await prisma.backupSnapshot.create({
      data: {
        name: `Pre-Import Snapshot (${fileName || "report"})`,
        type: "AUTO_PRE_IMPORT",
        recordCounts: JSON.stringify({
          customers: totalCustomersBefore,
          installments: totalInstallmentsBefore,
          importFile: fileName,
        }),
        userId: session?.userId,
      },
    });

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
        userId: session?.userId,
      },
    });

    let newCount = 0;
    let updatedCount = 0;

    // 5. Process valid records
    const mappedValidRecords = rows
      .map((r, idx) => mapRowToCustomer(r, mapping as ExcelColumnMapping, idx + 2))
      .filter((r) => r.isValid && r.account);

    for (const record of mappedValidRecords) {

      try {
        const isExisting = existingAccountMap.has(record.account);

        // Upsert customer
        const customer = await prisma.customer.upsert({
          where: { account: record.account },
          update: {
            customerName: record.customerName,
            primaryPhone: record.primaryPhone,
            secondaryPhone: record.secondaryPhone || undefined,
            cnic: record.cnic || undefined,
            webNo: record.webNo || undefined,
            address: record.address || undefined,
            branch: record.branch || "MAIN",
            productName: record.productName || undefined,
            brand: record.brand || undefined,
            imei1: record.imei1 || undefined,
            imei2: record.imei2 || undefined,
            guarantor1Name: record.guarantor1Name || undefined,
            guarantor1Phone: record.guarantor1Phone || undefined,
            guarantor2Name: record.guarantor2Name || undefined,
            guarantor2Phone: record.guarantor2Phone || undefined,
            salesPerson: record.salesPerson || undefined,
            recoveryPerson: record.recoveryPerson || undefined,
            omsRecoveryPerson: record.omsRecoveryPerson || undefined,
            comment: record.comment || undefined,
          },
          create: {
            account: record.account,
            customerName: record.customerName,
            primaryPhone: record.primaryPhone,
            secondaryPhone: record.secondaryPhone,
            cnic: record.cnic,
            webNo: record.webNo,
            address: record.address,
            branch: record.branch || "MAIN",
            productName: record.productName,
            brand: record.brand,
            imei1: record.imei1,
            imei2: record.imei2,
            guarantor1Name: record.guarantor1Name,
            guarantor1Phone: record.guarantor1Phone,
            guarantor2Name: record.guarantor2Name,
            guarantor2Phone: record.guarantor2Phone,
            salesPerson: record.salesPerson,
            recoveryPerson: record.recoveryPerson,
            omsRecoveryPerson: record.omsRecoveryPerson,
            comment: record.comment,
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

        // Upsert latest installment
        const existingInstallment = await prisma.installment.findFirst({
          where: { customerId: customer.id },
          orderBy: { createdAt: "desc" },
        });

        let installmentId = "";
        if (existingInstallment) {
          const updatedInst = await prisma.installment.update({
            where: { id: existingInstallment.id },
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
        }

        // Record payment if last payment data exists
        if (record.lastPaymentAmount && record.lastPaymentAmount > 0 && record.lastPaymentDate) {
          const existingPayment = await prisma.payment.findFirst({
            where: {
              customerId: customer.id,
              paymentDate: record.lastPaymentDate,
              amount: record.lastPaymentAmount,
            },
          });

          if (!existingPayment) {
            await prisma.payment.create({
              data: {
                customerId: customer.id,
                installmentId,
                amount: record.lastPaymentAmount,
                paymentDate: record.lastPaymentDate,
                paymentMethod: "REPORT_IMPORT",
                notes: `Imported from ${fileName || "Excel Report"}`,
              },
            });
          }
        }

        if (isExisting) {
          updatedCount++;
        } else {
          newCount++;
          existingAccountMap.set(record.account, customer.id);
        }

        // Log import row
        await prisma.excelImportRow.create({
          data: {
            importId: excelImport.id,
            rowNumber: record.rowNumber,
            accountNumber: record.account,
            customerName: record.customerName,
            phone: record.primaryPhone,
            status: "SUCCESS",
            rawDataJson: JSON.stringify(record.rawRow),
          },
        });
      } catch (rowErr: any) {
        await prisma.excelImportRow.create({
          data: {
            importId: excelImport.id,
            rowNumber: record.rowNumber,
            accountNumber: record.account,
            customerName: record.customerName,
            phone: record.primaryPhone,
            status: "ERROR",
            errorMessage: rowErr.message,
            rawDataJson: JSON.stringify(record.rawRow),
          },
        });
      }
    }

    // Update ExcelImport totals
    await prisma.excelImport.update({
      where: { id: excelImport.id },
      data: {
        newRecords: newCount,
        updatedRecords: updatedCount,
      },
    });

    await logActivity({
      userId: session?.userId,
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
    });

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
    return NextResponse.json({ error: error.message || "Failed to process import" }, { status: 500 });
  }
}
