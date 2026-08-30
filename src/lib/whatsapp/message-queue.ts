import { prisma } from "../prisma";
import { getWhatsAppProvider } from "./provider-factory";
import { generateMessageIdempotencyKey } from "./duplicate-guard";

export interface EnqueueMessageParams {
  recipientPhone: string;
  messageText: string;
  customerId?: string;
  installmentId?: string;
  templateId?: string;
  messageType?: "REMINDER" | "MANUAL" | "PAYMENT_CONFIRMATION";
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
 */
export async function enqueueMessage(params: EnqueueMessageParams): Promise<EnqueueResult> {
  const cleanPhone = params.recipientPhone.replace(/[^0-9]/g, "");
  if (!cleanPhone || cleanPhone.length < 10) {
    return { success: false, error: "Invalid recipient phone number" };
  }

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
  const idempotencyKey = generateMessageIdempotencyKey({
    customerId: params.customerId || cleanPhone,
    reminderType: params.messageType || "REMINDER",
    dueDate: params.dueDate || new Date(),
  });

  try {
    const queueItem = await prisma.messageQueue.upsert({
      where: { idempotencyKey },
      update: {
        // If already failed or cancelled, allow re-queueing
        status: "QUEUED",
        errorMessage: null,
        scheduledFor: params.scheduledFor || new Date(),
      },
      create: {
        recipientPhone: cleanPhone,
        customerId: params.customerId,
        installmentId: params.installmentId,
        templateId: params.templateId,
        messageType: params.messageType || "REMINDER",
        messageText: params.messageText,
        priority: params.priority || 0,
        idempotencyKey,
        scheduledFor: params.scheduledFor || new Date(),
        status: "QUEUED",
      },
    });

    return { success: true, queueId: queueItem.id };
  } catch (err: any) {
    if (err.code === "P2002") {
      // Duplicate unique constraint
      return { success: false, isDuplicate: true, error: "Duplicate reminder prevented by safety guard." };
    }
    return { success: false, error: err.message };
  }
}

/**
 * Enqueues a batch of messages inside a transaction
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
 * Processes a chunk of queued messages with random delays to prevent WhatsApp rate limits
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

  // Get pending items ordered by priority (highest first) and scheduledFor
  const pendingItems = await prisma.messageQueue.findMany({
    where: {
      status: "QUEUED",
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

  const minDelay = parseInt(process.env.WHATSAPP_RATE_LIMIT_MIN_DELAY_MS || "6000", 10);
  const maxDelay = parseInt(process.env.WHATSAPP_RATE_LIMIT_MAX_DELAY_MS || "14000", 10);

  for (const item of pendingItems) {
    // Mark as SENDING
    await prisma.messageQueue.update({
      where: { id: item.id },
      data: { status: "SENDING" },
    });

    // Anti-ban random delay jitter
    const delayMs = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
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
          sentAt: sendResult.timestamp,
          errorMessage: null,
        },
      });

      // Log delivery in MessageLog
      await prisma.messageLog.create({
        data: {
          direction: "OUTBOUND",
          recipientPhone: item.recipientPhone,
          customerId: item.customerId,
          messageText: item.messageText,
          messageType: item.messageType,
          status: "SENT",
          waMessageId: sendResult.messageId,
          sentAt: sendResult.timestamp,
        },
      });
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
          scheduledFor: willRetry ? new Date(Date.now() + 1000 * 60 * 15) : item.scheduledFor, // retry in 15 mins
        },
      });

      await prisma.messageLog.create({
        data: {
          direction: "OUTBOUND",
          recipientPhone: item.recipientPhone,
          customerId: item.customerId,
          messageText: item.messageText,
          messageType: item.messageType,
          status: "FAILED",
          errorMessage: sendResult.error,
          sentAt: new Date(),
        },
      });
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
  const [queued, sending, sentToday, failedToday] = await Promise.all([
    prisma.messageQueue.count({ where: { status: "QUEUED" } }),
    prisma.messageQueue.count({ where: { status: "SENDING" } }),
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
    sentToday,
    failedToday,
  };
}
