import { prisma } from "../prisma";
import { waSessionManager } from "./session-manager";
import { WhatsAppCloudProvider } from "./cloud-provider";
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
  senderUserId?: string;
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
 */
export async function enqueueMessage(params: EnqueueMessageParams): Promise<EnqueueResult> {
  const cleanPhone = params.recipientPhone.replace(/[^0-9]/g, "");
  if (!cleanPhone || cleanPhone.length < 10) {
    return { success: false, error: "Invalid recipient phone number" };
  }

  // Strict Anti-Ban Guard: Never enqueue empty or whitespace-only messages
  const trimmedText = typeof params.messageText === "string" ? params.messageText.trim() : "";
  if (!trimmedText) {
    return { success: false, error: "Message text cannot be empty" };
  }

  const recipientType = params.recipientType || "CUSTOMER";

  let senderUserId = params.senderUserId;

  // Check customer opt-out and lookup assigned officer if senderUserId is not explicitly provided
  if (params.customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: params.customerId },
      select: { optedOut: true, assignedToUserId: true, assignedManagerId: true },
    });
    if (customer?.optedOut) {
      return { success: false, error: "Customer has opted out of WhatsApp messages" };
    }
    if (!senderUserId) {
      senderUserId = customer?.assignedToUserId || customer?.assignedManagerId || undefined;
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
        senderUserId: senderUserId || undefined,
        status: "QUEUED",
        errorMessage: null,
        scheduledFor: params.scheduledFor || new Date(),
        priority,
        approvalStatus,
      },
      create: {
        senderUserId,
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

  // Process in chunks of 50 to avoid connection pooling issues but still be 50x faster
  const chunkSize = 50;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const results = await Promise.all(chunk.map((item) => enqueueMessage(item)));
    
    for (const res of results) {
      if (res.success) {
        enqueued++;
      } else if (res.isDuplicate) {
        duplicates++;
      } else {
        errors++;
      }
    }
  }

  return { total: items.length, enqueued, duplicates, errors };
}

/**
 * Processes a chunk of queued messages with priority sorting, approval checks, and user-isolated WhatsApp dispatch
 */
