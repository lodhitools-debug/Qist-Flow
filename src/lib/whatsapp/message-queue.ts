import { prisma } from "../prisma";
import { getWhatsAppProvider } from "./provider-factory";
import {
  generateMessageIdempotencyKey,
  generateGuarantorMessageKey,
  generateManualMessageKey,
  generateManualGuarantorKey,
} from "./duplicate-guard";

export interface EnqueueMessageParams {
  recipientPhone: string;
  recipientName?: string;
  recipientType?: "CUSTOMER" | "GUARANTOR_1" | "GUARANTOR_2" | string;
  guarantorId?: string;
  messageText: string;
  customerId?: string;
  installmentId?: string;
  templateId?: string;
  messageType?:
    | "REMINDER"
    | "MANUAL"
    | "PAYMENT_CONFIRMATION"
    | "GUARANTOR_FIRST_NOTICE"
    | "GUARANTOR_FOLLOWUP"
    | "GUARANTOR_FINAL_NOTICE"
    | string;
  escalationLevel?: number;
  approvalStatus?: "NOT_REQUIRED" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  escalationReason?: string;
  dueDate?: Date | string | null;
  priority?: number;
  scheduledFor?: Date;
}

export interface EnqueueResult {
  success: boolean;
  queueId?: string;
  isDuplicate?: boolean;
  error?: string;
}

/**
 * Adds a single message to the persistent sending queue with duplicate protection
 * Priority: 100 = Manual, 50 = Guarantor Escalation, 20 = Normal Reminder, 10 = Scheduled Cron
 */
export async function enqueueMessage(params: EnqueueMessageParams): Promise<EnqueueResult> {
  const cleanPhone = params.recipientPhone.replace(/[^0-9]/g, "");
  if (!cleanPhone || cleanPhone.length < 10) {
    return { success: false, error: "Invalid recipient phone number" };
  }

  const recipientType = params.recipientType || "CUSTOMER";

  // Check customer opt-out
  if (params.customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: params.customerId },
      select: { optedOut: true },
    });
    if (customer?.optedOut) {
      return { success: false, error: "Customer has opted out of WhatsApp messages" };
    }
  }

  // Generate unique idempotency key
  let idempotencyKey = "";
  if (params.messageType === "MANUAL") {
    if (recipientType === "CUSTOMER") {
      idempotencyKey = generateManualMessageKey(params.customerId || "unknown", cleanPhone);
    } else {
      idempotencyKey = generateManualGuarantorKey(params.customerId || "unknown", recipientType, cleanPhone);
    }
  } else if (["GUARANTOR_1", "GUARANTOR_2"].includes(recipientType)) {
    idempotencyKey = generateGuarantorMessageKey({
      customerId: params.customerId || cleanPhone,
      guarantorType: recipientType,
      messageType: params.messageType || "GUARANTOR_FIRST_NOTICE",
      dueDate: params.dueDate || new Date(),
      escalationLevel: params.escalationLevel || 1,
    });
  } else {
    idempotencyKey = generateMessageIdempotencyKey({
      customerId: params.customerId || cleanPhone,
      reminderType: params.messageType || "REMINDER",
      dueDate: params.dueDate || new Date(),
    });
  }

  const priority =
    params.priority !== undefined
      ? params.priority
      : params.messageType === "MANUAL"
      ? 100
      : ["GUARANTOR_1", "GUARANTOR_2"].includes(recipientType)
      ? 50
      : 20;

  const approvalStatus = params.approvalStatus || "NOT_REQUIRED";

  try {
    const queueItem = await prisma.messageQueue.upsert({
      where: { idempotencyKey },
      update: {
        status: "QUEUED",
        errorMessage: null,
        scheduledFor: params.scheduledFor || new Date(),
        priority,
        approvalStatus,
      },
      create: {
        recipientPhone: cleanPhone,
        recipientName: params.recipientName,
        recipientType,
        guarantorId: params.guarantorId || (recipientType !== "CUSTOMER" ? recipientType : null),
        customerId: params.customerId,
        installmentId: params.installmentId,
        templateId: params.templateId,
        messageType: params.messageType || "REMINDER",
        escalationLevel: params.escalationLevel || 0,
        approvalStatus,
        escalationReason: params.escalationReason,
        messageText: params.messageText,
        priority,
        idempotencyKey,
        scheduledFor: params.scheduledFor || new Date(),
        status: "QUEUED",
      },
    });

    return { success: true, queueId: queueItem.id };
  } catch (err: any) {
    if (err.code === "P2002") {
      return { success: false, isDuplicate: true, error: "Duplicate reminder prevented by safety guard." };
    }
    return { success: false, error: err.message };
  }
}

/**
 * Enqueues a batch of messages
 */
