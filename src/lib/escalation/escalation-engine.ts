import { prisma } from "@/lib/prisma";
import { formatPhoneNumber } from "@/lib/excel/mapper";
import { renderTemplate } from "@/lib/template-renderer";
import { generateGuarantorMessageKey } from "@/lib/whatsapp/duplicate-guard";
import { logActivity } from "@/lib/audit";
import { format } from "date-fns";

export interface GuarantorEscalationConfig {
  enabled: boolean;
  level1DelayDays: number;       // Days after customer WA failure to trigger Level 1 notice
  level2OverdueDays: number;     // Days overdue to trigger Level 2 reminder
  level3OverdueDays: number;     // Days overdue to trigger Level 3 final notice
  maxMessagesPerAccount: number; // Max guarantor messages allowed per account
  maxMessagesPerDay: number;     // Max guarantor messages system-wide per day
  onlyAfterCustomerFailure: boolean;
  onlyAfterOverdue: boolean;
  requireManagerApproval: boolean;
}

export const DEFAULT_ESCALATION_CONFIG: GuarantorEscalationConfig = {
  enabled: true,
  level1DelayDays: 1,
  level2OverdueDays: 3,
  level3OverdueDays: 7,
  maxMessagesPerAccount: 3,
  maxMessagesPerDay: 50,
  onlyAfterCustomerFailure: false,
  onlyAfterOverdue: true,
  requireManagerApproval: false,
};

/**
 * Retrieves escalation configuration from system settings
 */
export async function getEscalationConfig(): Promise<GuarantorEscalationConfig> {
  try {
    const setting = await prisma.systemSetting.findFirst({
      where: { key: "guarantor_escalation_config" },
    });
    if (setting?.value) {
      return { ...DEFAULT_ESCALATION_CONFIG, ...JSON.parse(setting.value) };
    }
  } catch (err) {
    console.error("Error reading guarantor escalation config:", err);
  }
  return DEFAULT_ESCALATION_CONFIG;
}

/**
 * Evaluates and returns which guarantor is eligible and valid for messaging
 */
export function resolveGuarantorContact(customer: {
  guarantor1Name?: string | null;
  guarantor1Phone?: string | null;
  guarantor2Name?: string | null;
  guarantor2Phone?: string | null;
}): {
  guarantorType: "GUARANTOR_1" | "GUARANTOR_2" | null;
  name: string;
  phone: string;
} | null {
  // 1. Try Guarantor 1
  if (customer.guarantor1Phone) {
    const formatted = formatPhoneNumber(customer.guarantor1Phone);
    if (formatted.isValid) {
      return {
        guarantorType: "GUARANTOR_1",
        name: customer.guarantor1Name?.trim() || "Guarantor",
        phone: formatted.clean.replace("+", ""),
      };
    }
  }

  // 2. Failover to Guarantor 2 if Guarantor 1 is invalid or missing
  if (customer.guarantor2Phone) {
    const formatted = formatPhoneNumber(customer.guarantor2Phone);
    if (formatted.isValid) {
      return {
        guarantorType: "GUARANTOR_2",
        name: customer.guarantor2Name?.trim() || "Guarantor 2",
        phone: formatted.clean.replace("+", ""),
      };
    }
  }

  return null;
}

/**
 * Evaluates and enqueues guarantor recovery escalations based on customer states
 */
