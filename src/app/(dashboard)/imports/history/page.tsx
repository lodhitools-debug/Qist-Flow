"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  History,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Plus,
} from "lucide-react";
import clsx from "clsx";

export default function ImportHistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/imports/history");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error("Failed to load import history", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <History className="w-5 h-5 text-emerald-500" />
            <span>Excel Import Audit History</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Historical audit log of uploaded recovery reports, row counts, and snapshot rollback checkpoints.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin text-emerald-500")} />
            <span>Refresh</span>
          </button>
          <Link
            href="/imports"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload New Report</span>
          </Link>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-400 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">File Name</th>
                <th className="py-3 px-4">Date / Time</th>
                <th className="py-3 px-4">Uploaded By</th>
                <th className="py-3 px-4">Total Rows</th>
                <th className="py-3 px-4">New Accounts</th>
                <th className="py-3 px-4">Updated Accounts</th>
                <th className="py-3 px-4">Errors</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading import logs...</span>
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No Excel imports recorded yet.
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span>{item.fileName}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString("en-PK")}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {item.user?.name || "System Admin"}
                    </td>
                    <td className="py-3 px-4 font-bold">{item.totalRows}</td>
                    <td className="py-3 px-4 font-bold text-blue-600">+{item.newRecords}</td>
                    <td className="py-3 px-4 font-bold text-emerald-600">{item.updatedRecords}</td>
                    <td className="py-3 px-4">
                      {item.errorCount > 0 ? (
                        <span className="font-bold text-rose-500">{item.errorCount}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={clsx(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold",
                          item.status === "SUCCESS"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        )}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
