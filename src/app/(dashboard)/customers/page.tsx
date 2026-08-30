"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  Users,
  Send,
  Eye,
  Phone,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
} from "lucide-react";
import clsx from "clsx";
import { getStatusBadgeConfig } from "@/lib/installment-engine";
import { formatDisplayPhone } from "@/lib/excel/mapper";

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

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [recoveryPerson, setRecoveryPerson] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  // Quick Message Modal State
  const [selectedCust, setSelectedCust] = useState<any>(null);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "15",
        search,
        branch,
        status,
        recoveryPerson,
      });

      const res = await fetch(`/api/customers?${params.toString()}`);
      const data = await safeJsonParse(res);
      if (res.ok && data.customers) {
        setCustomers(data.customers);
        setPagination({
          total: data.total || 0,
          totalPages: data.totalPages || 1,
        });
      }
    } catch (err) {
      console.error("Failed to load customers", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [page, search, branch, status, recoveryPerson]);

  const handleOpenMessageModal = (cust: any) => {
    setSelectedCust(cust);
    const inst = cust.installments?.[0];
    const emi = inst?.emi || 0;
    const balance = inst?.balance || 0;
    const dueDate = inst?.dueDate ? new Date(inst.dueDate).toLocaleDateString() : "Due Date";

    // Standard QistBazar personalized Urdu reminder template
    setMessageText(
      `Mohtaram ${cust.customerName} Sahab, QistBazar se aapki qist Rs. ${emi.toLocaleString()} batan tareekh ${dueDate} wajib-ul-ada hai. Total baqaya balance Rs. ${balance.toLocaleString()} hai. Baraye meherbani qist ada farmayein. Shukriya.`
    );
    setSendResult(null);
  };

  const handleSendSingleMessage = async () => {
    if (!selectedCust || !messageText) return;
    try {
      setSendingMessage(true);
      setSendResult(null);

      const res = await fetch("/api/whatsapp/send-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCust.id,
          recipientPhone: selectedCust.primaryPhone,
          messageText,
        }),
      });

      const data = await safeJsonParse(res);
      if (res.ok && data.success) {
        setSendResult(data.message || (data.status === "SENT" ? "Message sent directly via WhatsApp!" : "Message dispatched to sending queue!"));
        setTimeout(() => {
          setSelectedCust(null);
          fetchCustomers();
        }, 1500);
      } else {
        setSendResult("Error: " + (data.error || "Failed to dispatch message"));
      }
    } catch (err: any) {
      setSendResult("Error: " + err.message);
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Users className="w-5 h-5 text-emerald-500" />
            <span>Customer Management & Ledgers</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Search, view loan status, inspect device IMEIs, and dispatch individual WhatsApp reminders.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchCustomers}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin text-emerald-500")} />
            <span>Refresh</span>
          </button>
          <Link
            href="/imports"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Import Report</span>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by Name, Phone, Account, CNIC, IMEI, Product..."
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>

        {/* Status Filter */}
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
        >
          <option value="ALL">All Statuses</option>
          <option value="DUE_TODAY">Due Today</option>
          <option value="OVERDUE">Overdue</option>
          <option value="UPCOMING">Upcoming</option>
          <option value="PAID">Paid</option>
          <option value="PARTIAL">Partial</option>
          <option value="UNKNOWN">Unknown</option>
        </select>

        {/* Branch Filter */}
        <select
          value={branch}
          onChange={(e) => {
            setBranch(e.target.value);
            setPage(1);
          }}
          className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
        >
          <option value="ALL">All Branches</option>
          <option value="QBLAN">QBLAN (Landhi)</option>
          <option value="QBKOR">QBKOR (Korangi)</option>
          <option value="QBNZN">QBNZN (North Nazimabad)</option>
          <option value="QBGUL">QBGUL (Gulshan)</option>
          <option value="MAIN">MAIN</option>
        </select>
      </div>

      {/* Customer Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-400 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Account</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Product / Brand</th>
                <th className="py-3 px-4">EMI & Balance</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Officer</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading customers...</span>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No customers found matching the search criteria.
                  </td>
                </tr>
              ) : (
                customers.map((cust) => {
                  const inst = cust.installments?.[0];
                  const badge = getStatusBadgeConfig(inst?.status || "UNKNOWN");
                  const dueStr = inst?.dueDate ? new Date(inst.dueDate).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }) : "N/A";

                  return (
                    <tr key={cust.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {cust.account}
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          href={`/customers/${cust.id}`}
                          className="font-semibold text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline"
                        >
                          {cust.customerName}
                        </Link>
                        {cust.cnic && (
                          <div className="text-[10px] text-slate-400">CNIC: {cust.cnic}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-700 dark:text-slate-300">
                          {formatDisplayPhone(cust.primaryPhone)}
                        </div>
                        {cust.branch && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                            {cust.branch}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 max-w-[180px] truncate" title={cust.productName || ""}>
                        <div className="truncate font-medium">{cust.productName || "—"}</div>
                        {cust.brand && <div className="text-[10px] text-slate-400">{cust.brand}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          Rs. {inst?.emi ? inst.emi.toLocaleString() : 0}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Bal: Rs. {inst?.balance ? inst.balance.toLocaleString() : 0}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
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
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {cust.recoveryPerson || "Unassigned"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openSendModal(cust)}
                            title="Send WhatsApp Reminder"
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                          <Link
                            href={`/customers/${cust.id}`}
                            title="View Customer Profile"
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                        </div>
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
            Showing {customers.length} of {pagination.total} customer accounts
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

      {/* 1-Click Send WhatsApp Modal */}
      {selectedCust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-500" />
                  <span>Send WhatsApp Reminder</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Recipient: {selectedCust.customerName} ({selectedCust.primaryPhone})
                </p>
              </div>
              <button
                onClick={() => setSelectedCust(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {sendResult && (
              <div
                className={clsx(
                  "p-3 rounded-xl text-xs font-semibold",
                  sendResult.startsWith("Error")
                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                )}
              >
                {sendResult}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Message Content
              </label>
              <textarea
                rows={6}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400">
                Anti-ban rate limiter will dispatch with safe delay.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCust(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={sendingMessage}
                  onClick={handleSendSingleMessage}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {sendingMessage ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Send Message</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