export async function enqueueBatch(items: EnqueueMessageParams[]): Promise<{
  total: number;
  enqueued: number;
  duplicates: number;
  errors: number;
}> {
  let enqueued = 0;
  let duplicates = 0;
  let errors = 0;

  for (const item of items) {
    const res = await enqueueMessage(item);
    if (res.success) {
      enqueued++;
    } else if (res.isDuplicate) {
      duplicates++;
    } else {
      errors++;
    }
  }

  return { total: items.length, enqueued, duplicates, errors };
}

/**
 * Processes a chunk of queued messages with priority sorting, approval checks, and rate-limit throttling
 */
export async function processQueueWorker(maxBatchSize: number = 10): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const provider = getWhatsAppProvider();
  const connState = await provider.getConnectionState();

  if (connState !== "CONNECTED") {
    return { processed: 0, sent: 0, failed: 0 };
  }

  // Get pending items ordered by priority DESC (manual priority 100 first, then guarantor 50, then reminders), then createdAt ASC
  // EXCLUDE messages waiting for manager approval
  const pendingItems = await prisma.messageQueue.findMany({
    where: {
      status: "QUEUED",
      approvalStatus: { not: "PENDING_APPROVAL" },
      scheduledFor: { lte: new Date() },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: maxBatchSize,
  });

  if (pendingItems.length === 0) {
    return { processed: 0, sent: 0, failed: 0 };
  }

  let sentCount = 0;
  let failedCount = 0;

  const minDelay = parseInt(process.env.WHATSAPP_RATE_LIMIT_MIN_DELAY_MS || "3000", 10);
  const maxDelay = parseInt(process.env.WHATSAPP_RATE_LIMIT_MAX_DELAY_MS || "8000", 10);

  for (const item of pendingItems) {
    // Mark as SENDING
    await prisma.messageQueue.update({
      where: { id: item.id },
      data: { status: "SENDING" },
    });

    // Throttling: high-priority manual messages use short jitter, bulk reminders use normal jitter
    const isManualHighPriority = item.priority >= 100;
    const delayMs = isManualHighPriority
      ? 800
      : Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

    await new Promise((resolve) => setTimeout(resolve, delayMs));

    // Send via provider
    const sendResult = await provider.sendMessage({
      recipientPhone: item.recipientPhone,
      messageText: item.messageText,
      customerId: item.customerId || undefined,
      installmentId: item.installmentId || undefined,
      queueId: item.id,
    });

    if (sendResult.success) {
      sentCount++;
      await prisma.messageQueue.update({
        where: { id: item.id },
        data: {
          status: "SENT",
          sentAt: sendResult.timestamp || new Date(),
          errorMessage: null,
        },
      });

      // Log delivery in MessageLog
      await prisma.messageLog.create({
        data: {
          direction: "OUTBOUND",
          recipientPhone: item.recipientPhone,
          recipientName: item.recipientName,
          recipientType: item.recipientType,
          guarantorId: item.guarantorId,
          escalationLevel: item.escalationLevel,
          customerId: item.customerId,
          messageText: item.messageText,
          messageType: item.messageType,
          status: "SENT",
          waMessageId: sendResult.messageId,
          sentAt: sendResult.timestamp || new Date(),
        },
      }).catch(() => {});
    } else {
      failedCount++;
      const nextRetry = item.retryCount + 1;
      const willRetry = nextRetry < item.maxRetries;

      await prisma.messageQueue.update({
        where: { id: item.id },
        data: {
          status: willRetry ? "QUEUED" : "FAILED",
          retryCount: nextRetry,
          errorMessage: sendResult.error,
          scheduledFor: willRetry ? new Date(Date.now() + 1000 * 60 * 15) : item.scheduledFor,
        },
      });

      await prisma.messageLog.create({
        data: {
          direction: "OUTBOUND",
          recipientPhone: item.recipientPhone,
          recipientName: item.recipientName,
          recipientType: item.recipientType,
          guarantorId: item.guarantorId,
          escalationLevel: item.escalationLevel,
          customerId: item.customerId,
          messageText: item.messageText,
          messageType: item.messageType,
          status: "FAILED",
          errorMessage: sendResult.error,
          sentAt: new Date(),
        },
      }).catch(() => {});
    }
  }

  return {
    processed: pendingItems.length,
    sent: sentCount,
    failed: failedCount,
  };
}

/**
 * Returns queue summary statistics
 */
export async function getQueueStats() {
  const [queued, sending, pendingApproval, sentToday, failedToday] = await Promise.all([
    prisma.messageQueue.count({ where: { status: "QUEUED", approvalStatus: { not: "PENDING_APPROVAL" } } }),
    prisma.messageQueue.count({ where: { status: "SENDING" } }),
    prisma.messageQueue.count({ where: { approvalStatus: "PENDING_APPROVAL", status: "QUEUED" } }),
    prisma.messageLog.count({
      where: {
        status: "SENT",
        sentAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
    prisma.messageLog.count({
      where: {
        status: "FAILED",
        sentAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
  ]);

  return {
    queued,
    sending,
    pendingApproval,
    sentToday,
    failedToday,
  };
}
