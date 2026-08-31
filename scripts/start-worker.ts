process.env.IS_WORKER = "true";

// Crash-proof global exception handlers (Never let worker die from network/socket timeouts)
process.on("uncaughtException", (err) => {
  console.warn("⚠️ [Worker Handled UncaughtException]:", err.message);
});

process.on("unhandledRejection", (reason: any) => {
  console.warn("⚠️ [Worker Handled UnhandledRejection]:", reason?.message || reason);
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
let lastProcessedCount = 0;

async function runQueueStep() {
  if (isQueueLoopRunning) return;
  isQueueLoopRunning = true;
  lastHeartbeat = new Date();

  try {
    const res = await processQueueWorker(10);
    lastProcessedCount = res.processed;
    if (res.sent > 0) {
      lastSuccessfulMessageAt = new Date();
    }

    if (res.processed > 0) {
      console.log(`[Fast Queue Worker] Processed: ${res.processed} | Sent: ${res.sent} | Failed: ${res.failed}`);
      // If messages were processed, poll again quickly in 1 second
      setTimeout(runQueueStep, 1000);
    } else {
      // Queue is empty, poll again in 3 seconds
      setTimeout(runQueueStep, 3000);
    }
  } catch (err) {
    console.error("[Queue Worker Error]:", err);
    setTimeout(runQueueStep, 4000);
  } finally {
    isQueueLoopRunning = false;
  }
}

// Track per-user last action timestamps to avoid duplicate actions
const lastConnectInitPerUser = new Map<string, number>();

async function startWorker() {
  console.log("==========================================");
  console.log("🚀 QistFlow WhatsApp & Reminder Background Worker");
  console.log("   Multi-User Isolated Session Architecture");
  console.log("==========================================");

  // 1. Restore all previously active WhatsApp sessions from disk
  console.log("📱 Restoring active WhatsApp sessions from disk...");
  await waSessionManager.restoreAllActiveSessions().catch((err) => {
    console.warn("⚠️ Session restore partial failure:", err.message);
  });

  // 2. Start Adaptive Queue Processing Loop (1-3s polling)
  console.log("⚡ Starting Fast Adaptive Queue Polling Loop...");
  setTimeout(runQueueStep, 1500);

  // 3. Schedule Reminder Rule Evaluation (Every 15 minutes)
  setInterval(async () => {
    try {
      console.log(`[Reminder Scheduler] Evaluating active reminder rules...`);
      const res = await runReminderScheduler(true);
      if (res.enqueued > 0) {
        console.log(`[Reminder Scheduler] Enqueued ${res.enqueued} reminder(s) | Skipped ${res.duplicatesSkipped} duplicates`);
        runQueueStep();
      }
    } catch (err) {
      console.error("[Reminder Scheduler Error]:", err);
    }
  }, 1000 * 60 * 15);

  // 4. Multi-User DB Watcher - polls every 2 seconds for connect/disconnect/logout requests from all users
  setInterval(async () => {
    try {
      // Query ALL user sessions from DB (not just a single "default" session)
      const allSessions = await prisma.whatsAppSession.findMany({
        select: {
          userId: true,
          status: true,
          requestedPhone: true,
          qrCode: true,
        },
      });

      for (const session of allSessions) {
        const userId = session.userId;
        const userSession = waSessionManager.getSession(userId);
        const now = Date.now();
        const lastInit = lastConnectInitPerUser.get(userId) || 0;

        try {
          // 1. Handle DISCONNECTED request from Vercel/DB
          if (
            session.status === "DISCONNECTED" &&
            (userSession.isConnected() || userSession.getConnectionState() !== "DISCONNECTED")
          ) {
            console.log(`🛑 [Worker] User ${userId}: Disconnect detected from DB.`);
            await userSession.disconnect().catch(() => {});
          }

          // 2. Handle LOGGED_OUT / DELETE request from Vercel/DB
          else if (session.status === "LOGGED_OUT" && userSession.getConnectionState() !== "LOGGED_OUT") {
            console.log(`🗑️ [Worker] User ${userId}: Logout detected from DB. Wiping credentials...`);
            await waSessionManager.logoutUser(userId).catch(() => {});
          }

          // 3. Handle PAIRING_REQUESTED - generate pairing code for user
          else if (session.status === "PAIRING_REQUESTED" && session.requestedPhone) {
            if (now - lastInit > 5000) {
              lastConnectInitPerUser.set(userId, now);
              console.log(`📲 [Worker] User ${userId}: Pairing code requested for ${session.requestedPhone}...`);
              try {
                const code = await waSessionManager.requestPairingCode(userId, session.requestedPhone);
                console.log(`✅ [Worker] User ${userId}: Pairing code: ${code}`);
                await prisma.whatsAppSession.update({
                  where: { userId },
                  data: {
                    status: "PAIRING",
                    pairingCode: code,
                    errorMessage: null,
                  },
                });
              } catch (err: any) {
                console.error(`❌ [Worker] User ${userId}: Pairing code failed:`, err.message);
                await prisma.whatsAppSession.update({
                  where: { userId },
                  data: { status: "ERROR", errorMessage: err.message },
                });
              }
            }
          }

          // 4. Handle CONNECTING request - generate QR code for user
          else if (
            session.status === "CONNECTING" &&
            !session.qrCode &&
            !userSession.isConnected()
          ) {
            if (now - lastInit > 3000) {
              lastConnectInitPerUser.set(userId, now);
              if (userSession.hasSavedAuth()) {
                console.log(`🔄 [Worker] User ${userId}: Saved creds found. Reconnecting without QR...`);
                await userSession.init().catch((err) => {
                  console.error(`❌ [Worker] User ${userId}: Reconnect error:`, err.message);
                });
              } else {
                console.log(`🔄 [Worker] User ${userId}: Fresh connect requested. Generating QR...`);
                await waSessionManager.connectUser(userId, false).catch((err) => {
                  console.error(`❌ [Worker] User ${userId}: QR connect error:`, err.message);
                });
              }
            }
          }
        } catch (userErr: any) {
          console.warn(`⚠️ [Worker] Error handling session for user ${userId}:`, userErr.message);
        }
      }
    } catch (err) {
      // Silently ignore DB errors in watch loop
    }
  }, 2000);

  // 5. HTTP API Microservice for Vercel ↔ Worker communication
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    // Health check endpoint
    if (pathname === "/health" || pathname === "/api/health") {
      let queueStats = { queued: 0, sending: 0, sentToday: 0, failedToday: 0 };
      let activeSessions: { userId: string; status: string; phone: string | null }[] = [];

      try {
        queueStats = await getQueueStats();
        const sessionMap = waSessionManager.getAllActiveSessions();
        for (const [uid, session] of Array.from(sessionMap.entries())) {
          const info = await session.getConnectedInfo();
          activeSessions.push({ userId: uid, status: info.status, phone: info.phone ?? null });
        }
      } catch {}

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "healthy",
          worker: "qistflow-background-worker",
          architecture: "multi-user-isolated",
          uptimeSeconds: Math.floor(process.uptime()),
          timestamp: new Date().toISOString(),
          lastHeartbeat: lastHeartbeat.toISOString(),
          lastSuccessfulMessageAt: lastSuccessfulMessageAt ? lastSuccessfulMessageAt.toISOString() : null,
          activeSessions,
          queue: queueStats,
        })
      );
      return;
    }

    // Secure webhook endpoints (Protected by secret token)
    const clientSecret = req.headers["x-whatsapp-secret"];
    if (SERVICE_SECRET && clientSecret !== SERVICE_SECRET) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Unauthorized" }));
      return;
    }

    // Helper to read JSON body
    const readBody = (): Promise<any> =>
      new Promise((resolve) => {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            resolve(JSON.parse(body || "{}"));
          } catch {
            resolve({});
          }
        });
      });

    // POST /api/wa/send - Send message through a specific user's WhatsApp
    if (req.method === "POST" && pathname === "/api/wa/send") {
      try {
        const { userId, phone, message } = await readBody();
        if (!phone || !message) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "phone and message required" }));
          return;
        }

        let sendResult;
        if (userId) {
          sendResult = await waSessionManager.sendMessage(userId, {
            recipientPhone: phone,
            messageText: message,
          });
        } else {
          // Fallback: find first connected session
          const sessions = waSessionManager.getAllActiveSessions();
          let sent = false;
          for (const [uid, session] of Array.from(sessions.entries())) {
            if (session.isConnected()) {
              sendResult = await session.sendDirectMessage(phone, message);
              sent = true;
              break;
            }
          }
          if (!sent) {
            sendResult = { success: false, error: "No active WhatsApp session found", timestamp: new Date() };
          }
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(sendResult));
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // POST /api/wa/connect - Connect a specific user's WhatsApp (generate QR)
    if (req.method === "POST" && pathname === "/api/wa/connect") {
      try {
        const { userId } = await readBody();
        if (!userId) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "userId required" }));
          return;
        }
        const result = await waSessionManager.connectUser(userId, false);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, ...result }));
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // POST /api/wa/pairing-code - Request pairing code for a specific user
    if (req.method === "POST" && pathname === "/api/wa/pairing-code") {
      try {
        const { userId, phone } = await readBody();
        if (!userId || !phone) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "userId and phone required" }));
          return;
        }
        const code = await waSessionManager.requestPairingCode(userId, phone);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, pairingCode: code }));
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // POST /api/wa/disconnect - Temporarily disconnect a user's session (keep credentials)
    if (req.method === "POST" && pathname === "/api/wa/disconnect") {
      try {
        const { userId } = await readBody();
        if (!userId) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "userId required" }));
          return;
        }
        await waSessionManager.disconnectUser(userId);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, message: `User ${userId} disconnected (credentials preserved)` }));
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // POST /api/wa/logout - Full logout: wipe credentials and session for a user
    if (req.method === "POST" && pathname === "/api/wa/logout") {
      try {
        const { userId } = await readBody();
        if (!userId) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "userId required" }));
          return;
        }
        await waSessionManager.logoutUser(userId);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, message: `User ${userId} logged out and credentials wiped` }));
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // GET /api/wa/status/:userId - Get specific user's WhatsApp status
    if (req.method === "GET" && pathname.startsWith("/api/wa/status/")) {
      try {
        const userId = pathname.replace("/api/wa/status/", "");
        if (!userId) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "userId required in path" }));
          return;
        }
        const info = await waSessionManager.getUserStatus(userId);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(info));
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Endpoint not found" }));
  });

  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`⚠️ HTTP port ${HTTP_PORT} is already in use by another instance. WhatsApp background worker is continuing without standalone HTTP port.`);
    } else {
      console.error("HTTP Server Error:", err);
    }
  });

  server.listen(HTTP_PORT, () => {
    console.log(`🌐 Worker HTTP microservice listening on port ${HTTP_PORT}`);
    console.log(`📋 Available endpoints:`);
    console.log(`   POST /api/wa/connect       { userId }`);
    console.log(`   POST /api/wa/disconnect    { userId }`);
    console.log(`   POST /api/wa/logout        { userId }`);
    console.log(`   POST /api/wa/pairing-code  { userId, phone }`);
    console.log(`   POST /api/wa/send          { userId, phone, message }`);
    console.log(`   GET  /api/wa/status/:userId`);
    console.log(`   GET  /health`);
  });
}

startWorker().catch((err) => {
  console.error("❌ Fatal error in startWorker:", err);
});
