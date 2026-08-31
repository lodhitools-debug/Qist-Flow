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

  // 1. Initialize WhatsApp connection with clean retry
  console.log("📱 Initializing WhatsApp Web Connection...");
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

      // 1. Handle Disconnect Request from Vercel / DB
      if (session?.status === "DISCONNECTED" && (waWebProvider.isConnected() || waWebProvider.getConnectionState() !== "DISCONNECTED")) {
        console.log(`🛑 [Worker] Disconnect detected from DB. Cleaning up local session...`);
        await waWebProvider.disconnect().catch(() => {});
      }
      // 2. Handle Pairing Code Request from Vercel
      else if (session?.status === "PAIRING_REQUESTED" && session.requestedPhone) {
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
      // 3. Handle QR Connect Request from Vercel
      else if (session?.status === "CONNECTING" && !session.qrCode && !waWebProvider.isConnected()) {
        const now = Date.now();
        if (now - lastConnectInit > 3000) {
          lastConnectInit = now;
          if (waWebProvider.hasSavedAuth()) {
            console.log(`🔄 [Worker] Saved credentials found. Reconnecting socket without wiping...`);
            await waWebProvider.init().catch((err) => {
              console.error("❌ [Worker] Reconnect error:", err.message);
            });
          } else {
            console.log(`🔄 [Worker] Fresh connect requested from web. Generating QR code...`);
            await waWebProvider.forceReconnect(true).catch((err) => {
              console.error("❌ [Worker] QR reconnect error:", err.message);
            });
          }
        }
      }
    } catch (err) {}
  }, 2000);

  // 4. HTTP API Microservice for Vercel ↔ Worker communication
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    // Health check endpoint
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
          status: "healthy",
          worker: "qistflow-background-worker",
          uptimeSeconds: Math.floor(process.uptime()),
          timestamp: new Date().toISOString(),
          lastHeartbeat: lastHeartbeat.toISOString(),
          lastSuccessfulMessageAt: lastSuccessfulMessageAt ? lastSuccessfulMessageAt.toISOString() : null,
          whatsapp: waInfo,
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

    if (req.method === "POST" && pathname === "/api/wa/send") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const { phone, message } = JSON.parse(body || "{}");
          if (!phone || !message) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: "phone and message required" }));
            return;
          }

          const sendResult = await waWebProvider.sendDirectMessage(phone, message);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(sendResult));
        } catch (err: any) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/wa/connect") {
      try {
        await waWebProvider.forceReconnect(true);
        const qr = await waWebProvider.getQRCode();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, status: "CONNECTING", qrCode: qr }));
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (req.method === "POST" && pathname === "/api/wa/pairing-code") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const { phone } = JSON.parse(body || "{}");
          const code = await waWebProvider.requestPairingCode(phone);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, pairingCode: code }));
        } catch (err: any) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/wa/disconnect") {
      try {
        await waWebProvider.disconnect();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, message: "Disconnected" }));
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
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
  });
}

startWorker().catch((err) => {
  console.error("❌ Fatal error in startWorker:", err);
});
