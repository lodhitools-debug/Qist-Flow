"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  QrCode,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  WifiOff,
  Wifi,
  LogOut,
  Smartphone,
  Clock,
  ArrowLeftRight,
  Loader2,
} from "lucide-react";
import Image from "next/image";

// ─── Connection state machine ─────────────────────────────────────────────────
type WAStatus =
  | "NOT_CONNECTED"
  | "CONNECTING"
  | "INIT_QR"
  | "QR_READY"
  | "PAIRING"
  | "CONNECTED"
  | "DISCONNECTED"
  | "RECONNECTING"
  | "LOGGED_OUT"
  | "ERROR"
  | string;

// How often to poll the status API (ms)
const POLL_INTERVAL_CONNECTED = 30_000;
const POLL_INTERVAL_QR        = 3_000;
const POLL_INTERVAL_DEFAULT   = 5_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function safePost(url: string, body?: object): Promise<{ ok: boolean; data: any }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("application/json") ? await res.json() : { error: `HTTP ${res.status}` };
    return { ok: res.ok, data };
  } catch (e: any) {
    return { ok: false, data: { error: e.message } };
  }
}

// ─── Modal component ──────────────────────────────────────────────────────────
function ConfirmModal({
  title,
  body,
  confirmLabel,
  confirmClass,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  confirmClass: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 border border-slate-200 dark:border-slate-700">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{body}</p>
        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── QR countdown ─────────────────────────────────────────────────────────────
function useQrCountdown(qrExpiresAt: string | null): number | null {
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => {
    if (!qrExpiresAt) { setSeconds(null); return; }
    const tick = () => {
      const left = Math.max(0, Math.ceil((new Date(qrExpiresAt).getTime() - Date.now()) / 1000));
      setSeconds(left);
    };
    tick();
    const t = setInterval(tick, 1_000);
    return () => clearInterval(t);
  }, [qrExpiresAt]);
  return seconds;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WhatsAppConnectionPage() {
  const [status, setStatus]           = useState<WAStatus>("NOT_CONNECTED");
  const [qrCode, setQrCode]           = useState<string | null>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<string | null>(null);
  const [phone, setPhone]             = useState<string | null>(null);
  const [connectedName, setConnectedName] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const [notice, setNotice]           = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [loadingConnect, setLoadingConnect]         = useState(false);
  const [loadingDisconnect, setLoadingDisconnect]   = useState(false);
  const [loadingChangeNumber, setLoadingChangeNumber] = useState(false);

  const [showChangeModal, setShowChangeModal] = useState(false);

  const qrSeconds = useQrCountdown(qrExpiresAt);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);

  // ── Poll for status ─────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/whatsapp/status?t=${Date.now()}`, {
        cache: "no-store",
        headers: { Pragma: "no-cache" },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!isMounted.current) return;
      if (data?.status) {
        setStatus(data.status);
        setQrCode(data.qrCode || null);
        setQrExpiresAt(data.qrExpiresAt || null);
        setPhone(data.phone || null);
        setConnectedName(data.name || null);
        setConnectedAt(data.connectedAt || null);
        setErrorMsg(data.errorMessage || null);
      }
    } catch {}
  }, []);

  const scheduleNextPoll = useCallback((currentStatus: WAStatus) => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    let interval = POLL_INTERVAL_DEFAULT;
    if (currentStatus === "CONNECTED")  interval = POLL_INTERVAL_CONNECTED;
    if (currentStatus === "QR_READY" || currentStatus === "INIT_QR" || currentStatus === "PAIRING" || currentStatus === "CONNECTING") {
      interval = POLL_INTERVAL_QR;
    }
    pollTimerRef.current = setTimeout(async () => {
      await fetchStatus();
    }, interval);
  }, [fetchStatus]);

  useEffect(() => {
    isMounted.current = true;
    fetchStatus();
    return () => {
      isMounted.current = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    scheduleNextPoll(status);
  }, [status, scheduleNextPoll]);

  const showNotice = (type: "success" | "error", text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 5_000);
  };

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleConnect = async () => {
    setLoadingConnect(true);
    setNotice(null);
    setQrCode(null);
    setStatus("INIT_QR");
    const { ok, data } = await safePost("/api/whatsapp/connect");
    setLoadingConnect(false);
    if (!ok || data?.success === false) {
      setStatus("ERROR");
      showNotice("error", data?.error || "Connection failed. Please try again.");
    } else {
      setStatus(data.status || "INIT_QR");
      // Start fast polling
      fetchStatus();
    }
  };

  const handleDisconnect = async () => {
    setLoadingDisconnect(true);
    const { ok, data } = await safePost("/api/whatsapp/disconnect");
    setLoadingDisconnect(false);
    if (!ok || data?.success === false) {
      showNotice("error", data?.error || "Could not disconnect. Please try again.");
    } else {
      setStatus("DISCONNECTED");
      setQrCode(null);
      setPhone(null);
      showNotice("success", "WhatsApp disconnected. Your session is preserved.");
    }
  };

  const handleChangeNumber = async () => {
    setShowChangeModal(false);
    setLoadingChangeNumber(true);
    const { ok, data } = await safePost("/api/whatsapp/change-number");
    setLoadingChangeNumber(false);
    if (!ok || data?.success === false) {
      showNotice("error", data?.error || "Could not remove WhatsApp. Please try again.");
    } else {
      setStatus("LOGGED_OUT");
      setQrCode(null);
      setPhone(null);
      setConnectedName(null);
      setConnectedAt(null);
      showNotice("success", "WhatsApp account removed. Connect a new number below.");
    }
  };

  const handleNewQr = async () => {
    setLoadingConnect(true);
    setQrCode(null);
    setStatus("INIT_QR");
    const { ok, data } = await safePost("/api/whatsapp/connect");
    setLoadingConnect(false);
    if (!ok) showNotice("error", "Could not generate new QR. Please try again.");
    else { setStatus(data.status || "INIT_QR"); fetchStatus(); }
  };

  // ── Formatters ───────────────────────────────────────────────────────────────
  const formatPhone = (p: string | null) => {
    if (!p) return "";
    return p.startsWith("92") ? `+${p}` : p;
  };

  const formatDate = (d: string | null) => {
    if (!d) return "";
    return new Date(d).toLocaleString("en-PK", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  // ── Loading states ───────────────────────────────────────────────────────────
  const isTransitioning =
    status === "CONNECTING" || status === "INIT_QR" || status === "RECONNECTING";

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-emerald-500" />
            WhatsApp Connection
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Connect your personal WhatsApp to send recovery reminders.
          </p>
        </div>

        {/* Notice banner */}
        {notice && (
          <div
            className={`p-3.5 rounded-xl text-sm font-medium flex items-center gap-2.5 ${
              notice.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
            }`}
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {notice.text}
          </div>
        )}

        {/* ── STATE: CONNECTED ─────────────────────────────────────────────── */}
        {status === "CONNECTED" && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Green status bar */}
            <div className="bg-emerald-500 px-5 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-white font-bold text-sm flex items-center gap-2">
                  WhatsApp Connected
                  <span className="text-[10px] font-black bg-white/20 px-2 py-0.5 rounded-full">LIVE</span>
                </div>
                <div className="text-emerald-100 text-xs mt-0.5">
                  Your recovery reminders are active
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <Smartphone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div>
                  <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Phone Number</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                    {formatPhone(phone)}
                    {connectedName && (
                      <span className="ml-2 font-normal text-slate-500 text-xs">({connectedName})</span>
                    )}
                  </div>
                </div>
              </div>

              {connectedAt && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Connected Since</div>
                    <div className="text-sm text-slate-700 dark:text-slate-300">{formatDate(connectedAt)}</div>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2.5 pt-1">
                <button
                  disabled={loadingDisconnect || loadingChangeNumber}
                  onClick={handleDisconnect}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
                >
                  {loadingDisconnect
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <WifiOff className="w-4 h-4" />
                  }
                  Disconnect
                </button>
                <button
                  disabled={loadingDisconnect || loadingChangeNumber}
                  onClick={() => setShowChangeModal(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold disabled:opacity-50 transition-colors shadow-sm"
                >
                  {loadingChangeNumber
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <ArrowLeftRight className="w-4 h-4" />
                  }
                  Change Number
                </button>
              </div>
            </div>

            {/* Info strip */}
            <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-3 bg-blue-50/50 dark:bg-blue-950/20">
              <p className="text-[11px] text-blue-600 dark:text-blue-400">
                <strong>Disconnect</strong> — temporary pause, same number reconnects automatically.<br />
                <strong>Change Number</strong> — permanently removes this account; fresh QR required.
              </p>
            </div>
          </div>
        )}

        {/* ── STATE: QR_READY ──────────────────────────────────────────────── */}
        {status === "QR_READY" && qrCode && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
            <div className="text-center space-y-1">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Scan QR Code</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Open WhatsApp → Settings → Linked Devices → Link a Device
              </p>
            </div>

            {/* QR Image */}
            <div className="flex justify-center">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCode}
                  alt="WhatsApp QR Code"
                  className="w-56 h-56 rounded-xl border-4 border-slate-100 dark:border-slate-700 shadow-lg"
                />
                {qrSeconds !== null && qrSeconds <= 10 && (
                  <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                    <div className="text-white text-center">
                      <div className="text-3xl font-black">{qrSeconds}</div>
                      <div className="text-xs">Expiring</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Countdown */}
            <div className="text-center space-y-3">
              {qrSeconds !== null && qrSeconds > 0 && (
                <div className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-800">
                  <Clock className="w-3.5 h-3.5" />
                  QR expires in {qrSeconds}s
                </div>
              )}
              <p className="text-xs text-slate-400">Waiting for scan...</p>
            </div>

            <button
              onClick={handleNewQr}
              disabled={loadingConnect}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {loadingConnect
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <RefreshCw className="w-4 h-4" />
              }
              Generate New QR
            </button>
          </div>
        )}

        {/* ── STATE: TRANSITIONING (CONNECTING / INIT_QR / RECONNECTING) ──── */}
        {isTransitioning && !qrCode && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {status === "RECONNECTING" ? "Reconnecting..." : "Connecting to WhatsApp..."}
              </p>
              <p className="text-xs text-slate-400">QR code will appear in a moment</p>
            </div>
          </div>
        )}

        {/* ── STATE: PAIRING (waiting for user to enter pairing code on phone) */}
        {status === "PAIRING" && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/40 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-purple-500 animate-spin" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Waiting for WhatsApp...</p>
              <p className="text-xs text-slate-400">Enter the pairing code on your phone</p>
            </div>
          </div>
        )}

        {/* ── STATE: DISCONNECTED ─────────────────────────────────────────── */}
        {status === "DISCONNECTED" && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-4 p-4 bg-amber-50/80 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
                <WifiOff className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">WhatsApp Paused</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">Your session is saved. Reconnect without scanning a new QR.</p>
              </div>
            </div>
            <button
              disabled={loadingConnect}
              onClick={handleConnect}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm disabled:opacity-50 transition-colors shadow-md shadow-emerald-500/20"
            >
              {loadingConnect ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
              Reconnect WhatsApp
            </button>
            <button
              onClick={() => setShowChangeModal(true)}
              className="w-full text-xs text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
            >
              Connect a different WhatsApp number instead
            </button>
          </div>
        )}

        {/* ── STATE: NOT_CONNECTED / LOGGED_OUT / ERROR ──────────────────── */}
        {(status === "NOT_CONNECTED" || status === "LOGGED_OUT" || status === "ERROR") && !isTransitioning && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
            {/* Status indicator */}
            <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                <QrCode className="w-5 h-5 text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  WhatsApp Not Connected
                </p>
                {status === "ERROR" && errorMsg ? (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">{errorMsg}</p>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Connect your WhatsApp to send recovery reminders.
                  </p>
                )}
              </div>
            </div>

            <button
              disabled={loadingConnect}
              onClick={handleConnect}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm disabled:opacity-50 transition-colors shadow-md shadow-emerald-500/20"
            >
              {loadingConnect ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
              {loadingConnect ? "Generating QR..." : "Connect WhatsApp"}
            </button>

            {/* Instructions */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">How to connect</p>
              <ol className="space-y-2">
                {[
                  "Click \"Connect WhatsApp\" above",
                  "A QR code will appear on screen",
                  "Open WhatsApp on your phone",
                  "Go to Settings → Linked Devices → Link a Device",
                  "Scan the QR code",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-bold flex items-center justify-center text-[10px]">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {/* ── Change Number Confirmation Modal ─────────────────────────────── */}
        {showChangeModal && (
          <ConfirmModal
            title="Change WhatsApp Number?"
            body="Your current WhatsApp account will be disconnected and removed. You will need to scan a new QR code to connect a different number."
            confirmLabel="Continue"
            confirmClass="bg-rose-600 hover:bg-rose-700"
            onConfirm={handleChangeNumber}
            onCancel={() => setShowChangeModal(false)}
          />
        )}
      </div>
    </div>
  );
}
