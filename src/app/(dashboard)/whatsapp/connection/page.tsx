"use client";

import { useEffect, useState } from "react";
import {
  QrCode,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Power,
  Smartphone,
  ShieldCheck,
  Zap,
  Info,
} from "lucide-react";
import clsx from "clsx";

export default function WhatsAppConnectionPage() {
  const [status, setStatus] = useState<string>("DISCONNECTED");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [connectedName, setConnectedName] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [lastActiveAt, setLastActiveAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const safeJsonParse = async (res: Response) => {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        return await res.json();
      } catch {
        return { error: "Failed to parse JSON response" };
      }
    }
    const text = await res.text();
    return { error: text.length > 200 ? `Server returned HTTP ${res.status}` : text };
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/whatsapp/status");
      const data = await safeJsonParse(res);
      if (data && data.status) {
        setStatus(data.status || "DISCONNECTED");
        setQrCode(data.qrCode || null);
        setPhone(data.phone || null);
        setConnectedName(data.name || null);
        setConnectedAt(data.connectedAt || null);
        setLastActiveAt(data.lastActiveAt || null);
      }
    } catch (err) {
      console.error("Failed to poll WhatsApp status", err);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll every 3 seconds when connecting or awaiting QR scan
    const interval = setInterval(() => {
      fetchStatus();
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = async () => {
    try {
      setLoading(true);
      setNotice("Initializing WhatsApp session. Awaiting QR code from AlwaysData worker...");
      const res = await fetch("/api/whatsapp/connect", { method: "POST" });
      const data = await safeJsonParse(res);

      if (data && data.success) {
        setStatus(data.status || "CONNECTING");
        setQrCode(data.qrCode || null);
        setNotice(data.message || "Initializing WhatsApp session. Please scan the QR code...");
      } else if (data && data.status === "CONNECTING") {
        setStatus("CONNECTING");
        setQrCode(data.qrCode || null);
        setNotice("Worker connecting... Please wait a moment for the QR code to stream.");
      } else {
        setNotice(data.error ? `Status: ${data.error}` : "WhatsApp worker initializing. Please wait...");
      }
    } catch (err: any) {
      setNotice("Connection note: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect the active WhatsApp session?")) return;
    try {
      setLoading(true);
      const res = await fetch("/api/whatsapp/disconnect", { method: "POST" });
      const data = await safeJsonParse(res);
      if (res.ok && data) {
        setStatus("DISCONNECTED");
        setQrCode(null);
        setPhone(null);
        setNotice("WhatsApp session disconnected.");
      } else {
        setNotice("Error disconnecting: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      setNotice("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-500" />
            <span>WhatsApp Device Connection</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Link recovery WhatsApp session on AlwaysData worker for background reminders.
          </p>
        </div>

        <button
          onClick={fetchStatus}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 min-h-[44px] self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Status</span>
        </button>
      </div>

      {notice && (
        <div
          className={clsx(
            "p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 shadow-sm",
            notice.startsWith("Error")
              ? "bg-rose-50 text-rose-700 border border-rose-200"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          )}
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Main Connection Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-sm">
        {status === "CONNECTED" ? (
          /* STATE: CONNECTED */
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-emerald-950 dark:text-emerald-100">
                      WhatsApp Connected 🟢
                    </h2>
                    <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-emerald-500 text-white">
                      Live
                    </span>
                  </div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                    Phone: <span className="font-mono font-bold">{phone || "Linked Recovery Number"}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  disabled={loading}
                  onClick={handleConnect}
                  className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors min-h-[44px]"
                >
                  Reconnect
                </button>
                <button
                  disabled={loading}
                  onClick={handleDisconnect}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 flex items-center gap-1.5 transition-colors min-h-[44px]"
                >
                  <Power className="w-4 h-4" />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>

            {/* Session Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 block">Session Name</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block truncate">
                  {connectedName || "QistFlow WhatsApp Socket"}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 block">Connected Since</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                  {connectedAt ? new Date(connectedAt).toLocaleString("en-PK") : "Active Session"}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 block">Worker Status</span>
                <span className="font-bold text-emerald-500 mt-0.5 block flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>AlwaysData Active</span>
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* STATE: DISCONNECTED / QR READY / CONNECTING / LOGGED_OUT */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-center">
            {/* Left Column: Instructions & Action */}
            <div className="space-y-4 sm:space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>
                  {status === "CONNECTING"
                    ? "Worker Connecting..."
                    : status === "LOGGED_OUT"
                    ? "Session Logged Out"
                    : status === "QR_READY"
                    ? "QR Code Ready to Scan"
                    : "WhatsApp Disconnected"}
                </span>
              </div>

              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Connect WhatsApp via QR Code
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Link your recovery mobile device to dispatch automated Urdu installment reminders in the background.
                </p>
              </div>

              {/* Mobile Multi-Device Note */}
              <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
                <Info className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Mobile Tip:</strong> Initial pairing ke liye is QR code ko kisi doosre screen (laptop ya tablet) par open karein aur apne phone ke WhatsApp Linked Devices se scan karein.
                </p>
              </div>

              {/* Instructions List */}
              <div className="space-y-2.5 text-xs bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <div>Open <strong>WhatsApp</strong> on your recovery mobile phone.</div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <div>Tap <strong>Settings (⋮)</strong> → select <strong>Linked Devices</strong>.</div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                    3
                  </div>
                  <div>Tap <strong>Link a Device</strong> and point your camera at the QR code below.</div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  disabled={loading}
                  onClick={handleConnect}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-all hover:scale-105 min-h-[44px]"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <QrCode className="w-4 h-4" />
                  )}
                  <span>{qrCode ? "Regenerate QR Code" : "Connect WhatsApp"}</span>
                </button>
              </div>
            </div>

            {/* Right Column: QR Code Display Card */}
            <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-center min-h-[300px]">
              {qrCode ? (
                <div className="space-y-3 animate-in zoom-in-95">
                  <div className="p-3 bg-white rounded-2xl shadow-xl border border-slate-200 inline-block">
                    <img src={qrCode} alt="WhatsApp QR Code" className="w-56 h-56 sm:w-64 sm:h-64 rounded-lg object-contain" />
                  </div>
                  <div className="text-xs font-semibold text-emerald-600 flex items-center justify-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>Awaiting QR scan from your phone...</span>
                  </div>
                </div>
              ) : status === "CONNECTING" ? (
                <div className="space-y-3">
                  <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Generating secure pairing QR code...
                  </p>
                </div>
              ) : (
                <div className="space-y-3 text-slate-400">
                  <Smartphone className="w-12 h-12 mx-auto stroke-[1.5]" />
                  <p className="text-xs font-medium">
                    Click "Connect WhatsApp" to display the pairing QR code.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Security & Architecture Card */}
      <div className="bg-slate-900 text-slate-200 p-4 sm:p-5 rounded-2xl border border-slate-800 flex items-start gap-3.5 text-xs">
        <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-white">AlwaysData Background Worker Integration</span>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            QistFlow never runs Baileys in the mobile browser or on Vercel. Credentials stay safely in <code>./whatsapp_auth</code> on the AlwaysData persistent worker.
          </p>
        </div>
      </div>
    </div>
  );
}