export async function runGuarantorEscalationScheduler(): Promise<{
  evaluated: number;
  enqueued: number;
  pendingApproval: number;
  skipped: number;
}> {
  const config = await getEscalationConfig();
  if (!config.enabled) {
    return { evaluated: 0, enqueued: 0, pendingApproval: 0, skipped: 0 };
  }

  // 1. Check daily system-wide guarantor limit
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [sentTodayGuarantor, queuedTodayGuarantor] = await Promise.all([
    prisma.messageLog.count({
      where: {
        recipientType: { in: ["GUARANTOR_1", "GUARANTOR_2"] },
        sentAt: { gte: todayStart },
      },
    }),
    prisma.messageQueue.count({
      where: {
        recipientType: { in: ["GUARANTOR_1", "GUARANTOR_2"] },
        createdAt: { gte: todayStart },
        status: { in: ["QUEUED", "SENDING", "SENT"] },
      },
    }),
  ]);

  const currentDailyCount = sentTodayGuarantor + queuedTodayGuarantor;
  if (currentDailyCount >= config.maxMessagesPerDay) {
    console.log(`[Escalation Engine] Daily guarantor limit reached (${currentDailyCount}/${config.maxMessagesPerDay}). Skipping.`);
    return { evaluated: 0, enqueued: 0, pendingApproval: 0, skipped: 0 };
  }

  // 2. Fetch Active Overdue Customers & Installments
  const customers = await prisma.customer.findMany({
    where: {
      optedOut: false,
      installments: {
        some: {
          balance: { gt: 0 },
          status: { in: ["OVERDUE", "DUE_TODAY", "PARTIAL", "UNKNOWN"] },
        },
      },
    },
    include: {
      installments: {
        where: { balance: { gt: 0 } },
        orderBy: { dueDate: "asc" },
      },
      messageLogs: {
        orderBy: { sentAt: "desc" },
        take: 10,
      },
      messageQueues: {
        where: {
          recipientType: { in: ["GUARANTOR_1", "GUARANTOR_2"] },
        },
      },
    },
  });

  // Pre-fetch Guarantor Templates
  const templates = await prisma.messageTemplate.findMany({
    where: {
      type: { in: ["GUARANTOR_FIRST_NOTICE", "GUARANTOR_FOLLOWUP", "GUARANTOR_FINAL_NOTICE"] },
      isActive: true,
    },
  });

  const firstNoticeTmpl = templates.find((t) => t.type === "GUARANTOR_FIRST_NOTICE") || templates[0];
  const followupTmpl = templates.find((t) => t.type === "GUARANTOR_FOLLOWUP") || firstNoticeTmpl;
  const finalNoticeTmpl = templates.find((t) => t.type === "GUARANTOR_FINAL_NOTICE") || followupTmpl;

  let enqueuedCount = 0;
  let pendingApprovalCount = 0;
  let skippedCount = 0;

  for (const customer of customers) {
    const installment = customer.installments[0];
    if (!installment || !installment.dueDate) {
      skippedCount++;
      continue;
    }

    // Check account-level guarantor message cap
    const totalGuarantorSent = customer.messageLogs.filter((l) =>
      ["GUARANTOR_1", "GUARANTOR_2"].includes(l.recipientType)
    ).length;

    if (totalGuarantorSent >= config.maxMessagesPerAccount) {
      skippedCount++;
      continue;
    }

    // Resolve valid guarantor contact
    const guarantorContact = resolveGuarantorContact(customer);
    if (!guarantorContact) {
      skippedCount++;
      continue;
    }

    // Calculate days overdue
    const now = new Date();
    const dueDate = new Date(installment.dueDate);
    const diffTime = now.getTime() - dueDate.getTime();
    const daysOverdue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

    // Check customer's recent messages
    const lastCustomerLog = customer.messageLogs.find((l) => l.recipientType === "CUSTOMER");
    const customerWAFailed = lastCustomerLog?.status === "FAILED";

    if (config.onlyAfterCustomerFailure && !customerWAFailed) {
      skippedCount++;
      continue;
    }

    if (config.onlyAfterOverdue && daysOverdue <= 0) {
      skippedCount++;
      continue;
    }

    // Determine Escalation Level and Template
    let escalationLevel = 0;
    let selectedTemplate = firstNoticeTmpl;
    let messageType = "GUARANTOR_FIRST_NOTICE";
    let escalationReason = "";

    if (daysOverdue >= config.level3OverdueDays) {
      escalationLevel = 3;
      selectedTemplate = finalNoticeTmpl;
      messageType = "GUARANTOR_FINAL_NOTICE";
      escalationReason = `Account is ${daysOverdue} days overdue (Level 3 Final Notice threshold)`;
    } else if (daysOverdue >= config.level2OverdueDays) {
      escalationLevel = 2;
      selectedTemplate = followupTmpl;
      messageType = "GUARANTOR_FOLLOWUP";
      escalationReason = `Account is ${daysOverdue} days overdue (Level 2 Reminder threshold)`;
    } else if (customerWAFailed || daysOverdue >= config.level1DelayDays) {
      escalationLevel = 1;
      selectedTemplate = firstNoticeTmpl;
      messageType = "GUARANTOR_FIRST_NOTICE";
      escalationReason = customerWAFailed
        ? "Customer WhatsApp reminder failed / unreachable (Level 1 escalation)"
        : `Account is ${daysOverdue} days overdue (Level 1 Notice)`;
    } else {
      skippedCount++;
      continue;
    }

    // Check last guarantor message timestamp to avoid spamming (Minimum 2 days gap)
    const lastGuarantorLog = customer.messageLogs.find((l) =>
      ["GUARANTOR_1", "GUARANTOR_2"].includes(l.recipientType)
    );
    if (lastGuarantorLog) {
      const daysSinceLastGuarantor = (now.getTime() - new Date(lastGuarantorLog.sentAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastGuarantor < 2) {
        skippedCount++;
        continue;
      }
    }

    // Generate Deterministic Idempotency Key
    const cycleToken = format(dueDate, "yyyy-MM");
    const idempotencyKey = generateGuarantorMessageKey({
      customerId: customer.id,
      guarantorType: guarantorContact.guarantorType || "GUARANTOR_1",
      messageType,
      dueDate,
      escalationLevel,
      cycleKey: cycleToken,
    });

    // Check if duplicate exists in queue or log
    const existingQueue = customer.messageQueues.find((q) => q.idempotencyKey === idempotencyKey);
    if (existingQueue) {
      skippedCount++;
      continue;
    }

    // Render Template (Privacy Safe: No CNIC, No full address)
    const messageText = renderTemplate(selectedTemplate?.body || "", {
      guarantorName: guarantorContact.name,
      customerName: customer.customerName,
      account: customer.account,
      balance: installment.balance,
      emi: installment.emi,
      dueDate: installment.dueDate,
      daysOverdue,
      branch: customer.branch,
      recoveryPerson: customer.recoveryPerson || "QistFlow Team",
      productName: customer.productName || "Installment Product",
    });

    const isPendingApproval = config.requireManagerApproval;

    try {
      await prisma.messageQueue.create({
        data: {
          recipientPhone: guarantorContact.phone,
          recipientName: guarantorContact.name,
          recipientType: guarantorContact.guarantorType || "GUARANTOR_1",
          guarantorId: guarantorContact.guarantorType || "GUARANTOR_1",
          customerId: customer.id,
          installmentId: installment.id,
          templateId: selectedTemplate?.id || null,
          messageType,
          escalationLevel,
          escalationReason,
          approvalStatus: isPendingApproval ? "PENDING_APPROVAL" : "NOT_REQUIRED",
          messageText,
          status: isPendingApproval ? "QUEUED" : "QUEUED",
          priority: 50, // Higher priority than basic bulk reminder
          idempotencyKey,
          scheduledFor: new Date(),
        },
      });

      if (isPendingApproval) {
        pendingApprovalCount++;
      } else {
        enqueuedCount++;
      }

      await logActivity({
        userId: null,
        action: isPendingApproval ? "GUARANTOR_ESCALATION_PENDING_APPROVAL" : "GUARANTOR_ESCALATION_ENQUEUED",
        entityType: "Customer",
        entityId: customer.id,
        details: {
          customerName: customer.customerName,
          guarantorName: guarantorContact.name,
          guarantorPhone: guarantorContact.phone,
          guarantorType: guarantorContact.guarantorType,
          escalationLevel,
          messageType,
          daysOverdue,
          isPendingApproval,
        },
      });
    } catch (e: any) {
      // Prisma unique constraint violation (duplicate caught)
      if (e.code === "P2002") {
        skippedCount++;
      } else {
        console.error(`[Escalation Error] Customer ${customer.account}:`, e.message);
      }
    }
  }

  return {
    evaluated: customers.length,
    enqueued: enqueuedCount,
    pendingApproval: pendingApprovalCount,
    skipped: skippedCount,
  };
}

/**
 * Cancels pending guarantor messages when a customer settles their balance
 */
export async function cancelPendingGuarantorMessagesForCustomer(customerId: string, reason = "Customer account balance cleared") {
  const cancelled = await prisma.messageQueue.updateMany({
    where: {
      customerId,
      recipientType: { in: ["GUARANTOR_1", "GUARANTOR_2"] },
      status: "QUEUED",
    },
    data: {
      status: "CANCELLED",
      errorMessage: reason,
    },
  });

  return cancelled.count;
}