export async function processQueueWorker(maxBatchSize: number = 10, forceProcessAll: boolean = false): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  // Auto-recover any stale SENDING messages older than 5 minutes, and purge any empty messages
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    await prisma.messageQueue.updateMany({
      where: {
        status: "SENDING",
        updatedAt: { lte: fiveMinutesAgo },
      },
      data: {
        status: "QUEUED",
      },
    });

    // Auto-cancel empty messages to stop bot-flagging
    await prisma.messageQueue.updateMany({
      where: {
        status: "QUEUED",
        messageText: "",
      },
      data: {
        status: "CANCELLED",
        errorMessage: "Cancelled by Anti-Ban Safeguard: Empty message body",
      },
    });
  } catch {}

  // Daily anti-ban safety limit check (prevents runaway blasting)
  try {
    const todaySent = await prisma.messageLog.count({
      where: {
        status: "SENT",
        sentAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    });
    const maxDaily = parseInt(process.env.WHATSAPP_DAILY_MAX_MESSAGES || "100", 10);
    if (todaySent >= maxDaily) {
      console.warn(`🛑 [Queue Worker] Daily safety cap reached (${todaySent}/${maxDaily}). Dispatch paused to protect WhatsApp account from ban.`);
      return { processed: 0, sent: 0, failed: 0 };
    }
  } catch {}

  // Get pending items ordered by priority DESC (manual priority 100 first, then guarantor 50, then reminders), then createdAt ASC
  const pendingItems = await prisma.messageQueue.findMany({
    where: {
      status: "QUEUED",
      approvalStatus: { not: "PENDING_APPROVAL" },
      ...(forceProcessAll ? {} : { scheduledFor: { lte: new Date() } }),
    },
    include: {
      template: true,
      customer: true,
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: maxBatchSize,
  });

  if (pendingItems.length === 0) {
    return { processed: 0, sent: 0, failed: 0 };
  }

  let sentCount = 0;
  let failedCount = 0;

  // Anti-Ban Rate Limit Delays (Minimum 8s-18s between automatic messages)
  const minDelay = Math.max(8000, parseInt(process.env.WHATSAPP_RATE_LIMIT_MIN_DELAY_MS || "8000", 10));
  const maxDelay = Math.max(minDelay + 3000, parseInt(process.env.WHATSAPP_RATE_LIMIT_MAX_DELAY_MS || "18000", 10));

  for (const item of pendingItems) {
    // Strict Anti-Ban Guard: Refuse empty messages
    const trimmedText = typeof item.messageText === "string" ? item.messageText.trim() : "";
    if (!trimmedText) {
      console.warn(`⚠️ [Queue Worker] Rejecting queue item ${item.id} with empty message text.`);
      await prisma.messageQueue.update({
        where: { id: item.id },
        data: {
          status: "FAILED",
          errorMessage: "Cancelled by Anti-Ban Guard: Message text cannot be empty",
        },
      });
      failedCount++;
      continue;
    }

    // Determine the WhatsApp provider for this Tenant
    let tenant: any = null;
    try {
      tenant = await prisma.tenant.findUnique({
        where: { id: item.tenantId },
      });
    } catch {}

    let sendResult;
    let usedSenderId = null;

    const providerType = (process.env.WHATSAPP_PROVIDER_TYPE || "WEB").toUpperCase();
    const hasTenantCloudCreds = !!(tenant?.waApiToken && tenant?.waPhoneNumberId);
    const useCloud = providerType === "CLOUD" && hasTenantCloudCreds;

    if (useCloud) {
      // 1. Use Cloud API (WhatsApp Business) if configured
      const phoneId = tenant?.waPhoneNumberId || process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;
      const apiToken = tenant?.waApiToken || process.env.WHATSAPP_CLOUD_ACCESS_TOKEN;
      const cloudProvider = new WhatsAppCloudProvider(phoneId, apiToken);
      
      // Mark as SENDING
      await prisma.messageQueue.update({
        where: { id: item.id },
        data: { status: "SENDING" },
      });

      // Extract variables from the customer object if we have a template
      let components: any[] = [];
      let templateName: string | undefined = undefined;
      
      if (item.template?.slug) {
        templateName = item.template.slug.replace(/-/g, '_');
        // The templates require {{1}} Name, {{2}} Account, {{3}} Product
        components = [
          {
            type: "body",
            parameters: [
              { type: "text", text: item.recipientName || "Customer" }, // {{1}}
              { type: "text", text: item.customer?.account || "Pending" }, // {{2}}
              { type: "text", text: item.customer?.productName || "Product" }  // {{3}}
            ]
          }
        ];
      }

      sendResult = await cloudProvider.sendMessage({
        recipientPhone: item.recipientPhone,
        messageText: item.messageText,
        customerId: item.customerId || undefined,
        templateName: templateName,
        components: components,
      } as any);

    } else {
      // 2. Fallback to Baileys (Personal WhatsApp Scanning)
      let senderId = item.senderUserId;

      if (!senderId && item.customerId) {
        const cust = await prisma.customer.findUnique({
          where: { id: item.customerId },
          select: { assignedToUserId: true, assignedManagerId: true },
        });
        senderId = cust?.assignedToUserId || cust?.assignedManagerId || null;
      }

      let session = senderId ? waSessionManager.getSession(senderId) : null;

      // If assigned officer's WhatsApp is not connected, fall back to any active admin / connected phone
      if (!session || !session.isConnected()) {
        const activeSession = await prisma.whatsAppSession.findFirst({
          where: { status: "CONNECTED", connectedPhone: { not: null } },
          select: { userId: true },
        });
        if (activeSession?.userId) {
          senderId = activeSession.userId;
          session = waSessionManager.getSession(senderId);
        }
      }

      if (!session || !session.isConnected()) {
        // WhatsApp is currently offline / not connected — leave in QUEUED so it auto-dispatches once phone links
        continue;
      }

      usedSenderId = senderId;

      await prisma.messageQueue.update({
        where: { id: item.id },
        data: { status: "SENDING" },
      });

      const isManualHighPriority = item.priority >= 100;
      // Anti-Ban Delay: Even high priority manual sends get a safe 2-4s delay, while bulk queue gets full jitter
      const delayMs = isManualHighPriority
        ? Math.floor(Math.random() * 2000) + 2500
        : Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

      await new Promise((resolve) => setTimeout(resolve, delayMs));

      sendResult = await session.sendDirectMessage(item.recipientPhone, trimmedText);
    }

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
