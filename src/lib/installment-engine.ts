import { differenceInCalendarDays, startOfDay, isSameDay } from "date-fns";

export type InstallmentStatusType =
  | "UPCOMING"
  | "DUE_TODAY"
  | "OVERDUE"
  | "PAID"
  | "PARTIAL"
  | "UNKNOWN";

export interface StatusEvaluationParams {
  dueDate: Date | null;
  emi: number;
  balance: number;
  shortExcess?: number;
  lastPaymentDate?: Date | null;
  lastPaymentAmount?: number | null;
  installmentTotal?: number;
  advanceReceived?: number;
  statusOverridden?: boolean;
  overriddenStatus?: InstallmentStatusType | null;
}

export interface StatusEvaluationResult {
  status: InstallmentStatusType;
  daysOverdue: number;
  daysUntilDue: number;
  isEligibleForReminder: boolean;
  reason: string;
}

/**
 * Evaluates the payment/installment status of a customer record reliably
 */
export function calculateInstallmentStatus(
  params: StatusEvaluationParams,
  referenceDate: Date = new Date()
): StatusEvaluationResult {
  if (params.statusOverridden && params.overriddenStatus) {
    const daysOverdue = params.dueDate ? Math.max(0, differenceInCalendarDays(startOfDay(referenceDate), startOfDay(params.dueDate))) : 0;
    const daysUntilDue = params.dueDate ? Math.max(0, differenceInCalendarDays(startOfDay(params.dueDate), startOfDay(referenceDate))) : 0;
    return {
      status: params.overriddenStatus,
      daysOverdue,
      daysUntilDue,
      isEligibleForReminder: params.overriddenStatus !== "PAID" && params.overriddenStatus !== "UNKNOWN",
      reason: "Status was manually overridden by staff",
    };
  }

  // If due date is missing or invalid, we cannot assume anything safely
  if (!params.dueDate || isNaN(params.dueDate.getTime())) {
    return {
      status: "UNKNOWN",
      daysOverdue: 0,
      daysUntilDue: 0,
      isEligibleForReminder: false,
      reason: "Missing or invalid due date in customer record",
    };
  }

  const today = startOfDay(referenceDate);
  const due = startOfDay(params.dueDate);

  const daysOverdue = Math.max(0, differenceInCalendarDays(today, due));
  const daysUntilDue = Math.max(0, differenceInCalendarDays(due, today));

  // Check if balance is fully paid (0 balance)
  if (params.balance <= 0) {
    return {
      status: "PAID",
      daysOverdue: 0,
      daysUntilDue: 0,
      isEligibleForReminder: false,
      reason: "Loan/Installment balance is fully cleared (0 remaining balance)",
    };
  }

  // Check if paid recently for this cycle
  if (params.lastPaymentDate && isSameMonthOrCycle(params.lastPaymentDate, params.dueDate)) {
    const paidAmount = params.lastPaymentAmount || 0;
    if (paidAmount >= params.emi && params.balance <= 0) {
      return {
        status: "PAID",
        daysOverdue: 0,
        daysUntilDue: 0,
        isEligibleForReminder: false,
        reason: `Payment of Rs. ${paidAmount} received on ${params.lastPaymentDate.toISOString().split("T")[0]}`,
      };
    } else if (paidAmount > 0 && paidAmount < params.emi && params.balance > 0) {
      return {
        status: "PARTIAL",
        daysOverdue,
        daysUntilDue,
        isEligibleForReminder: true,
        reason: `Partial payment of Rs. ${paidAmount} received against EMI Rs. ${params.emi}`,
      };
    }
  }

  // Date-based evaluation for outstanding balances
  if (isSameDay(due, today)) {
    return {
      status: "DUE_TODAY",
      daysOverdue: 0,
      daysUntilDue: 0,
      isEligibleForReminder: true,
      reason: "Installment is due today",
    };
  }

  if (due > today) {
    return {
      status: "UPCOMING",
      daysOverdue: 0,
      daysUntilDue,
      isEligibleForReminder: daysUntilDue <= 3, // eligible for before-due reminder
      reason: `Installment is upcoming in ${daysUntilDue} day(s)`,
    };
  }

  if (due < today) {
    return {
      status: "OVERDUE",
      daysOverdue,
      daysUntilDue: 0,
      isEligibleForReminder: true,
      reason: `Installment is overdue by ${daysOverdue} day(s)`,
    };
  }

  return {
    status: "UNKNOWN",
    daysOverdue: 0,
    daysUntilDue: 0,
    isEligibleForReminder: false,
    reason: "Insufficient data to determine payment status",
  };
}

function isSameMonthOrCycle(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth()
  );
}

/**
 * Formats status for UI display with badges and color classes
 */
export function getStatusBadgeConfig(status: string) {
  switch (status) {
    case "PAID":
      return {
        label: "Paid",
        color: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300",
        dot: "bg-emerald-500",
      };
    case "DUE_TODAY":
      return {
        label: "Due Today",
        color: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300",
        dot: "bg-amber-500",
      };
    case "OVERDUE":
      return {
        label: "Overdue",
        color: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300",
        dot: "bg-rose-500",
      };
    case "UPCOMING":
      return {
        label: "Upcoming",
        color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300",
        dot: "bg-blue-500",
      };
    case "PARTIAL":
      return {
        label: "Partial",
        color: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300",
        dot: "bg-purple-500",
      };
    default:
      return {
        label: "Unknown",
        color: "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300",
        dot: "bg-gray-400",
      };
  }
}
