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
  Phone,
  Copy,
  Check,
  Key,
} from "lucide-react";
import clsx from "clsx";

export default function WhatsAppConnectionPage() {
  const [method, setMethod] = useState<"QR" | "PAIRING_CODE">("PAIRING_CODE");
  const [status, setStatus] = useState<string>("DISCONNECTED");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [connectedName, setConnectedName] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [lastActiveAt, setLastActiveAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Pairing code state
  const [pairingPhone, setPairingPhone] = useState("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const [workerOffline, setWorkerOffline] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/whatsapp/status?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Pragma": "no-cache" },
      });
      const data = await safeJsonParse(res);
      if (data && data.status) {
        setStatus(data.status || "DISCONNECTED");
        setQrCode(data.qrCode || null);
        if (data.pairingCode) {
          setPairingCode(data.pairingCode);
        }
        setPhone(data.phone || null);
        setConnectedName(data.name || null);
        setConnectedAt(data.connectedAt || null);
        setLastActiveAt(data.lastActiveAt || null);
        setWorkerOffline(!!data.workerOffline);
      }
    } catch (err) {
      console.error("Failed to poll WhatsApp status", err);
    }
  };

  const handleResetState = async () => {
    try {
      setLoading(true);
      await fetch("/api/whatsapp/disconnect", { method: "POST" });
      setStatus("DISCONNECTED");
      setQrCode(null);
      setPairingCode(null);
      setNotice(null);
      setWorkerOffline(false);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      fetchStatus();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/whatsapp/connect", { method: "POST" });
      const data = await safeJsonParse(res);

      if (data) {
        setStatus(data.status || "CONNECTING");
        setQrCode(data.qrCode || null);
        setNotice(null);
      }
    } catch (err: any) {
      setNotice(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairingPhone.trim()) return;

    try {
      setPairingLoading(true);
      setNotice(null);
      setPairingCode(null);

      const res = await fetch("/api/whatsapp/pairing-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: pairingPhone }),
      });

      const data = await safeJsonParse(res);
      if (res.ok && data.pairingCode) {
        setPairingCode(data.pairingCode);
        setNotice("Pairing code generated! Enter this 8-digit code on your WhatsApp mobile device.");
      } else {
        setNotice("Error: " + (data.error || "Failed to generate pairing code"));
      }
    } catch (err: any) {
      setNotice("Error: " + err.message);
    } finally {
      setPairingLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode.replace(/[^a-zA-Z0-9]/g, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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
        setPairingCode(null);
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
    <div className="space-y-5 sm:space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-500" />
            <span>WhatsApp Device Connection</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Link recovery WhatsApp session using 8-digit Pairing Code or QR Code on AlwaysData background worker.
          </p>
        </div>

        <button
          onClick={fetchStatus}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 min-h-[44px] self-start sm:self-auto"
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
          /* STATE: DISCONNECTED / QR READY / CONNECTING */
          <div className="space-y-6">
            {/* Method Tabs: Pairing Code vs QR Code */}
            <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl max-w-md">
              <button
                type="button"
                onClick={() => setMethod("PAIRING_CODE")}
                className={clsx(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all min-h-[40px]",
                  method === "PAIRING_CODE"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                <Phone className="w-3.5 h-3.5 text-emerald-500" />
                <span>Link with Phone Number</span>
              </button>

              <button
                type="button"
                onClick={() => setMethod("QR")}
                className={clsx(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all min-h-[40px]",
                  method === "QR"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                <QrCode className="w-3.5 h-3.5 text-emerald-500" />
                <span>Scan QR Code</span>
              </button>
            </div>

            {/* TAB 1: PAIRING CODE METHOD */}
            {method === "PAIRING_CODE" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-start">
                <div className="space-y-4">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                      Link WhatsApp with Phone Number
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Enter your recovery WhatsApp phone number to generate an 8-digit pairing code. No camera scanning required.
                    </p>
                  </div>

                  <form onSubmit={handleRequestPairingCode} className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        WhatsApp Recovery Phone Number
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={pairingPhone}
                          onChange={(e) => setPairingPhone(e.target.value)}
                          placeholder="e.g. 03001234567 or 923001234567"
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 font-mono font-bold focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 min-h-[44px]"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={pairingLoading || !pairingPhone.trim()}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-all min-h-[46px]"
                    >
                      {pairingLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Key className="w-4 h-4" />
                      )}
                      <span>{pairingLoading ? "Generating 8-digit Code..." : "Get 8-Digit Pairing Code"}</span>
                    </button>
                  </form>

                  {/* Instructions */}
                  <div className="space-y-2 text-xs bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">Pairing Steps on your Mobile:</div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">1</span>
                      <span>Open <strong>WhatsApp</strong> on your phone.</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">2</span>
                      <span>Tap <strong>Settings (⋮)</strong> → <strong>Linked Devices</strong>.</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">3</span>
                      <span>Tap <strong>Link a Device</strong> → select <strong>"Link with phone number instead"</strong> at the bottom.</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">4</span>
                      <span>Enter the 8-digit code shown on the right.</span>
                    </div>
                  </div>
                </div>

                {/* Pairing Code Display Box */}
                <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-center min-h-[280px]">
                  {pairingCode ? (
                    <div className="space-y-4 animate-in zoom-in-95">
                      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
                        Your WhatsApp Pairing Code:
                      </span>
                      <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-emerald-300 dark:border-emerald-700 inline-flex items-center gap-3">
                        <span className="font-mono font-black text-2xl sm:text-3xl text-emerald-600 dark:text-emerald-400 tracking-widest">
                          {pairingCode}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          title="Copy Pairing Code"
                          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition-colors"
                        >
                          {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                        </button>
                      </div>
                      <div className="text-xs font-semibold text-emerald-600 flex items-center justify-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        <span>Awaiting input on your phone...</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 text-slate-400">
                      <Key className="w-12 h-12 mx-auto stroke-[1.5]" />
                      <p className="text-xs font-medium">
                        Enter your phone number on the left and click "Get 8-Digit Pairing Code".
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: QR CODE METHOD */}
            {method === "QR" && (
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

                  {/* Instructions List */}
                  <div className="space-y-2.5 text-xs bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">1</div>
                      <div>Open <strong>WhatsApp</strong> on your recovery mobile phone.</div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">2</div>
                      <div>Tap <strong>Settings (⋮)</strong> → select <strong>Linked Devices</strong>.</div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">3</div>
                      <div>Tap <strong>Link a Device</strong> and point your camera at the QR code.</div>
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
                      <span>{qrCode ? "Regenerate QR Code" : "Connect via QR Code"}</span>
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
                    <div className="space-y-4 max-w-xs mx-auto">
                      <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Generating WhatsApp QR Code...
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          WhatsApp secure session initialize ho rahi hai. QR code foran show ho jaye ga.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleResetState}
                        className="text-xs font-semibold text-rose-600 hover:underline block mx-auto"
                      >
                        Reset / Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 text-slate-400">
                      <Smartphone className="w-12 h-12 mx-auto stroke-[1.5]" />
                      <p className="text-xs font-medium">
                        Click "Connect via QR Code" to display the pairing QR code.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
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
