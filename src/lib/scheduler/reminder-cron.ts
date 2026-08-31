import { prisma } from "../prisma";
import { renderTemplate } from "../template-renderer";
import { enqueueMessage } from "../whatsapp/message-queue";
import { calculateInstallmentStatus } from "../installment-engine";
import { runGuarantorEscalationScheduler } from "../escalation/escalation-engine";
import { addDays, subDays, startOfDay, endOfDay, format } from "date-fns";

export interface SchedulerRunResult {
  rulesChecked: number;
  totalEligible: number;
  enqueued: number;
  duplicatesSkipped: number;
  guarantorEnqueued: number;
  guarantorPendingApproval: number;
  errors: number;
  details: string[];
}

/**
 * Executes automatic reminder evaluation across customer reminder rules and guarantor escalation policy
 */
export async function runReminderScheduler(forceTimeWindowCheck = true): Promise<SchedulerRunResult> {
  const result: SchedulerRunResult = {
    rulesChecked: 0,
    totalEligible: 0,
    enqueued: 0,
    duplicatesSkipped: 0,
    guarantorEnqueued: 0,
    guarantorPendingApproval: 0,
    errors: 0,
    details: [],
  };

  const now = new Date();
  const currentHourMinute = format(now, "HH:mm");

  // 1. Evaluate Customer Reminder Rules
  const activeRules = await prisma.reminderRule.findMany({
    where: { isActive: true },
    include: { template: true },
  });

  result.rulesChecked = activeRules.length;

  for (const rule of activeRules) {
    // Time window validation (unless bypassed)
    if (forceTimeWindowCheck) {
      if (currentHourMinute < rule.timeWindowStart || currentHourMinute > rule.timeWindowEnd) {
        result.details.push(`Skipped rule "${rule.name}": outside active window (${rule.timeWindowStart} - ${rule.timeWindowEnd})`);
        continue;
      }
    }

    if (!rule.template || !rule.template.isActive) {
      result.details.push(`Skipped rule "${rule.name}": template is inactive or missing`);
      continue;
    }

    // Determine target due date based on daysOffset
    let targetDate = new Date();
    if (rule.daysOffset < 0) {
      targetDate = addDays(now, Math.abs(rule.daysOffset));
    } else if (rule.daysOffset > 0) {
      targetDate = subDays(now, rule.daysOffset);
    }

    const startOfTarget = startOfDay(targetDate);
    const endOfTarget = endOfDay(targetDate);

    // Query installments with target due date
    const installments = await prisma.installment.findMany({
      where: {
        dueDate: {
          gte: startOfTarget,
          lte: endOfTarget,
        },
        balance: { gt: 0 },
        customer: {
          optedOut: false,
        },
      },
      include: {
        customer: true,
      },
    });

    for (const inst of installments) {
      const cust = inst.customer;
      if (!cust || !cust.primaryPhone) continue;

      // Recalculate status to prevent sending to UNKNOWN or PAID
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

      if (!statusRes.isEligibleForReminder || statusRes.status === "PAID" || statusRes.status === "UNKNOWN") {
        continue;
      }

      result.totalEligible++;

      // Render personalized message
      const renderedText = renderTemplate(rule.template.body, {
        customerName: cust.customerName,
        account: cust.account,
        emi: inst.emi,
        balance: inst.balance,
        dueDate: inst.dueDate,
        daysOverdue: statusRes.daysOverdue,
        branch: cust.branch,
        recoveryPerson: cust.recoveryPerson || "Recovery Department",
        lastPaymentAmount: inst.lastPaymentAmount || undefined,
        productName: cust.productName || undefined,
      });

      // Enqueue customer message
      const enqueueRes = await enqueueMessage({
        recipientPhone: cust.primaryPhone,
        recipientName: cust.customerName,
        recipientType: "CUSTOMER",
        messageText: renderedText,
        customerId: cust.id,
        installmentId: inst.id,
        templateId: rule.templateId,
        messageType: "REMINDER",
        dueDate: inst.dueDate,
        priority: rule.daysOffset >= 7 ? 2 : 1, // Higher priority for high overdue
      });

      if (enqueueRes.success) {
        result.enqueued++;
      } else if (enqueueRes.isDuplicate) {
        result.duplicatesSkipped++;
      } else {
        result.errors++;
      }
    }

    result.details.push(
      `Rule "${rule.name}" processed: ${installments.length} matching installments found.`
    );
  }

  // 2. Evaluate Guarantor Recovery Escalations
  try {
    const guarantorRes = await runGuarantorEscalationScheduler();
    result.guarantorEnqueued = guarantorRes.enqueued;
    result.guarantorPendingApproval = guarantorRes.pendingApproval;
    result.details.push(
      `Guarantor Escalation: ${guarantorRes.evaluated} accounts evaluated, ${guarantorRes.enqueued} enqueued, ${guarantorRes.pendingApproval} pending approval, ${guarantorRes.skipped} skipped.`
    );
  } catch (err: any) {
    console.error("Guarantor scheduler error:", err);
    result.errors++;
  }

  return result;
}
