import nodeCrypto from "node:crypto";
try {
  if (typeof globalThis.crypto === "undefined" || !(globalThis.crypto as any)?.subtle) {
    Object.defineProperty(globalThis, "crypto", {
      value: (nodeCrypto as any).webcrypto || nodeCrypto,
      configurable: true,
      writable: true,
    });
  }
} catch {}

process.env.IS_WORKER = "true";

// Crash-proof global exception handlers
process.on("uncaughtException", (err) => {
  console.warn("⚠️ [Worker UncaughtException]:", err.message);
});
process.on("unhandledRejection", (reason: any) => {
  console.warn("⚠️ [Worker UnhandledRejection]:", reason?.message || reason);
});

import http from "http";
import { prisma } from "../src/lib/prisma";
import { waSessionManager } from "../src/lib/whatsapp/session-manager";
import { processQueueWorker, getQueueStats } from "../src/lib/whatsapp/message-queue";
import { runReminderScheduler } from "../src/lib/scheduler/reminder-cron";

const HTTP_PORT = parseInt(
  process.env.WORKER_HTTP_PORT || (process.env.PORT && process.env.PORT !== "3000" ? process.env.PORT : "8080"),
  10
);
const SERVICE_SECRET = process.env.WHATSAPP_SERVICE_SECRET || "";

let isQueueLoopRunning = false;
let lastHeartbeat = new Date();
let lastSuccessfulMessageAt: Date | null = null;

// Per-user action cooldowns to prevent rapid repeated operations
const lastActionPerUser = new Map<string, number>();
const ACTION_COOLDOWN_MS = 5_000;

// ── Message Queue Processing ──────────────────────────────────────────────────

async function runQueueStep() {
  if (isQueueLoopRunning) return;
  isQueueLoopRunning = true;
  lastHeartbeat = new Date();

  try {
    const res = await processQueueWorker(10);
    if (res.sent > 0) {
      lastSuccessfulMessageAt = new Date();
      console.log(`[Queue] Processed: ${res.processed} | Sent: ${res.sent} | Failed: ${res.failed}`);
    }
    setTimeout(runQueueStep, res.processed > 0 ? 1_000 : 3_000);
  } catch (err) {
    console.error("[Queue Error]:", err);
    setTimeout(runQueueStep, 4_000);
  } finally {
    isQueueLoopRunning = false;
  }
}

// ── DB Watch Loop — sync worker state with Vercel DB commands ─────────────────

