import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateInstallmentStatus } from "@/lib/installment-engine";
import { renderTemplate } from "@/lib/template-renderer";
import { startOfDay, endOfDay, subDays, addDays } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filterType = searchParams.get("filterType") || "DUE_TODAY"; // DUE_TODAY, OVERDUE_1D, OVERDUE_3D, OVERDUE_7D, OVERDUE_15D, ALL_OVERDUE, UPCOMING_1D
    const branch = searchParams.get("branch") || "";
    const recoveryPerson = searchParams.get("recoveryPerson") || "";
    const templateId = searchParams.get("templateId") || "";

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const where: any = {
      customer: {
        optedOut: false,
      },
      balance: { gt: 0 },
    };

    if (branch && branch !== "ALL") {
      where.customer.branch = branch;
    }
    if (recoveryPerson && recoveryPerson !== "ALL") {
      where.customer.recoveryPerson = recoveryPerson;
    }

    // Date filtering based on filterType
    if (filterType === "DUE_TODAY") {
      where.dueDate = { gte: todayStart, lte: todayEnd };
    } else if (filterType === "UPCOMING_1D") {
      const tmrw = addDays(now, 1);
      where.dueDate = { gte: startOfDay(tmrw), lte: endOfDay(tmrw) };
    } else if (filterType === "OVERDUE_1D") {
      const d1 = subDays(now, 1);
      where.dueDate = { gte: startOfDay(d1), lte: endOfDay(d1) };
    } else if (filterType === "OVERDUE_3D") {
      const d3 = subDays(now, 3);
      where.dueDate = { gte: startOfDay(d3), lte: endOfDay(d3) };
    } else if (filterType === "OVERDUE_7D") {
      const d7 = subDays(now, 7);
      where.dueDate = { gte: startOfDay(d7), lte: endOfDay(d7) };
    } else if (filterType === "OVERDUE_15D") {
      const d15 = subDays(now, 15);
      where.dueDate = { lte: endOfDay(d15) };
    } else if (filterType === "ALL_OVERDUE") {
      where.dueDate = { lt: todayStart };
    }

    const installments = await prisma.installment.findMany({
      where,
      include: {
        customer: true,
      },
      orderBy: { dueDate: "asc" },
      take: 200,
    });

    // Fetch template if provided, or default
    let templateBody = "";
    if (templateId) {
      const tmpl = await prisma.messageTemplate.findUnique({ where: { id: templateId } });
      if (tmpl) templateBody = tmpl.body;
    }

    const targets = installments
      .map((inst) => {
        const cust = inst.customer;
        const statusRes = calculateInstallmentStatus({
          dueDate: inst.dueDate,
          emi: inst.emi,
          balance: inst.balance,
          shortExcess: inst.shortExcess,
          lastPaymentDate: inst.lastPaymentDate,
          lastPaymentAmount: inst.lastPaymentAmount,
          installmentTotal: inst.installmentTotal,
          statusOverridden: inst.statusOverridden,
          overriddenStatus: inst.status as any,
        });

        // Exclude if PAID or UNKNOWN
        if (statusRes.status === "PAID" || statusRes.status === "UNKNOWN") {
          return null;
        }

        const previewMessage = templateBody
          ? renderTemplate(templateBody, {
              customerName: cust.customerName,
              account: cust.account,
              emi: inst.emi,
              balance: inst.balance,
              dueDate: inst.dueDate,
              daysOverdue: statusRes.daysOverdue,
              branch: cust.branch,
              recoveryPerson: cust.recoveryPerson || "Recovery Officer",
              productName: cust.productName || undefined,
            })
          : "";

        return {
          installmentId: inst.id,
          customerId: cust.id,
          account: cust.account,
          customerName: cust.customerName,
          primaryPhone: cust.primaryPhone,
          branch: cust.branch,
          recoveryPerson: cust.recoveryPerson,
          emi: inst.emi,
          balance: inst.balance,
          dueDate: inst.dueDate,
          status: statusRes.status,
          daysOverdue: statusRes.daysOverdue,
          previewMessage,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      filterType,
      totalCount: targets.length,
      targets,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load recovery targets" }, { status: 500 });
  }
}
