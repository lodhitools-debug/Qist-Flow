"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PhoneCall,
  Send,
  CalendarCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Users,
  CreditCard,
  ArrowRight,
  Filter,
} from "lucide-react";
import clsx from "clsx";
import { getStatusBadgeConfig } from "@/lib/installment-engine";
import { formatDisplayPhone } from "@/lib/excel/mapper";

export default function RecoveryWorkspacePage() {
  const [activeTab, setActiveTab] = useState<string>("DUE_TODAY");
  const [branch, setBranch] = useState<string>("ALL");
  const [targets, setTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTargets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        filterType: activeTab,
        branch,
      });

      const res = await fetch(`/api/recovery/targets?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTargets(data.targets || []);
      }
    } catch (err) {
      console.error("Failed to load recovery targets", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTargets();
  }, [activeTab, branch]);

  const tabs = [
    { id: "DUE_TODAY", label: "Due Today", icon: CalendarCheck, color: "text-amber-500" },
    { id: "OVERDUE_1D", label: "1 Day Overdue", icon: AlertTriangle, color: "text-orange-500" },
    { id: "OVERDUE_3D", label: "3 Days Overdue", icon: AlertTriangle, color: "text-rose-500" },
    { id: "OVERDUE_7D", label: "7 Days Overdue", icon: AlertTriangle, color: "text-red-600" },
    { id: "OVERDUE_15D", label: "15+ Days Overdue", icon: AlertTriangle, color: "text-red-800" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <PhoneCall className="w-5 h-5 text-emerald-500" />
            <span>Recovery Operations Hub</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Segmented buckets for due dates and overdue follow-up queues.
          </p>
        </div>

        <Link
          href={`/recovery/send-reminders?filter=${activeTab}`}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all hover:scale-105"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Launch Bulk Reminder Wizard ({targets.length})</span>
        </Link>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 dark:border-slate-800 pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 whitespace-nowrap",
                isActive
                  ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              <Icon className={clsx("w-4 h-4", tab.color)} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Target Accounts: <span className="text-emerald-600 font-bold">{targets.length}</span>
          </div>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Branches</option>
            <option value="QBLAN">QBLAN (Landhi)</option>
            <option value="QBKOR">QBKOR (Korangi)</option>
            <option value="QBNZN">QBNZN</option>
            <option value="MAIN">MAIN</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-400 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Account</th>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Primary Phone</th>
                <th className="py-3 px-4">Branch</th>
                <th className="py-3 px-4">EMI Amount</th>
                <th className="py-3 px-4">Balance</th>
                <th className="py-3 px-4">Days Overdue</th>
                <th className="py-3 px-4">Officer</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Filtering targets...</span>
                  </td>
                </tr>
              ) : targets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No customers found in this bucket.
                  </td>
                </tr>
              ) : (
                targets.map((t) => (
                  <tr key={t.installmentId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {t.account}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      <Link href={`/customers/${t.customerId}`} className="hover:underline hover:text-emerald-600">
                        {t.customerName}
                      </Link>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                      {formatDisplayPhone(t.primaryPhone)}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{t.branch}</td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      Rs. {t.emi?.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-rose-600 dark:text-rose-400">
                      Rs. {t.balance?.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-amber-600 dark:text-amber-400">
                      {t.daysOverdue > 0 ? `${t.daysOverdue} days` : "Due Today"}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{t.recoveryPerson || "Unassigned"}</td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/customers/${t.customerId}`}
                        className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        Profile →
                      </Link>
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
