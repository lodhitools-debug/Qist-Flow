process.env.IS_WORKER = "true";

import http from "http";
import { waWebProvider } from "../src/lib/whatsapp/web-provider";
import { processQueueWorker } from "../src/lib/whatsapp/message-queue";
import { runReminderScheduler } from "../src/lib/scheduler/reminder-cron";

const HTTP_PORT = parseInt(process.env.WORKER_HTTP_PORT || process.env.PORT || "8080", 10);
const SERVICE_SECRET = process.env.WHATSAPP_SERVICE_SECRET || "";

async function startWorker() {
  console.log("==========================================");
  console.log("🚀 QistFlow WhatsApp & Reminder Background Worker");
  console.log("==========================================");

  // 1. Initialize WhatsApp connection
  console.log("📱 Initializing WhatsApp Web Connection...");
  await waWebProvider.init().catch((err) => {
    console.warn("⚠️ Initial WhatsApp pairing awaiting QR scan or reconnect:", err.message);
  });

  // 2. Schedule Queue Processing loop (Every 15 seconds)
  setInterval(async () => {
    try {
      const res = await processQueueWorker(10);
      if (res.processed > 0) {
        console.log(`[Queue Worker] Processed: ${res.processed} | Sent: ${res.sent} | Failed: ${res.failed}`);
      }
    } catch (err) {
      console.error("[Queue Worker Error]:", err);
    }
  }, 15000);

  // 3. Schedule Reminder Rule Evaluation (Every 15 minutes)
  setInterval(async () => {
    try {
      console.log(`[Reminder Scheduler] Evaluating active reminder rules...`);
      const res = await runReminderScheduler(true);
      if (res.enqueued > 0) {
        console.log(`[Reminder Scheduler] Enqueued ${res.enqueued} reminder(s) | Skipped ${res.duplicatesSkipped} duplicates`);
      }
    } catch (err) {
      console.error("[Reminder Scheduler Error]:", err);
    }
  }, 1000 * 60 * 15);

  // 4. HTTP API Microservice for Vercel ↔ AlwaysData secure communication
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    // Health check endpoint
    if (pathname === "/health" || pathname === "/api/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", worker: "running", timestamp: new Date().toISOString() }));
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

      if (req.method === "POST" && pathname === "/api/wa/send") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
          try {
            const payload = JSON.parse(body || "{}");
            const result = await waWebProvider.sendMessage(payload);
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
      res.end(JSON.stringify({ error: "Endpoint not found" }));
    } catch (err: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message || "Internal server error" }));
    }
  });

  server.listen(HTTP_PORT, () => {
    console.log(`🌐 WhatsApp Worker HTTP Microservice listening on port ${HTTP_PORT}`);
    console.log("✅ Background Worker & Scheduler are running smoothly!");
  });
}

startWorker().catch((err) => {
  console.error("Worker startup failed:", err);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down worker...");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down worker...");
  process.exit(0);
});
