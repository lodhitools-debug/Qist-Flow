"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  Search,
  DollarSign,
  ShieldCheck,
  Send,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import clsx from "clsx";
import { getStatusBadgeConfig } from "@/lib/installment-engine";
import { formatDisplayPhone } from "@/lib/excel/mapper";

export default function InstallmentsPage() {
  const [installments, setInstallments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  const fetchInstallments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        search,
        status,
        page: String(page),
        limit: "25",
      });

      const res = await fetch(`/api/installments?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setInstallments(data.installments || []);
        setPagination(data.pagination || { total: 0, totalPages: 1 });
      }
    } catch (err) {
      console.error("Failed to load installments", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstallments();
  }, [search, status, page]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <CreditCard className="w-5 h-5 text-emerald-500" />
            <span>Installment Schedule & Status Engine</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time calculation engine evaluating due dates, collections, and overdue portfolio.
          </p>
        </div>

        <button
          onClick={fetchInstallments}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 self-start sm:self-auto"
        >
          <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin text-emerald-500")} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by customer name, account, phone, officer..."
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
        >
          <option value="ALL">All Installment Statuses</option>
          <option value="DUE_TODAY">Due Today</option>
          <option value="OVERDUE">Overdue</option>
          <option value="UPCOMING">Upcoming</option>
          <option value="PAID">Paid</option>
          <option value="PARTIAL">Partial</option>
          <option value="UNKNOWN">Unknown (Pending Review)</option>
        </select>
      </div>

      {/* Installment Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-400 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Account</th>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Monthly EMI</th>
                <th className="py-3 px-4">Remaining Balance</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Calculated Status</th>
                <th className="py-3 px-4">Last Payment</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading installments...</span>
                  </td>
                </tr>
              ) : installments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No installments matching the query.
                  </td>
                </tr>
              ) : (
                installments.map((inst) => {
                  const cust = inst.customer;
                  const badge = getStatusBadgeConfig(inst.status || "UNKNOWN");
                  const dueStr = inst.dueDate ? new Date(inst.dueDate).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }) : "N/A";
                  const lastPayStr = inst.lastPaymentDate ? `${new Date(inst.lastPaymentDate).toLocaleDateString("en-PK", { day: "2-digit", month: "short" })} (Rs. ${inst.lastPaymentAmount || 0})` : "—";

                  return (
                    <tr key={inst.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {cust?.account}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        <Link href={`/customers/${cust?.id}`} className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline">
                          {cust?.customerName}
                        </Link>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                        {formatDisplayPhone(cust?.primaryPhone)}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        Rs. {inst.emi?.toLocaleString() || 0}
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-600 dark:text-rose-400">
                        Rs. {inst.balance?.toLocaleString() || 0}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                        {dueStr}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={clsx(
                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                            badge.color
                          )}
                        >
                          <span className={clsx("w-1.5 h-1.5 rounded-full", badge.dot)} />
                          <span>{badge.label}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {lastPayStr}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/customers/${cust?.id}`}
                          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          View 360°
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing {installments.length} of {pagination.total} installment items
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold px-2">
              Page {page} of {pagination.totalPages || 1}
            </span>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(page + 1)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
