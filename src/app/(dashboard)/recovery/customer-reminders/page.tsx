"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Send,
  Users,
  CheckSquare,
  Square,
  Eye,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  Copy,
} from "lucide-react";
import clsx from "clsx";
import { formatDisplayPhone } from "@/lib/excel/mapper";

export const dynamic = "force-dynamic";

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

function CustomerReminderWizardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialFilter = searchParams.get("filter") || "OVERDUE_1M";

  // Step Control (1: Select Customers, 2: Choose Template & Preview, 3: Confirmation / Dispatched)
  const [step, setStep] = useState<number>(1);

  const [filterType, setFilterType] = useState(initialFilter);
  const [branch, setBranch] = useState("ALL");
  const activeTab: string = "CUSTOMER";
  const [targets, setTargets] = useState<any[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(true);

  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Templates
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [resultSummary, setResultSummary] = useState<any>(null);

  // Fetch Templates
  useEffect(() => {
    fetch("/api/templates")
      .then((res) => safeJsonParse(res))
      .then((data) => {
        setTemplates((data.templates || []).filter((t: any) => t.type !== "GUARANTOR_FIRST_NOTICE" && t.type !== "GUARANTOR_ESCALATION"));
        if (data.templates && data.templates.length > 0) {
          // pick default based on filter
          setSelectedTemplateId(data.templates[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch Targets
  const fetchTargets = async () => {
    try {
      setLoadingTargets(true);
      const params = new URLSearchParams({
        filterType,
        branch,
        templateId: selectedTemplateId,
        recipientType: activeTab,
      });

      const res = await fetch(`/api/recovery/targets?${params.toString()}`);
      const data = await safeJsonParse(res);
      if (res.ok && data.targets) {
        const list = data.targets || [];
        setTargets(list);
        // Default select all
        setSelectedIds(new Set(list.map((t: any) => t.customerId)));
      }
    } catch (err) {
      console.error("Failed to load targets", err);
    } finally {
      setLoadingTargets(false);
    }
  };

  useEffect(() => {
    fetchTargets();
  }, [filterType, branch, selectedTemplateId, activeTab]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === targets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(targets.map((t) => t.customerId)));
    }
  };

  const selectedList = targets.filter((t) => selectedIds.has(t.customerId));

  const handleQueueBatch = async () => {
    if (selectedList.length === 0) return;
    try {
      setSubmitting(true);

      const items: any[] = [];
      selectedList.forEach((t) => {
        const baseItem = {
          customerId: t.customerId,
          installmentId: t.installmentId,
          dueDate: t.dueDate,
          daysOverdue: t.daysOverdue,
          templateId: selectedTemplateId,
          messageText: t.messageText || t.previewMessage,
        };

        if (activeTab === "CUSTOMER") {
          items.push({
            ...baseItem,
            recipientPhone: t.primaryPhone,
            recipientName: t.customerName,
            recipientType: "CUSTOMER"
          });
        }
        
        if (activeTab === "GUARANTOR_1" && t.guarantor1Phone) {
          items.push({
            ...baseItem,
            recipientPhone: t.guarantor1Phone,
            recipientName: t.guarantor1Name || "Guarantor",
            recipientType: "GUARANTOR_1"
          });
        }
      });

      if (items.length === 0) {
        alert("No valid phone numbers found for the selected recipient type.");
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/recovery/bulk-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          batchLabel: `Bulk ${filterType} Campaign (${activeTab})`,
        }),
      });

      const data = await safeJsonParse(res);
      if (res.ok && data.success) {
        setResultSummary(data.result);
        setStep(3);
      } else {
        alert("Failed to queue reminders: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Wizard Progress Header */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Send className="w-5 h-5 text-emerald-500" />
            <span>Customer Reminder Campaign</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Filter target accounts, inspect personalized Urdu preview messages, and schedule to WhatsApp queue safely.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <div
            className={clsx(
              "px-3 py-1.5 rounded-lg border",
              step === 1
                ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 font-bold"
                : "bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700"
            )}
          >
            1. Select Customers ({selectedIds.size})
          </div>
          <span>→</span>
          <div
            className={clsx(
              "px-3 py-1.5 rounded-lg border",
              step === 2
                ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 font-bold"
                : "bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700"
            )}
          >
            2. Preview & Template
          </div>
        </div>
      </div>

      {/* STEP 1: Select Target Customers */}
      {step === 1 && (
        <div className="space-y-4 animate-in fade-in">
          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 font-semibold"
              >
                <option value="OVERDUE_1M">1 Month Overdue</option>
                <option value="OVERDUE_2M">2 Months Overdue</option>
                <option value="OVERDUE_3M">3 Months Overdue</option>
                <option value="OVERDUE_4M_PLUS">4+ Months Overdue</option>
                <option value="ALL_OVERDUE">All Overdue Accounts</option>
                <option value="UPCOMING">Upcoming / Not Yet Due</option>
              </select>

              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300"
              >
                <option value="ALL">All Branches</option>
                <option value="QBLAN">QBLAN (Landhi)</option>
                <option value="QBKOR">QBKOR (Korangi)</option>
                <option value="QBNZN">QBNZN</option>
                <option value="MAIN">MAIN</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="text-emerald-600 font-black">{selectedIds.size}</span> customers selected
              </span>

              <button
                disabled={selectedIds.size === 0}
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-all"
              >
                <span>Preview Messages</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Target Selection Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-400 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">
                      <button onClick={selectAll} title="Select All">
                        {selectedIds.size === targets.length && targets.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4">Account</th>
                    <th className="py-3 px-4">{activeTab === "CUSTOMER" ? "Customer" : "Guarantor"} Name</th>
                    <th className="py-3 px-4">{activeTab === "CUSTOMER" ? "Customer" : "Guarantor"} Phone</th>
                    <th className="py-3 px-4">Branch</th>
                    <th className="py-3 px-4">EMI Amount</th>
                    <th className="py-3 px-4">Balance</th>
                    <th className="py-3 px-4">Days Overdue</th>
                    <th className="py-3 px-4">Officer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {loadingTargets ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <span>Querying eligible targets...</span>
                      </td>
                    </tr>
                  ) : targets.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        No eligible customers found for this filter criteria.
                      </td>
                    </tr>
                  ) : (
                    targets.map((t) => {
                      const isSelected = selectedIds.has(t.customerId);
                      return (
                        <tr
                          key={t.installmentId}
                          onClick={() => toggleSelect(t.customerId)}
                          className={clsx(
                            "cursor-pointer transition-colors",
                            isSelected
                              ? "bg-emerald-50/50 dark:bg-emerald-950/20"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                          )}
                        >
                          <td className="py-3 px-4 text-center">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-emerald-500 mx-auto" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 mx-auto" />
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            {t.account}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                            {activeTab === "CUSTOMER" ? t.customerName : t.guarantor1Name || "N/A"}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                            {formatDisplayPhone(activeTab === "CUSTOMER" ? t.primaryPhone : t.guarantor1Phone)}
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
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Preview & Template Selection */}
      {step === 2 && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Template Configuration
                </h3>
                <p className="text-xs text-slate-400">
                  Select reminder template to apply across all {selectedList.length} selected customers.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-200"
                >
                  {templates.map((tmpl) => (
                    <option key={tmpl.id} value={tmpl.id}>
                      {tmpl.name} ({tmpl.language})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Anti-ban Throttling Disclaimer */}
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 flex-shrink-0 text-emerald-600" />
              <div>
                <span className="font-bold">Anti-Ban Protection Active:</span> Messages will be enqueued and sent with randomized 6s–14s delays to ensure your WhatsApp number remains safe and compliant.
              </div>
            </div>
          </div>

          {/* Live Preview List of Selected Customers */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Personalized Message Previews ({selectedList.length})
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedList.slice(0, 8).map((cust) => (
                <div
                  key={cust.customerId}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 text-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {cust.customerName}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        Acc: {cust.account}
                      </span>
                    </div>
                    
                    {activeTab === "CUSTOMER" && (
                      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-2 rounded text-xs mb-1">
                        <span className="text-slate-500">Customer:</span>
                        <span className="font-mono font-bold">{formatDisplayPhone(cust.primaryPhone)}</span>
                      </div>
                    )}

                    {activeTab === "GUARANTOR_1" && (
                      <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 p-2 rounded text-xs">
                        <span className="text-amber-700 dark:text-amber-500">Guarantor ({cust.guarantor1Name || 'N/A'}):</span>
                        <span className="font-mono font-bold text-amber-700 dark:text-amber-500">
                          {cust.guarantor1Phone ? formatDisplayPhone(cust.guarantor1Phone) : "No Phone"}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="relative group">
                    <p className="text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-line bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg mt-2 min-h-[80px]">
                      {cust.messageText}
                    </p>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(cust.messageText)}
                      className="absolute top-2 right-2 p-1.5 rounded-md bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity shadow border border-slate-200 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/50"
                      title="Copy Message"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {selectedList.length > 8 && (
              <div className="p-3 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                + {selectedList.length - 8} more personalized customer messages will be queued.
              </div>
            )}
          </div>

          {/* Bottom Action Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Selection</span>
            </button>

            <button
              type="button"
              disabled={submitting || selectedList.length === 0}
              onClick={handleQueueBatch}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all hover:scale-105"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>Confirm & Add {selectedList.length} Messages to WhatsApp Queue</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Dispatch Confirmation */}
      {step === 3 && (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-4 max-w-lg mx-auto animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Messages Successfully Queued!
          </h2>

          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {resultSummary?.enqueued || selectedList.length} reminder messages have been placed into the WhatsApp sending queue with duplicate protection.
          </p>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-xs text-left space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Requested:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{resultSummary?.total || selectedList.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Enqueued into Worker:</span>
              <span className="font-bold text-emerald-600">{resultSummary?.enqueued || selectedList.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Duplicate Reminders Skipped:</span>
              <span className="font-bold text-slate-500">{resultSummary?.duplicates || 0}</span>
            </div>
          </div>

          <div className="pt-2 flex justify-center gap-3">
            <Link
              href="/whatsapp/message-history"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20"
            >
              Monitor Sending Queue
            </Link>
            <button
              onClick={() => {
                setStep(1);
                fetchTargets();
              }}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50"
            >
              Send Another Batch
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CustomerReminderWizardPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span>Loading Bulk Reminder Wizard...</span>
        </div>
      }
    >
      <CustomerReminderWizardContent />
    </Suspense>
  );
}
