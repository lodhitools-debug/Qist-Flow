"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Briefcase,
  Phone,
  Mail,
  UserCheck,
  CreditCard,
  Calendar,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Plus,
} from "lucide-react";
import clsx from "clsx";

async function safeJsonParse(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return {
      success: false,
      error: `Server HTTP ${res.status}: ${text.slice(0, 200)}`,
    };
  }
}

export default function TeamManagementPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/team");
      const json = await safeJsonParse(res);
      if (res.ok && json.success) {
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load team data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, []);

  const metrics = data?.metrics || {
    totalOfficers: 0,
    totalCustomers: 0,
    dueToday: 0,
    overdue: 0,
    totalOutstanding: 0,
  };

  const teamMembers = data?.teamMembers || [];
  const manager = data?.manager;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Briefcase className="w-6 h-6 text-indigo-500" />
            <span>Recovery Team Portfolio</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage recovery officers in your team, monitor loan recovery performance, and track portfolio balances.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/users"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Manage Team Users</span>
          </Link>
          <button
            onClick={fetchTeamData}
            title="Refresh Team Data"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Team Officers</span>
          <span className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 block">
            {metrics.totalOfficers}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 block">Assigned Customers</span>
          <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1 block">
            {metrics.totalCustomers}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-amber-100 dark:border-amber-900/40 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 block">Due Today</span>
          <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 block">
            {metrics.dueToday}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-rose-100 dark:border-rose-900/40 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 block">Overdue Installments</span>
          <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1 block">
            {metrics.overdue}
          </span>
        </div>
      </div>

      {/* Team Members List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" />
            <span>Assigned Recovery Officers ({teamMembers.length})</span>
          </h3>
          {manager && (
            <span className="text-xs text-slate-500">
              Team Lead: <strong className="text-slate-900 dark:text-white">{manager.name}</strong> ({manager.branch || "MAIN"})
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Officer Name</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Portfolio Size</th>
                <th className="py-3 px-4">Due Today</th>
                <th className="py-3 px-4">Overdue</th>
                <th className="py-3 px-4">Total Balance</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Portfolio Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    Loading team members...
                  </td>
                </tr>
              ) : teamMembers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    No recovery officers currently assigned to this team.
                  </td>
                </tr>
              ) : (
                teamMembers.map((off: any) => (
                  <tr key={off.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    {/* Name */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs flex-shrink-0">
                          {off.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {off.name}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {off.employeeCode || off.branch || "MAIN"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="py-3 px-4">
                      <span className="text-slate-800 dark:text-slate-200 block font-medium">{off.email}</span>
                      <span className="font-mono text-[11px] text-slate-400">{off.phone || "—"}</span>
                    </td>

                    {/* Customers Count */}
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {off.customersCount} Customers
                      </span>
                    </td>

                    {/* Due Today */}
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700">
                        {off.dueTodayCount}
                      </span>
                    </td>

                    {/* Overdue */}
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700">
                        {off.overdueCount}
                      </span>
                    </td>

                    {/* Total Balance */}
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      Rs. {off.totalBalance.toLocaleString()}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span
                        className={clsx(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                          off.isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-300"
                        )}
                      >
                        {off.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/customers?assignedToUserId=${off.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-xs font-bold border border-indigo-200 dark:border-indigo-800 transition-colors"
                      >
                        <span>View Portfolio</span>
                        <ArrowRight className="w-3.5 h-3.5" />
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
