import { prisma } from "../prisma";
import { logActivity } from "../audit";
import { differenceInCalendarDays, startOfDay, subDays } from "date-fns";
import {
  DataRetentionPolicy,
  DEFAULT_RETENTION_POLICY,
  EligibleCustomerSummary,
  IneligibilityBreakdown,
  RetentionPreviewResult,
  RetentionRunResult,
} from "./types";

const SETTING_KEY = "data_retention_policy";
const LOCK_SETTING_KEY = "data_retention_lock";
const LOCK_LEASE_MS = 10 * 60 * 1000; // 10-minute auto-expiry for locks

/**
 * Retrieves the Data Retention Policy for a specific tenant.
 */
export async function getTenantRetentionPolicy(tenantId: string): Promise<DataRetentionPolicy> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key_tenantId: { key: SETTING_KEY, tenantId } },
    });

    if (!setting || !setting.value) {
      return { ...DEFAULT_RETENTION_POLICY };
    }

    const parsed = JSON.parse(setting.value);
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_RETENTION_POLICY.enabled,
      retentionDays: [30, 60, 90].includes(parsed.retentionDays) ? parsed.retentionDays : DEFAULT_RETENTION_POLICY.retentionDays,
      policyType: ["INACTIVITY", "COMPLETION", "BOTH"].includes(parsed.policyType) ? parsed.policyType : DEFAULT_RETENTION_POLICY.policyType,
      actionType: ["ARCHIVE", "PERMANENT_DELETE"].includes(parsed.actionType) ? parsed.actionType : DEFAULT_RETENTION_POLICY.actionType,
      requireBackupBeforeDeletion: parsed.requireBackupBeforeDeletion !== undefined ? !!parsed.requireBackupBeforeDeletion : true,
      notifyAdminsOnCleanup: parsed.notifyAdminsOnCleanup !== undefined ? !!parsed.notifyAdminsOnCleanup : true,
      lastRunAt: parsed.lastRunAt || null,
      lastRunResult: parsed.lastRunResult || null,
    };
  } catch (error) {
    console.error(`[Retention Engine] Error loading policy for tenant ${tenantId}:`, error);
    return { ...DEFAULT_RETENTION_POLICY };
  }
}

/**
 * Saves/updates the Data Retention Policy for a tenant and logs an audit record.
 */
export async function saveTenantRetentionPolicy(
  tenantId: string,
  updates: Partial<DataRetentionPolicy>,
  actorUserId?: string
): Promise<DataRetentionPolicy> {
  const current = await getTenantRetentionPolicy(tenantId);

  const updatedPolicy: DataRetentionPolicy = {
    ...current,
    ...updates,
    retentionDays: [30, 60, 90].includes(updates.retentionDays as any)
      ? (updates.retentionDays as any)
      : current.retentionDays,
    policyType: ["INACTIVITY", "COMPLETION", "BOTH"].includes(updates.policyType as any)
      ? (updates.policyType as any)
      : current.policyType,
    actionType: ["ARCHIVE", "PERMANENT_DELETE"].includes(updates.actionType as any)
      ? (updates.actionType as any)
      : current.actionType,
  };

  await prisma.systemSetting.upsert({
    where: { key_tenantId: { key: SETTING_KEY, tenantId } },
    update: {
      value: JSON.stringify(updatedPolicy),
      description: "Company Data Retention & Automated Cleanup Policy",
    },
    create: {
      key: SETTING_KEY,
      tenantId,
      value: JSON.stringify(updatedPolicy),
      description: "Company Data Retention & Automated Cleanup Policy",
    },
  });

  await logActivity({
    userId: actorUserId,
    tenantId,
    action: "RETENTION_POLICY_UPDATE",
    entityType: "SystemSetting",
    details: {
      before: {
        enabled: current.enabled,
        retentionDays: current.retentionDays,
        policyType: current.policyType,
        actionType: current.actionType,
      },
      after: {
        enabled: updatedPolicy.enabled,
        retentionDays: updatedPolicy.retentionDays,
        policyType: updatedPolicy.policyType,
        actionType: updatedPolicy.actionType,
      },
    },
  });

  return updatedPolicy;
}