async function runDbWatchLoop() {
  try {
    // Fetch only real user sessions (exclude null userId rows)
    const allSessions = await prisma.whatsAppSession.findMany({
      where: { userId: { not: null } },
      select: {
        id: true,
        userId: true,
        status: true,
        requestedPhone: true,
        pairingCode: true,
        qrCode: true,
      },
    });

    for (const session of allSessions) {
      const userId = session.userId!;

      // Safety: skip empty/default userIds
      if (!userId || userId === "default") continue;

      const userSession = waSessionManager.getSession(userId);
      const now = Date.now();
      const lastAction = lastActionPerUser.get(userId) || 0;
      const onCooldown = now - lastAction < ACTION_COOLDOWN_MS;

      try {
        // 1. Disconnect request from Vercel
        if (
          session.status === "DISCONNECTED" &&
          userSession.getConnectionState() !== "DISCONNECTED" &&
          userSession.getConnectionState() !== "LOGGED_OUT"
        ) {
          console.log(`🛑 [Worker] Disconnecting user: ${userId}`);
          lastActionPerUser.set(userId, now);
          await userSession.disconnect().catch(() => {});
        }

        // 2. Logout / Change Number request
        else if (
          session.status === "LOGGED_OUT" &&
          userSession.getConnectionState() !== "LOGGED_OUT" &&
          !onCooldown
        ) {
          console.log(`🗑️ [Worker] Logging out user: ${userId}`);
          lastActionPerUser.set(userId, now);
          await waSessionManager.logoutUser(userId).catch(() => {});
        }

        // 3. Pairing code requested — DB sets status=PAIRING with requestedPhone
        else if (
          session.status === "PAIRING" &&
          session.requestedPhone &&
          !session.pairingCode &&
          !onCooldown
        ) {
          console.log(`📲 [Worker] Pairing code requested for ${userId} → ${session.requestedPhone}`);
          lastActionPerUser.set(userId, now);
          try {
            const code = await waSessionManager.requestPairingCode(userId, session.requestedPhone);
            await prisma.whatsAppSession.update({
              where: { userId },
              data: { pairingCode: code, status: "PAIRING", errorMessage: null },
            }).catch(() => {});
          } catch (err: any) {
            console.error(`❌ [Worker] Pairing code failed for ${userId}:`, err.message);
            await prisma.whatsAppSession.update({
              where: { userId },
              data: { status: "ERROR", errorMessage: "Pairing code generation failed. Please try again." },
            }).catch(() => {});
          }
        }

        // 4. INIT_QR: fresh QR requested — always force fresh (wipe old creds)
        else if (
          session.status === "INIT_QR" &&
          !session.qrCode &&
          !userSession.isConnected() &&
          !onCooldown
        ) {
          console.log(`🔄 [Worker] Fresh QR requested for ${userId}`);
          lastActionPerUser.set(userId, now);
          // connectUser with forceFresh=true wipes old creds and creates a brand-new socket
          waSessionManager.connectUser(userId, true).catch((err) => {
            console.error(`❌ [Worker] QR connect failed for ${userId}:`, err.message);
          });
        }

        // 5. CONNECTING: reconnect with saved credentials (no new QR)
        else if (
          session.status === "CONNECTING" &&
          !userSession.isConnected() &&
          userSession.getConnectionState() !== "CONNECTING" &&
          userSession.getConnectionState() !== "RECONNECTING" &&
          !onCooldown
        ) {
          if (userSession.hasSavedAuth()) {
            console.log(`🔄 [Worker] Reconnecting with saved creds for ${userId}`);
            lastActionPerUser.set(userId, now);
            waSessionManager.connectUser(userId, false).catch((err) => {
              console.error(`❌ [Worker] Reconnect failed for ${userId}:`, err.message);
            });
          }
        }

        // 6. Session just became CONNECTED — check phone number uniqueness
        else if (session.status === "CONNECTED" && session.requestedPhone === null) {
          const inMemoryInfo = await userSession.getConnectedInfo();
          if (inMemoryInfo.status === "CONNECTED" && inMemoryInfo.phone) {
            const conflictUserId = await waSessionManager.checkPhoneOwnershipConflict(userId, inMemoryInfo.phone);
            if (conflictUserId) {
              console.warn(`🚫 [Worker] Phone ${inMemoryInfo.phone} already owned by ${conflictUserId}. Disconnecting ${userId}.`);
              await waSessionManager.logoutUser(userId);
              await prisma.whatsAppSession.update({
                where: { userId },
                data: {
                  status: "ERROR",
                  errorMessage: "This WhatsApp number is already connected to another QistFlow user.",
                  connectedPhone: null,
                },
              }).catch(() => {});
            }
          }
        }
      } catch (err: any) {
        // Per-user errors should not crash the entire loop
        console.warn(`⚠️ [Worker DB Loop] Error for user ${userId}:`, err.message);
      }
    }
  } catch (err: any) {
    console.warn("⚠️ [Worker DB Loop] Query error:", err.message);
  }
}

// ── HTTP Microservice ─────────────────────────────────────────────────────────

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); }
      catch { resolve({}); }
    });
  });
}

function jsonRes(res: http.ServerResponse, status: number, data: object) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

// ── Worker Bootstrap ──────────────────────────────────────────────────────────

