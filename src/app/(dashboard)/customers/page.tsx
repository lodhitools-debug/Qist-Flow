"use client";

import { useEffect, useState, useMemo } from "react";
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
  UserCheck,
  CheckSquare,
  Square,
  Smartphone,
  Building,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Shield,
  X,
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

interface ColumnConfig {
  id: string;
  label: string;
  category: "Core" | "Financials" | "Hardware" | "Staff" | "Guarantors";
  defaultVisible: boolean;
}

const AVAILABLE_COLUMNS: ColumnConfig[] = [
  { id: "account", label: "Account No", category: "Core", defaultVisible: true },
  { id: "customerName", label: "Customer Name", category: "Core", defaultVisible: true },
  { id: "primaryPhone", label: "Contact Phone", category: "Core", defaultVisible: true },
  { id: "cnic", label: "CNIC", category: "Core", defaultVisible: true },
  { id: "product", label: "Product & Brand", category: "Hardware", defaultVisible: true },
  { id: "emiBalance", label: "EMI & Balance", category: "Financials", defaultVisible: true },
  { id: "dueDate", label: "Due Date", category: "Financials", defaultVisible: true },
  { id: "status", label: "Status Badge", category: "Financials", defaultVisible: true },
  { id: "assignedStaff", label: "Assigned Officer", category: "Staff", defaultVisible: true },
  { id: "branch", label: "Branch", category: "Core", defaultVisible: false },
  { id: "imei", label: "IMEI 1 & 2", category: "Hardware", defaultVisible: false },
  { id: "guarantors", label: "Guarantors", category: "Guarantors", defaultVisible: false },
  { id: "salesPerson", label: "Sales Person", category: "Staff", defaultVisible: false },
  { id: "comment", label: "Comments", category: "Staff", defaultVisible: false },
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [branch, setBranch] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [recoveryPerson, setRecoveryPerson] = useState("ALL");
  const [assignedToUserId, setAssignedToUserId] = useState("ALL");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  // Column Selector State
  const [columnModalOpen, setColumnModalOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    AVAILABLE_COLUMNS.forEach((c) => {
      initial[c.id] = c.defaultVisible;
    });
    return initial;
  });

  // Sorting State
  const [sortField, setSortField] = useState<string>("updatedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Bulk Selection & Assignment State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [staffOfficers, setStaffOfficers] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkOfficerId, setBulkOfficerId] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);

  // Quick Message Modal State
  const [selectedCust, setSelectedCust] = useState<any>(null);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Adjust page limit for screen width
  useEffect(() => {
    if (typeof window !== "undefined") {
      setLimit(window.innerWidth < 768 ? 25 : 50);
    }
  }, []);

  const fetchStaff = async () => {
    try {
      const [meRes, usersRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/users"),
      ]);
      const meData = await safeJsonParse(meRes);
      const usersData = await safeJsonParse(usersRes);

      if (meRes.ok && meData.user) setCurrentUser(meData.user);
      if (usersRes.ok && usersData.users) setStaffOfficers(usersData.users);
    } catch {}
  };

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search: debouncedSearch,
        branch,
        status,
        recoveryPerson,
        assignedToUserId,
      });

      const res = await fetch(`/api/customers?${params.toString()}`);
      const data = await safeJsonParse(res);
      if (res.ok && data.customers) {
        setCustomers(data.customers);
        setPagination({
          total: data.pagination?.total || 0,
          totalPages: data.pagination?.totalPages || 1,
        });
      }
    } catch (err) {
      console.error("Failed to load customers", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [page, limit, debouncedSearch, branch, status, recoveryPerson, assignedToUserId]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === customers.length && customers.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(customers.map((c) => c.id));
    }
  };

  const handleBulkAssign = async () => {
    if (selectedIds.length === 0 || !bulkOfficerId) return;

    try {
      setBulkAssigning(true);
      setBulkNotice(null);

      const res = await fetch("/api/customers/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerIds: selectedIds,
          targetOfficerId: bulkOfficerId,
          notes: `Bulk assignment by ${currentUser?.name || "User"}`,
        }),
      });

      const data = await safeJsonParse(res);
      if (res.ok && data.success) {
        setBulkNotice(data.message || `Successfully assigned ${selectedIds.length} customers!`);
        setSelectedIds([]);
        fetchCustomers();
        setTimeout(() => setBulkNotice(null), 4000);
      } else {
        alert("Bulk assignment failed: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setBulkAssigning(false);
    }
  };

  const handleOpenMessageModal = (cust: any) => {
    setSelectedCust(cust);
    const inst = cust.installments?.[0];
    const emi = inst?.emi || 0;
    const balance = inst?.balance || 0;
    const dueDate = inst?.dueDate ? new Date(inst.dueDate).toLocaleDateString("en-PK") : "Due Date";

    setMessageText(
      `Assalam-o-Alaikum ${cust.customerName},\n\nAap ki Rs. ${emi.toLocaleString()} qist ki due date ${dueDate} hai (Account: ${cust.account}).\nRemaining Balance: Rs. ${balance.toLocaleString()}.\n\nBarah-e-karam payment jald az jald clear karein.\nShukriya,\nQistBazar Recovery`
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
          phone: selectedCust.primaryPhone,
          message: messageText,
          customerId: selectedCust.id,
        }),
      });

      const data = await safeJsonParse(res);

      if (res.ok && data.success) {
        setSendResult(`✓ Message queued for fast delivery (${data.recipientPhone})`);
        setTimeout(() => {
          setSelectedCust(null);
          fetchCustomers();
        }, 1200);
      } else {
        setSendResult("Error: " + (data.error || "Failed to queue message"));
      }
    } catch (err: any) {
      setSendResult("Error: " + err.message);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedCustomers = useMemo(() => {
    if (!sortField) return customers;
    return [...customers].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      const aInst = a.installments?.[0];
      const bInst = b.installments?.[0];

      if (sortField === "emi") {
        aVal = aInst?.emi || 0;
        bVal = bInst?.emi || 0;
      } else if (sortField === "balance") {
        aVal = aInst?.balance || 0;
        bVal = bInst?.balance || 0;
      } else if (sortField === "dueDate") {
        aVal = aInst?.dueDate ? new Date(aInst.dueDate).getTime() : 0;
        bVal = bInst?.dueDate ? new Date(bInst.dueDate).getTime() : 0;
      } else if (sortField === "status") {
        aVal = aInst?.status || "";
        bVal = bInst?.status || "";
      } else if (sortField === "assignedStaff") {
        aVal = a.assignedTo?.name || "";
        bVal = b.assignedTo?.name || "";
      }

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = (bVal || "").toLowerCase();
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [customers, sortField, sortOrder]);

  const canAssign = currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER";

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-500" />
            <span>Customer Portfolio & Ledgers</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Search accounts, inspect balances, assign staff, and dispatch fast reminders.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Column Selector Button (Desktop Only) */}
          <button
            type="button"
            onClick={() => setColumnModalOpen(true)}
            className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 min-h-[44px]"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span>Columns</span>
          </button>

          <button
            onClick={fetchCustomers}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 min-h-[44px]"
          >
            <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin text-emerald-500")} />
            <span>Refresh</span>
          </button>

          <Link
            href="/imports"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm min-h-[44px]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Import Report</span>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center gap-2.5">
        {/* Search with debounce */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Name, Phone, Account, CNIC, IMEI..."
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 min-h-[42px]"
          />
        </div>

        {/* Status Filter */}
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300 focus:outline-none min-h-[42px]"
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
          className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300 focus:outline-none min-h-[42px]"
        >
          <option value="ALL">All Branches</option>
          <option value="MAIN">MAIN</option>
          <option value="QBLAN">QBLAN (Landhi)</option>
          <option value="QBKOR">QBKOR (Korangi)</option>
          <option value="QBNZN">QBNZN (North Nazimabad)</option>
          <option value="QBGUL">QBGUL (Gulshan)</option>
        </select>

        {/* Staff Officer Filter */}
        {staffOfficers.length > 0 && (
          <select
            value={assignedToUserId}
            onChange={(e) => {
              setAssignedToUserId(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300 focus:outline-none min-h-[42px]"
          >
            <option value="ALL">All Staff</option>
            {staffOfficers
              .filter((u) => u.role === "RECOVERY_OFFICER")
              .map((off) => (
                <option key={off.id} value={off.id}>
                  {off.name}
                </option>
              ))}
          </select>
        )}
      </div>

      {/* Bulk Assignment Floating Bar */}
      {canAssign && selectedIds.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-top-2 shadow-md">
          <div className="flex items-center gap-2 text-xs text-indigo-900 dark:text-indigo-200 font-bold">
            <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>{selectedIds.length} customer(s) selected</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={bulkOfficerId}
              onChange={(e) => setBulkOfficerId(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none min-h-[40px]"
            >
              <option value="">-- Select Recovery Officer --</option>
              {staffOfficers
                .filter((u) => {
                  if (currentUser?.role === "MANAGER") {
                    return u.role === "RECOVERY_OFFICER" && u.managerId === currentUser.id;
                  }
                  return u.role === "RECOVERY_OFFICER";
                })
                .map((off) => (
                  <option key={off.id} value={off.id}>
                    {off.name} ({off.employeeCode || off.branch || "Officer"})
                  </option>
                ))}
            </select>

            <button
              type="button"
              disabled={!bulkOfficerId || bulkAssigning}
              onClick={handleBulkAssign}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm disabled:opacity-50 transition-colors min-h-[40px]"
            >
              {bulkAssigning ? "Assigning..." : "Assign"}
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-xs text-slate-500 hover:underline px-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {bulkNotice && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{bulkNotice}</span>
        </div>
      )}

      {/* 1. Mobile Cards View (Visible on < md) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-3 animate-pulse">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                <div className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded" />
                <div className="h-8 bg-slate-100 dark:bg-slate-800/60 rounded" />
              </div>
            ))}
          </div>
        ) : sortedCustomers.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center text-slate-400 border border-slate-200 dark:border-slate-800 text-xs">
            No customers found matching search criteria.
          </div>
        ) : (
          sortedCustomers.map((cust) => {
            const inst = cust.installments?.[0];
            const badge = getStatusBadgeConfig(inst?.status || "UNKNOWN");
            const isSelected = selectedIds.includes(cust.id);
            const dueStr = inst?.dueDate
              ? new Date(inst.dueDate).toLocaleDateString("en-PK", {
                  day: "2-digit",
                  month: "short",
                })
              : "N/A";

            return (
              <div
                key={cust.id}
                className={clsx(
                  "bg-white dark:bg-slate-900 rounded-2xl border p-4 shadow-sm space-y-3 transition-all",
                  isSelected
                    ? "border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20"
                    : "border-slate-200 dark:border-slate-800"
                )}
              >
                {/* Top Row: Account, Badge, Select Checkbox */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {canAssign && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(cust.id)}
                        className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    )}
                    <div>
                      <Link
                        href={`/customers/${cust.id}`}
                        className="font-bold text-slate-900 dark:text-white text-sm hover:text-emerald-500 block"
                      >
                        {cust.customerName}
                      </Link>
                      <span className="text-[11px] text-slate-400 font-mono block">
                        Acc: {cust.account} • {cust.branch}
                      </span>
                    </div>
                  </div>

                  <span
                    className={clsx(
                      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0",
                      badge.color
                    )}
                  >
                    <span className={clsx("w-1.5 h-1.5 rounded-full", badge.dot)} />
                    <span>{badge.label}</span>
                  </span>
                </div>

                {/* Financial Summary Grid */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Monthly EMI</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      Rs. {(inst?.emi || 0).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Balance</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">
                      Rs. {(inst?.balance || 0).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Due Date</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {dueStr}
                    </span>
                  </div>
                </div>

                {/* Details & Assignment Info */}
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5 truncate">
                    <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="font-mono">{formatDisplayPhone(cust.primaryPhone)}</span>
                  </div>

                  <div className="text-[11px] truncate">
                    {cust.assignedTo?.name ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        👤 {cust.assignedTo.name}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Unassigned</span>
                    )}
                  </div>
                </div>

                {/* Action Buttons (Min 44px height for mobile touch target) */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleOpenMessageModal(cust)}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 min-h-[44px]"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>

                  <Link
                    href={`/customers/${cust.id}`}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 min-h-[44px]"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Details</span>
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 2. Desktop Table View (Visible on >= md) */}
      <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-400 font-semibold uppercase text-[10px]">
              <tr>
                {canAssign && (
                  <th className="py-3.5 px-3 w-8 text-center">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {selectedIds.length > 0 && selectedIds.length === customers.length ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                )}
                {visibleColumns.account && (
                  <th
                    onClick={() => handleSort("account")}
                    className="py-3.5 px-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>Account</span>
                      {sortField === "account" ? (
                        sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.customerName && (
                  <th
                    onClick={() => handleSort("customerName")}
                    className="py-3.5 px-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>Customer</span>
                      {sortField === "customerName" ? (
                        sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.primaryPhone && <th className="py-3.5 px-4">Contact Phone</th>}
                {visibleColumns.cnic && <th className="py-3.5 px-4">CNIC</th>}
                {visibleColumns.product && <th className="py-3.5 px-4">Product / Brand</th>}
                {visibleColumns.imei && <th className="py-3.5 px-4">IMEI 1 / 2</th>}
                {visibleColumns.emiBalance && (
                  <th
                    onClick={() => handleSort("emi")}
                    className="py-3.5 px-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>EMI & Balance</span>
                      {sortField === "emi" ? (
                        sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.dueDate && (
                  <th
                    onClick={() => handleSort("dueDate")}
                    className="py-3.5 px-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>Due Date</span>
                      {sortField === "dueDate" ? (
                        sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.status && (
                  <th
                    onClick={() => handleSort("status")}
                    className="py-3.5 px-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>Status</span>
                      {sortField === "status" ? (
                        sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.assignedStaff && (
                  <th
                    onClick={() => handleSort("assignedStaff")}
                    className="py-3.5 px-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>Assigned Staff</span>
                      {sortField === "assignedStaff" ? (
                        sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.branch && <th className="py-3.5 px-4">Branch</th>}
                {visibleColumns.guarantors && <th className="py-3.5 px-4">Guarantor</th>}
                {visibleColumns.salesPerson && <th className="py-3.5 px-4">Sales Person</th>}
                {visibleColumns.comment && <th className="py-3.5 px-4">Comment</th>}
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading customers...</span>
                  </td>
                </tr>
              ) : sortedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-400">
                    No customers found matching the search criteria.
                  </td>
                </tr>
              ) : (
                sortedCustomers.map((cust) => {
                  const inst = cust.installments?.[0];
                  const badge = getStatusBadgeConfig(inst?.status || "UNKNOWN");
                  const dueStr = inst?.dueDate
                    ? new Date(inst.dueDate).toLocaleDateString("en-PK", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "N/A";
                  const isSelected = selectedIds.includes(cust.id);

                  return (
                    <tr
                      key={cust.id}
                      className={clsx(
                        "hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors",
                        isSelected && "bg-indigo-50/40 dark:bg-indigo-950/20"
                      )}
                    >
                      {canAssign && (
                        <td className="py-3.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(cust.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                      )}
                      {visibleColumns.account && (
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          {cust.account}
                        </td>
                      )}
                      {visibleColumns.customerName && (
                        <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                          {cust.customerName}
                        </td>
                      )}
                      {visibleColumns.primaryPhone && (
                        <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                          {formatDisplayPhone(cust.primaryPhone)}
                        </td>
                      )}
                      {visibleColumns.cnic && (
                        <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                          {cust.cnic || "—"}
                        </td>
                      )}
                      {visibleColumns.product && (
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                          {cust.productName || "Product"}
                          {cust.brand && <span className="block text-[10px] text-slate-400">{cust.brand}</span>}
                        </td>
                      )}
                      {visibleColumns.imei && (
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                          {cust.imei1 || "—"}
                        </td>
                      )}
                      {visibleColumns.emiBalance && (
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 dark:text-white">
                            Rs. {(inst?.emi || 0).toLocaleString()}
                          </span>
                          <span className="block text-[10px] text-rose-500 font-medium">
                            Bal: Rs. {(inst?.balance || 0).toLocaleString()}
                          </span>
                        </td>
                      )}
                      {visibleColumns.dueDate && (
                        <td className="py-3.5 px-4 font-medium text-slate-600 dark:text-slate-300">
                          {dueStr}
                        </td>
                      )}
                      {visibleColumns.status && (
                        <td className="py-3.5 px-4">
                          <span
                            className={clsx(
                              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                              badge.color
                            )}
                          >
                            <span className={clsx("w-1.5 h-1.5 rounded-full", badge.dot)} />
                            <span>{badge.label}</span>
                          </span>
                        </td>
                      )}
                      {visibleColumns.assignedStaff && (
                        <td className="py-3.5 px-4">
                          {cust.assignedTo?.name ? (
                            <div>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 block text-[11px]">
                                {cust.assignedTo.name}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {cust.assignedTo.employeeCode || "Officer"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.branch && (
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                          {cust.branch || "MAIN"}
                        </td>
                      )}
                      {visibleColumns.guarantors && (
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 text-[11px]">
                          {cust.guarantor1Name || "—"}
                        </td>
                      )}
                      {visibleColumns.salesPerson && (
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 text-[11px]">
                          {cust.salesPerson || "—"}
                        </td>
                      )}
                      {visibleColumns.comment && (
                        <td className="py-3.5 px-4 text-slate-500 text-[11px] max-w-[150px] truncate" title={cust.comment}>
                          {cust.comment || "—"}
                        </td>
                      )}
                      <td className="py-3.5 px-4 text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenMessageModal(cust)}
                          title="Quick Send WhatsApp"
                          className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                        <Link
                          href={`/customers/${cust.id}`}
                          title="View 360 Customer Ledger"
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 inline-block transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 pt-2">
        <div>
          Showing <strong>{pagination.total === 0 ? 0 : (page - 1) * limit + 1}</strong> to{" "}
          <strong>{Math.min(page * limit, pagination.total)}</strong> of{" "}
          <strong>{pagination.total}</strong> customers
        </div>

        <div className="flex items-center gap-1.5">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-50 min-h-[40px]"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Prev</span>
          </button>

          <span className="px-3 py-2 font-bold text-slate-900 dark:text-white">
            Page {page} of {pagination.totalPages}
          </span>

          <button
            disabled={page >= pagination.totalPages}
            onClick={() => setPage(page + 1)}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-50 min-h-[40px]"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Column Selector Modal */}
      {columnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Customize Desktop Columns
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setColumnModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select which fields to display in the desktop ledger table:
            </p>

            <div className="grid grid-cols-2 gap-2.5 max-h-60 overflow-y-auto p-1 text-xs">
              {AVAILABLE_COLUMNS.map((col) => (
                <label
                  key={col.id}
                  className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 cursor-pointer hover:bg-slate-100"
                >
                  <input
                    type="checkbox"
                    checked={!!visibleColumns[col.id]}
                    onChange={(e) =>
                      setVisibleColumns((prev) => ({
                        ...prev,
                        [col.id]: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-800 dark:text-slate-200 font-medium">
                    {col.label}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const reset: Record<string, boolean> = {};
                  AVAILABLE_COLUMNS.forEach((c) => (reset[c.id] = c.defaultVisible));
                  setVisibleColumns(reset);
                }}
                className="text-xs text-slate-500 hover:underline"
              >
                Reset to Default
              </button>

              <button
                type="button"
                onClick={() => setColumnModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow min-h-[40px]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fast WhatsApp Message Modal */}
      {selectedCust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Fast WhatsApp Reminder
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Recipient: <strong className="font-mono text-emerald-500">{selectedCust.primaryPhone}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCust(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Personalized Urdu Message
              </label>
              <textarea
                rows={5}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>

            {sendResult && (
              <div
                className={clsx(
                  "p-3 rounded-xl text-xs font-semibold flex items-center gap-2",
                  sendResult.startsWith("Error")
                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                )}
              >
                {sendResult.startsWith("Error") ? (
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                )}
                <span>{sendResult}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedCust(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sendingMessage || !messageText}
                onClick={handleSendSingleMessage}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-1.5 min-h-[44px]"
              >
                {sendingMessage ? "Queuing..." : "Dispatch Message"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
