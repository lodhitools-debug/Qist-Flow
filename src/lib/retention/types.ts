export type RetentionPeriodDays = 30 | 60 | 90;

export type RetentionPolicyType = "INACTIVITY" | "COMPLETION" | "BOTH";

export type RetentionActionType = "ARCHIVE" | "PERMANENT_DELETE";

export interface DataRetentionPolicy {
  enabled: boolean;
  retentionDays: RetentionPeriodDays;
  policyType: RetentionPolicyType;
  actionType: RetentionActionType;
  requireBackupBeforeDeletion: boolean;
  notifyAdminsOnCleanup: boolean;
  lastRunAt?: string | null;
  lastRunResult?: RetentionRunResult | null;
}

export interface RetentionRunResult {
  timestamp: string;
  triggeredBy: "MANUAL" | "AUTOMATED_CRON";
  actorUserId?: string | null;
  policy: {
    retentionDays: number;
    policyType: string;
    actionType: string;
  };
  totalInspected: number;
  eligibleCount: number;
  processedCount: number;
  protectedCount: number;
  backupSnapshotId?: string | null;
  status: "SUCCESS" | "FAILED" | "ABORTED";
  reason?: string;
  details?: Record<string, any>;
}

export interface IneligibilityBreakdown {
  unpaidBalance: number;
  activePlan: number;
  recentActivity: number;
  pendingQueue: number;
  noInstallments: number;
}

export interface EligibleCustomerSummary {
  id: string;
  account: string;
  customerName: string;
  primaryPhone: string;
  branch: string;
  totalBalance: number;
  totalPaid: number;
  planStatus: string;
  lastActivityDate: string;
  daysInactive: number;
  eligibilityReason: string;
}

export interface RetentionPreviewResult {
  policy: DataRetentionPolicy;
  totalCustomers: number;
  eligibleCount: number;
  protectedCount: number;
  ineligibilityBreakdown: IneligibilityBreakdown;
  eligibleRecords: EligibleCustomerSummary[];
  generatedAt: string;
  tenantId: string;
}

export const DEFAULT_RETENTION_POLICY: DataRetentionPolicy = {
  enabled: false,
  retentionDays: 90,
  policyType: "BOTH",
  actionType: "ARCHIVE",
  requireBackupBeforeDeletion: true,
  notifyAdminsOnCleanup: true,
  lastRunAt: null,
  lastRunResult: null,
};
