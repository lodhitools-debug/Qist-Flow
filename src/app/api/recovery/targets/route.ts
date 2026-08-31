import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getUserCustomerScope } from "@/lib/rbac";
import { calculateInstallmentStatus } from "@/lib/installment-engine";
import { renderTemplate } from "@/lib/template-renderer";
import { startOfDay, endOfDay, subDays, addDays } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const { searchParams } = new URL(req.url);
    const filterType = searchParams.get("filterType") || "DUE_TODAY"; // DUE_TODAY, OVERDUE_1D, OVERDUE_3D, OVERDUE_7D, OVERDUE_15D, ALL_OVERDUE, UPCOMING_1D
    const branch = searchParams.get("branch") || "";
    const recoveryPerson = searchParams.get("recoveryPerson") || "";
    const templateId = searchParams.get("templateId") || "";

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const customerScope = session ? getUserCustomerScope(session) : {};

    const where: any = {
      customer: {
        ...customerScope,
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

    // Load template if specified
    let template: any = null;
    if (templateId) {
      template = await prisma.messageTemplate.findUnique({ where: { id: templateId } });
    }

    // Transform into preview targets
    const targets = installments.map((inst) => {
      const cust = inst.customer;
      const evalResult = calculateInstallmentStatus({
        dueDate: inst.dueDate,
        balance: inst.balance,
        emi: inst.emi,
        statusOverridden: inst.statusOverridden,
        overriddenStatus: inst.status as any,
      });

      const daysOverdue =
        inst.dueDate && inst.dueDate < todayStart
          ? Math.floor((todayStart.getTime() - inst.dueDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

      // Render personalized message
      let messageText = "";
      if (template) {
        messageText = renderTemplate(template.body, {
          customerName: cust.customerName,
          account: cust.account,
          emi: inst.emi,
          balance: inst.balance,
          dueDate: inst.dueDate ? new Date(inst.dueDate).toLocaleDateString("en-PK") : "N/A",
          daysOverdue,
          productName: cust.productName || "Product",
          branch: cust.branch,
        });
      } else {
        const dueDateStr = inst.dueDate ? new Date(inst.dueDate).toLocaleDateString("en-PK") : "N/A";
        messageText = `Assalam-o-Alaikum ${cust.customerName},\n\nAap ki Rs. ${inst.emi.toLocaleString()} qist ki due date ${dueDateStr} hai (Account: ${cust.account}).\nRemaining Balance: Rs. ${inst.balance.toLocaleString()}.\n\nBarah-e-karam waqt par payment clear karein.\nShukriya,\nQistBazar Recovery`;
      }

      return {
        installmentId: inst.id,
        customerId: cust.id,
        account: cust.account,
        customerName: cust.customerName,
        primaryPhone: cust.primaryPhone,
        branch: cust.branch,
        emi: inst.emi,
        balance: inst.balance,
        dueDate: inst.dueDate,
        daysOverdue,
        status: evalResult.status,
        messageText,
        templateId: template?.id || null,
      };
    });

    return NextResponse.json({
      success: true,
      count: targets.length,
      targets,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Failed to load recovery targets" }, { status: 500 });
  }
}
