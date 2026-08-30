"use client";

import { useEffect, useState } from "react";
import {
  History,
  Send,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Trash2,
  Play,
  Layers,
} from "lucide-react";
import clsx from "clsx";
import { formatDisplayPhone } from "@/lib/excel/mapper";

export default function MessageHistoryPage() {
  const [view, setView] = useState<"HISTORY" | "QUEUE">("HISTORY");
  const [logs, setLogs] = useState<any[]>([]);
  const [queueItems, setQueueItems] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [processingQueue, setProcessingQueue] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        search,
        status: statusFilter,
        limit: "50",
      });

      const res = await fetch(`/api/whatsapp/history?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to load message history", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/whatsapp/queue?limit=50");
      if (res.ok) {
        const data = await res.json();
        setQueueItems(data.items || []);
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to load queue", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === "HISTORY") fetchHistory();
    else fetchQueue();
  }, [view, search, statusFilter]);

  const handleProcessQueueNow = async () => {
    try {
      setProcessingQueue(true);
      setActionNotice(null);
      const res = await fetch("/api/whatsapp/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "process" }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionNotice(data.message);
        fetchQueue();
      }
    } catch (err: any) {
      setActionNotice("Error: " + err.message);
    } finally {
      setProcessingQueue(false);
    }
  };

  const handleRetryItem = async (queueId: string) => {
    try {
      const res = await fetch("/api/whatsapp/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", queueId }),
      });
      if (res.ok) fetchQueue();
    } catch (err) {
      console.error("Failed to retry item", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <History className="w-5 h-5 text-emerald-500" />
            <span>WhatsApp Dispatch Logs & Queue</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Delivery confirmation logs, queue status, rate limiting throttling monitor, and retry controls.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => (view === "HISTORY" ? fetchHistory() : fetchQueue())}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin text-emerald-500")} />
            <span>Refresh</span>
          </button>

          <button
            disabled={processingQueue}
            onClick={handleProcessQueueNow}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-500/20 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{processingQueue ? "Processing..." : "Process Queue Now"}</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 text-xs font-semibold">
          {actionNotice}
        </div>
      )}

      {/* Queue Metric Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 block">Pending in Queue</span>
            <span className="text-xl font-bold text-amber-500 mt-1 block">{stats.queued}</span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 block">Currently Sending</span>
            <span className="text-xl font-bold text-blue-500 mt-1 block">{stats.sending}</span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 block">Sent Today</span>
            <span className="text-xl font-bold text-emerald-500 mt-1 block">{stats.sentToday}</span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 block">Failed Today</span>
            <span className="text-xl font-bold text-rose-500 mt-1 block">{stats.failedToday}</span>
          </div>
        </div>
      )}

      {/* Toggle View Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("HISTORY")}
            className={clsx(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all",
              view === "HISTORY"
                ? "bg-slate-900 text-white dark:bg-emerald-600"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            Delivery History ({logs.length})
          </button>
          <button
            onClick={() => setView("QUEUE")}
            className={clsx(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all",
              view === "QUEUE"
                ? "bg-slate-900 text-white dark:bg-emerald-600"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            Active Sending Queue ({queueItems.length})
          </button>
        </div>

        {view === "HISTORY" && (
          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search phone, text, customer..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-1 text-xs focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Table: Delivery History */}
      {view === "HISTORY" ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-400 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Customer / Acc</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Message Content</th>
                  <th className="py-3 px-4">Sent Time</th>
                  <th className="py-3 px-4">Delivery Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <span>Loading delivery logs...</span>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No WhatsApp delivery history found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {formatDisplayPhone(log.recipientPhone)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {log.customer?.customerName || "—"}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Acc: {log.customer?.account || "N/A"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {log.messageType}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate" title={log.messageText}>
                        <div className="truncate text-slate-700 dark:text-slate-300">
                          {log.messageText}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(log.sentAt).toLocaleString("en-PK")}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={clsx(
                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold",
                            log.status === "SENT"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                          )}
                        >
                          {log.status === "SENT" ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <AlertCircle className="w-3 h-3 text-rose-500" />
                          )}
                          <span>{log.status}</span>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Table: Active Sending Queue */
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-400 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Message Text</th>
                  <th className="py-3 px-4">Scheduled For</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Retries</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {queueItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Sending queue is currently empty.
                    </td>
                  </tr>
                ) : (
                  queueItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {formatDisplayPhone(item.recipientPhone)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        {item.customer?.customerName || "—"}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate" title={item.messageText}>
                        <div className="truncate">{item.messageText}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(item.scheduledFor).toLocaleTimeString("en-PK")}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={clsx(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold",
                            item.status === "QUEUED"
                              ? "bg-amber-50 text-amber-700"
                              : item.status === "SENDING"
                              ? "bg-blue-50 text-blue-700 animate-pulse"
                              : item.status === "SENT"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          )}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {item.retryCount} / {item.maxRetries}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {item.status === "FAILED" && (
                          <button
                            onClick={() => handleRetryItem(item.id)}
                            className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50 border border-emerald-200 text-[11px] font-semibold"
                            title="Retry Message"
                          >
                            <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
