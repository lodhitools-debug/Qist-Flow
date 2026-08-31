"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  CalendarCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  CreditCard,
  Send,
  FileSpreadsheet,
  QrCode,
  ArrowUpRight,
  Phone,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  UserCheck,
  MessageSquare,
} from "lucide-react";
import clsx from "clsx";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dashboard/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to load dashboard stats", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatPKR = (num: number = 0) => {
    return new Intl.NumberFormat("en-PK", {
      maximumFractionDigits: 0,
    }).format(Math.round(num));
  };

  const summary = stats?.summary || {};
  const priority = stats?.priorityLists || {};
  const officers = stats?.officerPerformance || [];

  return (
    <div className="space-y-5 sm:space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner with Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 sm:p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-full bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>QistBazar Recovery Engine</span>
          </div>
          <h1 className="text-lg sm:text-2xl font-black tracking-tight">
            Recovery Overview & Live WhatsApp Queue
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
            Track due dates, monitor AlwaysData background worker, and dispatch automated Urdu reminders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 relative z-10">
          <Link
            href="/imports"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold border border-slate-700 transition-all hover:scale-105 shadow-sm min-h-[44px]"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Import Sheet</span>
          </Link>

          <Link
            href="/recovery/send-reminders"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold transition-all hover:scale-105 shadow-lg shadow-emerald-500/20 min-h-[44px]"
          >
            <Send className="w-4 h-4" />
            <span>Send Reminders</span>
          </Link>

          <button
            onClick={fetchStats}
            title="Refresh statistics"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors min-h-[44px]"
          >
            <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin text-emerald-400")} />
          </button>
        </div>
      </div>

      {/* 7 Key Mobile & Desktop Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-3.5">
        {/* 1. Total Customers */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Total Accounts</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="h-6 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            ) : (
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {summary.totalCustomers || 0}
              </div>
            )}
            <div className="text-[10px] text-slate-400 mt-0.5">Active portfolio</div>
          </div>
        </div>

        {/* 2. Today's Due */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">Today's Due</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="h-6 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            ) : (
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
                {summary.dueToday || summary.dueTodayCount || 0}
              </div>
            )}
            <div className="text-[10px] text-slate-400 mt-0.5">Due today</div>
          </div>
        </div>

        {/* 3. Overdue */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-rose-200 dark:border-rose-900/50 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-400">Overdue</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="h-6 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            ) : (
              <div className="text-xl font-bold text-rose-600 dark:text-rose-400">
                {summary.overdue || summary.overdueCount || 0}
              </div>
            )}
            <div className="text-[10px] text-slate-400 mt-0.5">Pending follow-up</div>
          </div>
        </div>

        {/* 4. Today's Recovery */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">Today's Recovery</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="h-6 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            ) : (
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                Rs. {formatPKR(summary.todayRecovery)}
              </div>
            )}
            <div className="text-[10px] text-slate-400 mt-0.5">Collections today</div>
          </div>
        </div>

        {/* 5. Pending WhatsApp (Queued) */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400">Pending WhatsApp</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="h-6 w-14 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            ) : (
              <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                {summary.waQueued || 0}
              </div>
            )}
            <div className="text-[10px] text-slate-400 mt-0.5">In server queue</div>
          </div>
        </div>

        {/* 6. Messages Sent (Today) */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-teal-200 dark:border-teal-900/50 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-400">Messages Sent</span>
            <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="h-6 w-14 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            ) : (
              <div className="text-xl font-bold text-teal-600 dark:text-teal-400">
                {summary.waSentToday || 0}
              </div>
            )}
            <div className="text-[10px] text-slate-400 mt-0.5">Delivered today</div>
          </div>
        </div>

        {/* 7. Assigned Customers */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Assigned Customers</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="h-6 w-14 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            ) : (
              <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                {summary.assignedCustomers || 0}
              </div>
            )}
            <div className="text-[10px] text-slate-400 mt-0.5">With assigned staff</div>
          </div>
        </div>
      </div>

      {/* WhatsApp Delivery Stats Bar */}
      <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            <Send className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold">AlwaysData WhatsApp Dispatcher</div>
            <div className="text-[11px] text-slate-400">Persistent background worker & message queue</div>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-slate-400">Sent Today:</span>
            <span className="font-bold text-emerald-400">{summary.waSentToday || 0}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            <span className="text-slate-400">Queued:</span>
            <span className="font-bold text-indigo-400">{summary.waQueued || 0}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            <span className="text-slate-400">Failed:</span>
            <span className="font-bold text-rose-400">{summary.waFailedToday || 0}</span>
          </div>

          <Link
            href="/whatsapp/connection"
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 min-h-[40px]"
          >
            <span>Worker State</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Priority Action Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {/* Due Today Queue */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-amber-500" />
                <span>Due Today Customers ({summary.dueToday || 0})</span>
              </h2>
              <p className="text-[11px] text-slate-400">Installments scheduled for payment today</p>
            </div>
            <Link
              href="/recovery/send-reminders?filter=DUE_TODAY"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Send Reminders →
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2 py-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : priority.dueToday && priority.dueToday.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {priority.dueToday.map((item: any) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {item.customer.customerName}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Acc: {item.customer.account} • {item.customer.branch} • {item.customer.primaryPhone}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900 dark:text-white">
                      Rs. {formatPKR(item.emi)}
                    </div>
                    <div className="text-[10px] text-amber-600 font-semibold">Due Today</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              No customers due today.
            </div>
          )}
        </div>

        {/* Overdue Priority Queue */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span>High-Priority Overdue ({summary.overdue || 0})</span>
              </h2>
              <p className="text-[11px] text-slate-400">Accounts with pending balances requiring follow-up</p>
            </div>
            <Link
              href="/recovery/send-reminders?filter=ALL_OVERDUE"
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
            >
              Send Notices →
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2 py-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : priority.overdue && priority.overdue.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {priority.overdue.map((item: any) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {item.customer.customerName}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Acc: {item.customer.account} • Officer: {item.customer.recoveryPerson || "Unassigned"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-rose-600 dark:text-rose-400">
                      Rs. {formatPKR(item.balance)}
                    </div>
                    <div className="text-[10px] text-slate-400">EMI: Rs. {formatPKR(item.emi)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              No overdue accounts found.
            </div>
          )}
        </div>
      </div>

      {/* Recovery Officer Leaderboard */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Recovery Officer Portfolio & Performance
            </h2>
            <p className="text-[11px] text-slate-400">Assigned customer volume and overdue breakdown by staff</p>
          </div>
          <Link href="/reports" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
            Full Reports →
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2 py-2">
            {[1, 2].map((n) => (
              <div key={n} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : officers && officers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Officer Name</th>
                  <th className="py-2.5 px-3">Assigned Accounts</th>
                  <th className="py-2.5 px-3">Due Today</th>
                  <th className="py-2.5 px-3">Overdue Count</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {officers.map((off: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      {off.name}
                    </td>
                    <td className="py-2.5 px-3">{off.totalAccounts}</td>
                    <td className="py-2.5 px-3 text-amber-600 font-semibold">{off.dueToday}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                        {off.overdue} Overdue
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Link
                        href={`/customers?recoveryPerson=${encodeURIComponent(off.name)}`}
                        className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                      >
                        View Accounts
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            Import customer report to see officer portfolios.
          </div>
        )}
      </div>
    </div>
  );
}
