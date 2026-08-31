process.env.IS_WORKER = "true";

import http from "http";
import { prisma } from "../src/lib/prisma";
import { waWebProvider } from "../src/lib/whatsapp/web-provider";
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

async function startWorker() {
  console.log("==========================================");
  console.log("🚀 QistFlow WhatsApp & Reminder Background Worker");
  console.log("==========================================");

  // 1. Initialize WhatsApp connection
  console.log("📱 Initializing WhatsApp Web Connection on AlwaysData...");
  await waWebProvider.init().catch((err) => {
    console.warn("⚠️ Initial WhatsApp pairing awaiting QR scan or reconnect:", err.message);
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
        // Wake queue worker immediately
        runQueueStep();
      }
    } catch (err) {
      console.error("[Reminder Scheduler Error]:", err);
    }
  }, 1000 * 60 * 15);

  // 3b. Database Pairing & QR Watcher (Polls every 2 seconds for requests from Vercel)
  let lastConnectInit = 0;
  setInterval(async () => {
    try {
      const session = await prisma.whatsAppSession.findUnique({ where: { id: "default" } });

      // 1. Handle Pairing Code Request from Vercel
      if (session?.status === "PAIRING_REQUESTED" && session.requestedPhone) {
        console.log(`📲 [Worker] Pairing code requested for ${session.requestedPhone}...`);
        try {
          const code = await waWebProvider.requestPairingCode(session.requestedPhone);
          console.log(`✅ [Worker] Pairing code generated: ${code}`);
          await prisma.whatsAppSession.update({
            where: { id: "default" },
            data: {
              status: "PAIRING_READY",
              pairingCode: code,
              errorMessage: null,
            },
          });
        } catch (err: any) {
          console.error(`❌ [Worker] Pairing code generation failed:`, err.message);
          await prisma.whatsAppSession.update({
            where: { id: "default" },
            data: {
              status: "DISCONNECTED",
              errorMessage: err.message,
            },
          });
        }
      }

      // 2. Handle QR Connect Request from Vercel
      if (session?.status === "CONNECTING" && !session.qrCode && !waWebProvider.isConnected()) {
        const now = Date.now();
        if (now - lastConnectInit > 8000) {
          lastConnectInit = now;
          console.log(`🔄 [Worker] Connect requested from web. Initializing QR code streaming...`);
          await waWebProvider.forceReconnect().catch((err) => {
            console.error("❌ [Worker] QR reconnect error:", err.message);
          });
        }
      }
    } catch (err) {}
  }, 2000);

  // 4. HTTP API Microservice for Vercel ↔ AlwaysData secure communication
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    // Health check endpoint (Public safe telemetry without secret leak)
    if (pathname === "/health" || pathname === "/api/health") {
      let queueStats = { queued: 0, sending: 0, sentToday: 0, failedToday: 0 };
      let waInfo: { status: string; phone: string | null } = { status: "DISCONNECTED", phone: null };

      try {
        queueStats = await getQueueStats();
        const info = await waWebProvider.getConnectedInfo();
        waInfo = { status: info.status, phone: info.phone || null };
      } catch {}

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          workerStatus: "running",
          whatsAppConnectionState: waInfo.status,
          connectedPhone: waInfo.phone,
          queueStats,
          lastHeartbeat: lastHeartbeat.toISOString(),
          lastSuccessfulMessage: lastSuccessfulMessageAt ? lastSuccessfulMessageAt.toISOString() : null,
          schedulerState: "active",
          ruleEvaluationIntervalMinutes: 15,
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    // Security Check: Verify x-whatsapp-secret header if configured
    if (SERVICE_SECRET) {
      const incomingSecret = req.headers["x-whatsapp-secret"];
      if (incomingSecret !== SERVICE_SECRET) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Forbidden: Invalid WhatsApp service secret" }));
        return;
      }
    }

    try {
      // Trigger Queue Wakeup Endpoint
      if (req.method === "POST" && pathname === "/api/wa/trigger-queue") {
        runQueueStep();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, message: "Queue loop triggered" }));
        return;
      }

      if (req.method === "GET" && pathname === "/api/wa/status") {
        const info = await waWebProvider.getConnectedInfo();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(info));
        return;
      }

      if (req.method === "POST" && pathname === "/api/wa/connect") {
        await waWebProvider.init();
        const info = await waWebProvider.getConnectedInfo();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(info));
        return;
      }

      if (req.method === "POST" && pathname === "/api/wa/disconnect") {
        await waWebProvider.disconnect();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, message: "Disconnected" }));
        return;
      }

      if (req.method === "POST" && pathname === "/api/wa/pairing-code") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
          try {
            const payload = JSON.parse(body || "{}");
            const code = await waWebProvider.requestPairingCode(payload.phone || "");
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, pairingCode: code }));
          } catch (err: any) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      if (req.method === "POST" && pathname === "/api/wa/send") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
          try {
            const payload = JSON.parse(body || "{}");
            const result = await waWebProvider.sendMessage(payload);
            if (result.success) {
              lastSuccessfulMessageAt = new Date();
            }
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(result));
          } catch (err: any) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Route not found" }));
    } catch (err: any) {
      console.error("[HTTP Worker Exception]:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  // Graceful Shutdown
  const gracefulShutdown = () => {
    console.log("\n🛑 Graceful worker shutdown initiated...");
    server.close(() => {
      console.log("HTTP microservice closed.");
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 4000);
  };

  process.on("SIGINT", gracefulShutdown);
  process.on("SIGTERM", gracefulShutdown);

  server.listen(HTTP_PORT, () => {
    console.log(`📡 WhatsApp HTTP Microservice listening on port ${HTTP_PORT}`);
  });
}

startWorker().catch((err) => {
  console.error("❌ Fatal Background Worker Crash:", err);
  process.exit(1);
});