async function startWorker() {
  console.log("==========================================");
  console.log("🚀 QistFlow WhatsApp Background Worker");
  console.log("   Multi-User Isolated Session Architecture");
  console.log("==========================================");

  // 1. Restore previously-connected sessions (skips LOGGED_OUT)
  console.log("📱 Restoring active WhatsApp sessions...");
  await waSessionManager.restoreAllActiveSessions().catch((err) => {
    console.warn("⚠️ Session restore error:", err.message);
  });

  // 2. Queue processing loop
  console.log("⚡ Starting Queue Processing Loop...");
  setTimeout(runQueueStep, 1_500);

  // 3. Reminder scheduler (every 15 minutes)
  setInterval(async () => {
    try {
      const res = await runReminderScheduler(true);
      if (res.enqueued > 0) {
        console.log(`[Reminders] Enqueued ${res.enqueued} | Skipped ${res.duplicatesSkipped} duplicates`);
        runQueueStep();
      }
    } catch (err) {
      console.error("[Reminder Scheduler Error]:", err);
    }
  }, 1_000 * 60 * 15);

  // 4. DB Watch Loop (every 2 seconds)
  setInterval(runDbWatchLoop, 2_000);

  // 5. HTTP Microservice
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    // ── Health check (no auth required) ─────────────────────────────────────
    if (pathname === "/health" || pathname === "/api/health") {
      let queueStats = { queued: 0, sending: 0, sentToday: 0, failedToday: 0 };
      let sessionCount = 0;
      try {
        queueStats = await getQueueStats();
        sessionCount = waSessionManager.getAllActiveSessions().size;
      } catch {}
      return jsonRes(res, 200, {
        status: "healthy",
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        lastHeartbeat: lastHeartbeat.toISOString(),
        lastSuccessfulMessageAt: lastSuccessfulMessageAt?.toISOString() || null,
        activeSessions: sessionCount,
        queue: queueStats,
      });
    }

    // ── All other endpoints require the service secret ───────────────────────
    const clientSecret = req.headers["x-whatsapp-secret"];
    if (SERVICE_SECRET && clientSecret !== SERVICE_SECRET) {
      return jsonRes(res, 401, { success: false, error: "Unauthorized" });
    }

    // POST /api/wa/send
    if (req.method === "POST" && pathname === "/api/wa/send") {
      try {
        const { userId, phone, message } = await readBody(req);
        if (!userId || !phone || !message) {
          return jsonRes(res, 400, { success: false, error: "userId, phone and message required" });
        }
        const result = await waSessionManager.sendMessage(userId, {
          recipientPhone: phone,
          messageText: message,
        });
        return jsonRes(res, 200, result);
      } catch (err: any) {
        return jsonRes(res, 500, { success: false, error: err.message });
      }
    }

    // POST /api/wa/connect — triggers QR generation
    if (req.method === "POST" && pathname === "/api/wa/connect") {
      try {
        const { userId, forceFresh } = await readBody(req);
        if (!userId) return jsonRes(res, 400, { success: false, error: "userId required" });
        const result = await waSessionManager.connectUser(userId, !!forceFresh);
        return jsonRes(res, 200, { success: true, ...result });
      } catch (err: any) {
        return jsonRes(res, 500, { success: false, error: err.message });
      }
    }

    // POST /api/wa/pairing-code
    if (req.method === "POST" && pathname === "/api/wa/pairing-code") {
      try {
        const { userId, phone } = await readBody(req);
        if (!userId || !phone) {
          return jsonRes(res, 400, { success: false, error: "userId and phone required" });
        }
        const code = await waSessionManager.requestPairingCode(userId, phone);
        return jsonRes(res, 200, { success: true, pairingCode: code });
      } catch (err: any) {
        return jsonRes(res, 500, { success: false, error: err.message });
      }
    }

    // POST /api/wa/disconnect
    if (req.method === "POST" && pathname === "/api/wa/disconnect") {
      try {
        const { userId } = await readBody(req);
        if (!userId) return jsonRes(res, 400, { success: false, error: "userId required" });
        await waSessionManager.disconnectUser(userId);
        return jsonRes(res, 200, { success: true });
      } catch (err: any) {
        return jsonRes(res, 500, { success: false, error: err.message });
      }
    }

    // POST /api/wa/logout — full credential wipe
    if (req.method === "POST" && pathname === "/api/wa/logout") {
      try {
        const { userId } = await readBody(req);
        if (!userId) return jsonRes(res, 400, { success: false, error: "userId required" });
        await waSessionManager.logoutUser(userId);
        return jsonRes(res, 200, { success: true });
      } catch (err: any) {
        return jsonRes(res, 500, { success: false, error: err.message });
      }
    }

    // GET /api/wa/status/:userId
    if (req.method === "GET" && pathname.startsWith("/api/wa/status/")) {
      try {
        const userId = pathname.replace("/api/wa/status/", "");
        if (!userId) return jsonRes(res, 400, { error: "userId required in path" });
        const info = await waSessionManager.getUserStatus(userId);
        return jsonRes(res, 200, info);
      } catch (err: any) {
        return jsonRes(res, 500, { error: err.message });
      }
    }

    jsonRes(res, 404, { error: "Endpoint not found" });
  });

  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`⚠️ Port ${HTTP_PORT} already in use — worker continuing without HTTP.`);
    } else {
      console.error("HTTP Server Error:", err);
    }
  });

  server.listen(HTTP_PORT, () => {
    console.log(`🌐 Worker HTTP microservice on port ${HTTP_PORT}`);
    console.log(`   GET  /health`);
    console.log(`   POST /api/wa/connect    { userId, forceFresh? }`);
    console.log(`   POST /api/wa/disconnect { userId }`);
    console.log(`   POST /api/wa/logout     { userId }`);
    console.log(`   POST /api/wa/pairing-code { userId, phone }`);
    console.log(`   POST /api/wa/send       { userId, phone, message }`);
    console.log(`   GET  /api/wa/status/:userId`);
  });
}

startWorker().catch((err) => {
  console.error("❌ Fatal error in startWorker:", err);
});