/**
 * Pure evaluation function: determines if a single customer record is eligible for retention cleanup
 * according to the strict safe data rules.
 */
export function evaluateCustomerRetentionEligibility(
  customer: {
    id: string;
    account: string;
    customerName: string;
    primaryPhone: string;
    branch?: string | null;
    updatedAt: Date;
    createdAt: Date;
    comment?: string | null;
    installments?: Array<{
      id: string;
      status: string;
      balance: number;
      emi: number;
      updatedAt: Date;
      lastPaymentDate?: Date | null;
      lastPaymentAmount?: number | null;
    }>;
    payments?: Array<{
      id: string;
      paymentDate: Date;
      amount: number;
    }>;
    messageQueues?: Array<{
      id: string;
      status: string;
      approvalStatus?: string;
    }>;
    messageLogs?: Array<{
      id: string;
      sentAt: Date;
    }>;
  },
  policy: DataRetentionPolicy,
  referenceDate: Date = new Date()
): {
  eligible: boolean;
  reasonCode: "ELIGIBLE" | "NO_INSTALLMENTS" | "HAS_UNPAID_BALANCE" | "ACTIVE_PLAN" | "PENDING_QUEUE" | "RECENT_ACTIVITY" | "ALREADY_ARCHIVED";
  reasonText: string;
  lastActivityDate: Date;
  daysInactive: number;
  totalBalance: number;
  totalPaid: number;
} {
  // 1. Check if already archived
  if (customer.comment && customer.comment.includes("ARCHIVED_RETENTION")) {
    return {
      eligible: false,
      reasonCode: "ALREADY_ARCHIVED",
      reasonText: "Record is already archived under data retention policy",
      lastActivityDate: customer.updatedAt,
      daysInactive: 0,
      totalBalance: 0,
      totalPaid: 0,
    };
  }

  const installments = customer.installments || [];
  const payments = customer.payments || [];
  const messageQueues = customer.messageQueues || [];
  const messageLogs = customer.messageLogs || [];

  // 2. Must have at least 1 installment record to evaluate completion safely
  if (installments.length === 0) {
    return {
      eligible: false,
      reasonCode: "NO_INSTALLMENTS",
      reasonText: "Customer has no registered installment agreements",
      lastActivityDate: customer.updatedAt,
      daysInactive: differenceInCalendarDays(startOfDay(referenceDate), startOfDay(customer.updatedAt)),
      totalBalance: 0,
      totalPaid: 0,
    };
  }

  // 3. Outstanding balance check — ANY positive balance strictly protects the account
  const totalBalance = installments.reduce((acc, inst) => acc + (inst.balance || 0), 0);
  if (totalBalance > 0) {
    return {
      eligible: false,
      reasonCode: "HAS_UNPAID_BALANCE",
      reasonText: `Customer has outstanding balance of PKR ${totalBalance.toLocaleString()}`,
      lastActivityDate: customer.updatedAt,
      daysInactive: 0,
      totalBalance,
      totalPaid: payments.reduce((acc, p) => acc + (p.amount || 0), 0),
    };
  }

  // 4. Active or unsettled installment status check
  const activeStatusList = ["OVERDUE", "DUE_TODAY", "UPCOMING", "PARTIAL", "UNKNOWN"];
  const hasActiveInstallment = installments.some((inst) => activeStatusList.includes(inst.status));
  if (hasActiveInstallment) {
    return {
      eligible: false,
      reasonCode: "ACTIVE_PLAN",
      reasonText: "One or more installments are currently active, partial, or unresolved",
      lastActivityDate: customer.updatedAt,
      daysInactive: 0,
      totalBalance,
      totalPaid: payments.reduce((acc, p) => acc + (p.amount || 0), 0),
    };
  }

  // 5. Active message queue check — any pending or in-flight reminder protects the account
  const hasPendingQueue = messageQueues.some(
    (q) => ["QUEUED", "SENDING", "RETRYING"].includes(q.status) || q.approvalStatus === "PENDING_APPROVAL"
  );
  if (hasPendingQueue) {
    return {
      eligible: false,
      reasonCode: "PENDING_QUEUE",
      reasonText: "Customer has messages pending in the WhatsApp dispatch queue",
      lastActivityDate: customer.updatedAt,
      daysInactive: 0,
      totalBalance,
      totalPaid: payments.reduce((acc, p) => acc + (p.amount || 0), 0),
    };
  }

  // 6. Calculate comprehensive Last Activity Date
  // Must consider: customer updates, payment dates, installment updates, and message logs
  const activityDates: Date[] = [customer.updatedAt, customer.createdAt];
  for (const p of payments) {
    if (p.paymentDate) activityDates.push(new Date(p.paymentDate));
  }
  for (const inst of installments) {
    if (inst.updatedAt) activityDates.push(new Date(inst.updatedAt));
    if (inst.lastPaymentDate) activityDates.push(new Date(inst.lastPaymentDate));
  }
  for (const log of messageLogs) {
    if (log.sentAt) activityDates.push(new Date(log.sentAt));
  }

  const lastActivityDate = new Date(Math.max(...activityDates.map((d) => d.getTime())));
  const daysInactive = Math.max(0, differenceInCalendarDays(startOfDay(referenceDate), startOfDay(lastActivityDate)));

  const totalPaid = payments.reduce((acc, p) => acc + (p.amount || 0), 0);

  // 7. Completion Check: Every installment is PAID and balance is 0
  const isFullySettled = installments.every((inst) => inst.status === "PAID" && inst.balance <= 0);

  // 8. Inactivity Check: Inactive period >= policy.retentionDays
  const isPastRetentionPeriod = daysInactive >= policy.retentionDays;

  // 9. Policy-specific evaluation
  if (policy.policyType === "COMPLETION") {
    if (!isFullySettled) {
      return {
        eligible: false,
        reasonCode: "ACTIVE_PLAN",
        reasonText: "Account is not fully settled as PAID",
        lastActivityDate,
        daysInactive,
        totalBalance,
        totalPaid,
      };
    }
    return {
      eligible: true,
      reasonCode: "ELIGIBLE",
      reasonText: `Account is fully settled and verified complete (${daysInactive} days since last activity)`,
      lastActivityDate,
      daysInactive,
      totalBalance,
      totalPaid,
    };
  }

  if (policy.policyType === "INACTIVITY") {
    // Inactivity policy also requires zero unpaid balance (PRD Phase 3: never treat inactive as completed if unpaid)
    if (totalBalance > 0 || !isFullySettled) {
      return {
        eligible: false,
        reasonCode: "HAS_UNPAID_BALANCE",
        reasonText: "Account has open balance or active plan and cannot be retired",
        lastActivityDate,
        daysInactive,
        totalBalance,
        totalPaid,
      };
    }
    if (!isPastRetentionPeriod) {
      return {
        eligible: false,
        reasonCode: "RECENT_ACTIVITY",
        reasonText: `Activity recorded within retention window (${daysInactive} / ${policy.retentionDays} days)`,
        lastActivityDate,
        daysInactive,
        totalBalance,
        totalPaid,
      };
    }
    return {
      eligible: true,
      reasonCode: "ELIGIBLE",
      reasonText: `Account inactive for ${daysInactive} days (exceeds ${policy.retentionDays}-day retention threshold)`,
      lastActivityDate,
      daysInactive,
      totalBalance,
      totalPaid,
    };
  }

  // policyType === "BOTH": Requires both full completion AND inactivity threshold
  if (!isFullySettled) {
    return {
      eligible: false,
      reasonCode: "ACTIVE_PLAN",
      reasonText: "Account is not fully settled as PAID",
      lastActivityDate,
      daysInactive,
      totalBalance,
      totalPaid,
    };
  }

  if (!isPastRetentionPeriod) {
    return {
      eligible: false,
      reasonCode: "RECENT_ACTIVITY",
      reasonText: `Account is settled, but activity was recorded within the retention window (${daysInactive} / ${policy.retentionDays} days)`,
      lastActivityDate,
      daysInactive,
      totalBalance,
      totalPaid,
    };
  }

  return {
    eligible: true,
    reasonCode: "ELIGIBLE",
    reasonText: `All installments fully paid and account inactive for ${daysInactive} days (policy: ${policy.retentionDays}d)`,
    lastActivityDate,
    daysInactive,
    totalBalance,
    totalPaid,
  };
}

