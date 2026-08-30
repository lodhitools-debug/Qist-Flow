import { createHash } from "crypto";
import { format } from "date-fns";

export interface IdempotencyParams {
  customerId: string;
  reminderType: string;
  dueDate: Date | string | null;
  cycleKey?: string; // Optional monthly cycle token e.g. "2026-09"
}

/**
 * Generates an idempotent unique hash for a reminder message to prevent duplicate sending
 */
export function generateMessageIdempotencyKey(params: IdempotencyParams): string {
  let datePart = "nodate";
  if (params.dueDate) {
    try {
      const d = typeof params.dueDate === "string" ? new Date(params.dueDate) : params.dueDate;
      datePart = format(d, "yyyy-MM-dd");
    } catch {
      datePart = String(params.dueDate);
    }
  }

  const cycle = params.cycleKey || datePart;
  const rawString = `${params.customerId}:${params.reminderType.toUpperCase()}:${datePart}:${cycle}`;

  // Return md5 hash
  return createHash("md5").update(rawString).digest("hex");
}

/**
 * Generates manual message unique key
 */
export function generateManualMessageKey(customerId: string, phone: string): string {
  const timestamp = Math.floor(Date.now() / (1000 * 60 * 5)); // 5-minute deduplication window for accidental double-clicks
  return createHash("md5").update(`MANUAL:${customerId}:${phone}:${timestamp}`).digest("hex");
}
