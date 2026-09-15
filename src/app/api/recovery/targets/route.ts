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
    const recipientType = searchParams.get("recipientType") || "CUSTOMER";

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
    } else if (filterType === "OVERDUE_1M") {
      const d1m_end = subDays(now, 1);
      const d1m_start = subDays(now, 30);
      where.dueDate = { gte: startOfDay(d1m_start), lte: endOfDay(d1m_end) };
    } else if (filterType === "OVERDUE_2M") {
      const d2m_end = subDays(now, 31);
      const d2m_start = subDays(now, 60);
      where.dueDate = { gte: startOfDay(d2m_start), lte: endOfDay(d2m_end) };
    } else if (filterType === "OVERDUE_3M") {
      const d3m_end = subDays(now, 61);
      const d3m_start = subDays(now, 90);
      where.dueDate = { gte: startOfDay(d3m_start), lte: endOfDay(d3m_end) };
    } else if (filterType === "OVERDUE_4M_PLUS") {
      const d4m_end = subDays(now, 91);
      where.dueDate = { lte: endOfDay(d4m_end) };
    } else if (filterType === "UPCOMING") {
      where.dueDate = { gt: todayEnd };
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

      const monthsOverdue = Math.floor(daysOverdue / 30) || 1;

      // Render personalized message
      let messageText = "";
      if (template) {
        messageText = renderTemplate(template.body, {
          customerName: cust.customerName,
          guarantorName: cust.guarantor1Name || "Zamanat-daar",
          account: cust.account,
          emi: inst.emi,
          balance: inst.balance,
          dueDate: inst.dueDate ? new Date(inst.dueDate).toLocaleDateString("en-PK") : "N/A",
          daysOverdue,
          monthsOverdue,
          productName: cust.productName || "Product",
          branch: cust.branch,
        });
      } else {
        const dueDateStr = inst.dueDate ? new Date(inst.dueDate).toLocaleDateString("en-PK") : "N/A";
        if (recipientType === "GUARANTOR_1") {
          messageText = `Assalam-o-Alaikum ${cust.guarantor1Name || "Zamanat-daar"},\n\n${cust.customerName} ke account number ${cust.account} ki qist overdue hai. Barah-e-karam payment clear karwayein.\nShukriya,\nQistBazar Recovery`;
        } else {
          messageText = `Assalam-o-Alaikum ${cust.customerName},\n\nAap ki Rs. ${inst.emi.toLocaleString()} qist ki due date ${dueDateStr} hai (Account: ${cust.account}).\nRemaining Balance: Rs. ${inst.balance.toLocaleString()}.\n\nBarah-e-karam waqt par payment clear karein.\nShukriya,\nQistBazar Recovery`;
        }
      }

      return {
        installmentId: inst.id,
        customerId: cust.id,
        account: cust.account,
        customerName: cust.customerName,
        primaryPhone: cust.primaryPhone,
        guarantor1Name: cust.guarantor1Name,
        guarantor1Phone: cust.guarantor1Phone && cust.guarantor1Phone !== cust.primaryPhone ? cust.guarantor1Phone : null,
        branch: cust.branch,
        emi: inst.emi,
        balance: inst.balance,
        dueDate: inst.dueDate,
        daysOverdue,
        monthsOverdue,
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