/**
 * Dry-run preview: scans tenant records and builds an audit-ready summary without modifying data.
 */
export async function getRetentionPreview(tenantId: string): Promise<RetentionPreviewResult> {
  const policy = await getTenantRetentionPolicy(tenantId);
  const now = new Date();

  const customers = await prisma.customer.findMany({
    where: { tenantId },
    include: {
      installments: true,
      payments: {
        orderBy: { paymentDate: "desc" },
        take: 5,
      },
      messageQueues: {
        where: {
          status: { in: ["QUEUED", "SENDING", "RETRYING"] },
        },
        select: { id: true, status: true, approvalStatus: true },
      },
      messageLogs: {
        orderBy: { sentAt: "desc" },
        take: 3,
        select: { id: true, sentAt: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const breakdown: IneligibilityBreakdown = {
    unpaidBalance: 0,
    activePlan: 0,
    recentActivity: 0,
    pendingQueue: 0,
    noInstallments: 0,
  };

  const eligibleRecords: EligibleCustomerSummary[] = [];
  let protectedCount = 0;

  for (const c of customers) {
    const res = evaluateCustomerRetentionEligibility(c, policy, now);

    if (res.eligible) {
      eligibleRecords.push({
        id: c.id,
        account: c.account,
        customerName: c.customerName,
        primaryPhone: c.primaryPhone,
        branch: c.branch || "MAIN",
        totalBalance: res.totalBalance,
        totalPaid: res.totalPaid,
        planStatus: "PAID",
        lastActivityDate: res.lastActivityDate.toISOString(),
        daysInactive: res.daysInactive,
        eligibilityReason: res.reasonText,
      });
    } else {
      protectedCount++;
      switch (res.reasonCode) {
        case "HAS_UNPAID_BALANCE":
          breakdown.unpaidBalance++;
          break;
        case "ACTIVE_PLAN":
          breakdown.activePlan++;
          break;
        case "RECENT_ACTIVITY":
          breakdown.recentActivity++;
          break;
        case "PENDING_QUEUE":
          breakdown.pendingQueue++;
          break;
        case "NO_INSTALLMENTS":
          breakdown.noInstallments++;
          break;
      }
    }
  }

  return {
    policy,
    totalCustomers: customers.length,
    eligibleCount: eligibleRecords.length,
    protectedCount,
    ineligibilityBreakdown: breakdown,
    eligibleRecords,
    generatedAt: now.toISOString(),
    tenantId,
  };
}

/**
 * Creates and verifies a recoverable database backup snapshot before any destructive cleanup.
 */
export async function createVerifiedRetentionBackup(
  tenantId: string,
  eligibleCustomerIds: string[],
  actorUserId?: string
): Promise<{ snapshotId: string; verified: boolean; error?: string }> {
  try {
    if (eligibleCustomerIds.length === 0) {
      return { snapshotId: "no_records_to_backup", verified: true };
    }

    // Fetch full records for eligible customers to preserve accounting and contract integrity
    const [customers, installments, payments, customerAssignments, messageLogs] = await Promise.all([
      prisma.customer.findMany({
        where: { id: { in: eligibleCustomerIds }, tenantId },
      }),
      prisma.installment.findMany({
        where: { customerId: { in: eligibleCustomerIds } },
      }),
      prisma.payment.findMany({
        where: { customerId: { in: eligibleCustomerIds } },
      }),
      prisma.customerAssignment.findMany({
        where: { customerId: { in: eligibleCustomerIds } },
      }),
      prisma.messageLog.findMany({
        where: { customerId: { in: eligibleCustomerIds } },
      }),
    ]);

    const timestamp = new Date().toISOString();
    const snapshotData = {
      timestamp,
      tenantId,
      backupType: "PRE_CLEANUP_RETENTION",
      counts: {
        customers: customers.length,
        installments: installments.length,
        payments: payments.length,
        customerAssignments: customerAssignments.length,
        messageLogs: messageLogs.length,
      },
      data: {
        customers,
        installments,
        payments,
        customerAssignments,
        messageLogs,
      },
    };

    const snapshot = await prisma.backupSnapshot.create({
      data: {
        name: `Pre-Cleanup Retention Backup (${customers.length} records) - ${timestamp.split("T")[0]}`,
        type: "PRE_CLEANUP_RETENTION",
        tenantId,
        recordCounts: JSON.stringify(snapshotData.counts),
        dataJson: JSON.stringify(snapshotData),
        userId: actorUserId || null,
      },
    });

    // Integrity Verification Step
    const verifiedSnapshot = await prisma.backupSnapshot.findUnique({
      where: { id: snapshot.id },
      select: { id: true, dataJson: true, recordCounts: true },
    });

    if (!verifiedSnapshot || !verifiedSnapshot.dataJson) {
      return { snapshotId: snapshot.id, verified: false, error: "Backup snapshot could not be verified in database" };
    }

    const parsedData = JSON.parse(verifiedSnapshot.dataJson);
    if (!parsedData.data?.customers || parsedData.data.customers.length !== eligibleCustomerIds.length) {
      return {
        snapshotId: snapshot.id,
        verified: false,
        error: `Integrity check failed: Expected ${eligibleCustomerIds.length} records, snapshot contains ${parsedData.data?.customers?.length || 0}`,
      };
    }

    return { snapshotId: snapshot.id, verified: true };
  } catch (error: any) {
    return { snapshotId: "", verified: false, error: error.message || "Failed to create verified backup" };
  }
}

/**
 * Concurrency Lock: Prevents duplicate or overlapping cleanup jobs.
 */
async function acquireTenantRetentionLock(tenantId: string): Promise<boolean> {
  const now = Date.now();
  try {
    const existingLock = await prisma.systemSetting.findUnique({
      where: { key_tenantId: { key: LOCK_SETTING_KEY, tenantId } },
    });

    if (existingLock && existingLock.value) {
      const lockTimestamp = parseInt(existingLock.value, 10);
      if (!isNaN(lockTimestamp) && now - lockTimestamp < LOCK_LEASE_MS) {
        return false; // Still locked
      }
    }

    await prisma.systemSetting.upsert({
      where: { key_tenantId: { key: LOCK_SETTING_KEY, tenantId } },
      update: { value: String(now), description: "Data Retention Execution Mutex Lock" },
      create: { key: LOCK_SETTING_KEY, tenantId, value: String(now), description: "Data Retention Execution Mutex Lock" },
    });

    return true;
  } catch {
    return false;
  }
}

async function releaseTenantRetentionLock(tenantId: string): Promise<void> {
  try {
    await prisma.systemSetting.deleteMany({
      where: { key: LOCK_SETTING_KEY, tenantId },
    });
  } catch {}
}

/**
 * Main execution function: Performs the safe data retention cleanup workflow.
 */
export async function executeRetentionCleanup(
  tenantId: string,
  options: {
    actorUserId?: string;
    automated?: boolean;
    dryRun?: boolean;
    forceBypassLock?: boolean;
  } = {}
): Promise<RetentionRunResult> {
  const policy = await getTenantRetentionPolicy(tenantId);
  const now = new Date();

  // Guard 1: Automatic cleanup must be enabled if triggered by automated cron
  if (options.automated && !policy.enabled) {
    return {
      timestamp: now.toISOString(),
      triggeredBy: "AUTOMATED_CRON",
      policy: {
        retentionDays: policy.retentionDays,
        policyType: policy.policyType,
        actionType: policy.actionType,
      },
      totalInspected: 0,
      eligibleCount: 0,
      processedCount: 0,
      protectedCount: 0,
      status: "ABORTED",
      reason: "Automatic Data Retention cleanup is currently DISABLED for this company in Admin Settings.",
    };
  }

  // Guard 2: Concurrency Lock to prevent overlapping runs
  if (!options.forceBypassLock) {
    const acquired = await acquireTenantRetentionLock(tenantId);
    if (!acquired) {
      return {
        timestamp: now.toISOString(),
        triggeredBy: options.automated ? "AUTOMATED_CRON" : "MANUAL",
        actorUserId: options.actorUserId,
        policy: {
          retentionDays: policy.retentionDays,
          policyType: policy.policyType,
          actionType: policy.actionType,
        },
        totalInspected: 0,
        eligibleCount: 0,
        processedCount: 0,
        protectedCount: 0,
        status: "ABORTED",
        reason: "Another data retention cleanup operation is currently in progress for this company. Please wait.",
      };
    }
  }

  try {
    // 1. Run evaluation preview to identify eligible records strictly scoped to tenant
    const preview = await getRetentionPreview(tenantId);

    if (options.dryRun) {
      await releaseTenantRetentionLock(tenantId);
      return {
        timestamp: now.toISOString(),
        triggeredBy: "MANUAL",
        actorUserId: options.actorUserId,
        policy: {
          retentionDays: policy.retentionDays,
          policyType: policy.policyType,
          actionType: policy.actionType,
        },
        totalInspected: preview.totalCustomers,
        eligibleCount: preview.eligibleCount,
        processedCount: 0,
        protectedCount: preview.protectedCount,
        status: "SUCCESS",
        reason: "Dry-run preview completed successfully. Zero records were modified.",
        details: { breakdown: preview.ineligibilityBreakdown },
      };
    }

    if (preview.eligibleCount === 0) {
      await releaseTenantRetentionLock(tenantId);
      const result: RetentionRunResult = {
        timestamp: now.toISOString(),
        triggeredBy: options.automated ? "AUTOMATED_CRON" : "MANUAL",
        actorUserId: options.actorUserId,
        policy: {
          retentionDays: policy.retentionDays,
          policyType: policy.policyType,
          actionType: policy.actionType,
        },
        totalInspected: preview.totalCustomers,
        eligibleCount: 0,
        processedCount: 0,
        protectedCount: preview.protectedCount,
        status: "SUCCESS",
        reason: "Scan completed. All customer records are active, ongoing, or within retention limits. Zero records required cleanup.",
      };

      await updatePolicyRunResult(tenantId, result);
      return result;
    }

    const eligibleIds = preview.eligibleRecords.map((r) => r.id);

    // 2. Verified Backup Requirement
    let backupSnapshotId: string | null = null;
    if (policy.requireBackupBeforeDeletion || policy.actionType === "PERMANENT_DELETE") {
      const backupResult = await createVerifiedRetentionBackup(tenantId, eligibleIds, options.actorUserId);

      if (!backupResult.verified) {
        await releaseTenantRetentionLock(tenantId);
        const abortedResult: RetentionRunResult = {
          timestamp: now.toISOString(),
          triggeredBy: options.automated ? "AUTOMATED_CRON" : "MANUAL",
          actorUserId: options.actorUserId,
          policy: {
            retentionDays: policy.retentionDays,
            policyType: policy.policyType,
            actionType: policy.actionType,
          },
          totalInspected: preview.totalCustomers,
          eligibleCount: preview.eligibleCount,
          processedCount: 0,
          protectedCount: preview.protectedCount,
          status: "FAILED",
          reason: `Cleanup aborted: Pre-deletion backup verification failed: ${backupResult.error || "Unknown error"}`,
        };
        await updatePolicyRunResult(tenantId, abortedResult);
        return abortedResult;
      }
      backupSnapshotId = backupResult.snapshotId;
    }

    // 3. Execution (Archive vs Permanent Delete)
    let processedCount = 0;

    if (policy.actionType === "ARCHIVE") {
      // Soft-archive: Mark comment with retention stamp and optOut to prevent WhatsApp reminders
      const archiveStamp = `[ARCHIVED_RETENTION_${now.toISOString().split("T")[0]}]`;
      const updateResult = await prisma.customer.updateMany({
        where: { id: { in: eligibleIds }, tenantId },
        data: {
          optedOut: true,
          comment: archiveStamp,
        },
      });
      processedCount = updateResult.count;
    } else if (policy.actionType === "PERMANENT_DELETE") {
      // Permanent Purge: Only after verified backup
      const deleteResult = await prisma.customer.deleteMany({
        where: { id: { in: eligibleIds }, tenantId },
      });
      processedCount = deleteResult.count;
    }

    // 4. Record Audit Logs & Result
    const runResult: RetentionRunResult = {
      timestamp: now.toISOString(),
      triggeredBy: options.automated ? "AUTOMATED_CRON" : "MANUAL",
      actorUserId: options.actorUserId,
      policy: {
        retentionDays: policy.retentionDays,
        policyType: policy.policyType,
        actionType: policy.actionType,
      },
      totalInspected: preview.totalCustomers,
      eligibleCount: preview.eligibleCount,
      processedCount,
      protectedCount: preview.protectedCount,
      backupSnapshotId,
      status: "SUCCESS",
      reason: `Successfully ${policy.actionType === "ARCHIVE" ? "archived" : "purged"} ${processedCount} completed/inactive customer records. All active debts and ongoing accounts preserved.`,
    };

    await logActivity({
      userId: options.actorUserId,
      tenantId,
      action: "DATA_RETENTION_CLEANUP",
      entityType: "SystemSetting",
      details: {
        processedCount,
        actionType: policy.actionType,
        retentionDays: policy.retentionDays,
        policyType: policy.policyType,
        backupSnapshotId,
        triggeredBy: options.automated ? "AUTOMATED_CRON" : "MANUAL",
      },
    });

    await updatePolicyRunResult(tenantId, runResult);
    return runResult;
  } catch (err: any) {
    const failedResult: RetentionRunResult = {
      timestamp: now.toISOString(),
      triggeredBy: options.automated ? "AUTOMATED_CRON" : "MANUAL",
      actorUserId: options.actorUserId,
      policy: {
        retentionDays: policy.retentionDays,
        policyType: policy.policyType,
        actionType: policy.actionType,
      },
      totalInspected: 0,
      eligibleCount: 0,
      processedCount: 0,
      protectedCount: 0,
      status: "FAILED",
      reason: `Execution failed with unexpected error: ${err.message || String(err)}`,
    };
    await updatePolicyRunResult(tenantId, failedResult);
    return failedResult;
  } finally {
    await releaseTenantRetentionLock(tenantId);
  }
}

async function updatePolicyRunResult(tenantId: string, result: RetentionRunResult): Promise<void> {
  try {
    const current = await getTenantRetentionPolicy(tenantId);
    current.lastRunAt = result.timestamp;
    current.lastRunResult = result;

    await prisma.systemSetting.upsert({
      where: { key_tenantId: { key: SETTING_KEY, tenantId } },
      update: { value: JSON.stringify(current) },
      create: { key: SETTING_KEY, tenantId, value: JSON.stringify(current) },
    });
  } catch (err) {
    console.error(`[Retention Engine] Failed to record run result for tenant ${tenantId}:`, err);
  }
}
