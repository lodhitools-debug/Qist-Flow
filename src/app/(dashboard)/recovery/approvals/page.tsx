"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Edit3,
  RefreshCw,
  Send,
  AlertTriangle,
  Users,
  Check,
  X,
  Phone,
  UserCheck,
} from "lucide-react";
import clsx from "clsx";

export default function EscalationApprovalsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Edit modal
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editedText, setEditedText] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/recovery/escalation-approvals?status=PENDING_APPROVAL");
      if (res.ok) {
        const data = await res.json();
        setItems(data.data || []);
      }
    } catch (err) {
      console.error("Failed to load approvals", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const handleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((i) => i.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkAction = async (action: "APPROVE" | "REJECT") => {
    if (selectedIds.length === 0) return;
    const confirmText =
      action === "APPROVE"
        ? `Are you sure you want to approve ${selectedIds.length} guarantor escalation messages?`
        : `Are you sure you want to reject and cancel ${selectedIds.length} escalation messages?`;

    if (!confirm(confirmText)) return;

    try {
      setActionLoading(true);
      setNotice(null);
      const res = await fetch("/api/recovery/escalation-approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, queueIds: selectedIds }),
      });

      const data = await res.json();
      if (res.ok) {
        setNotice(data.message || `Successfully processed ${action.toLowerCase()} action`);
        setSelectedIds([]);
        fetchPendingApprovals();
      } else {
        alert(data.error || "Action failed");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSingleAction = async (id: string, action: "APPROVE" | "REJECT") => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/recovery/escalation-approvals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (res.ok) {
        setNotice(data.message || "Updated successfully");
        fetchPendingApprovals();
      } else {
        alert(data.error || "Action failed");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setEditedText(item.messageText);
  };

  const handleSaveAndApprove = async () => {
    if (!editingItem) return;
    try {
      setEditLoading(true);
      const res = await fetch(`/api/recovery/escalation-approvals/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "APPROVE",
          editedMessageText: editedText,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setNotice("Message edited and approved for WhatsApp dispatch!");
        setEditingItem(null);
        fetchPendingApprovals();
      } else {
        alert(data.error || "Failed to update");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">
            <UserCheck className="w-4 h-4" />
            <span>Manager Oversight Queue</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Guarantor Escalation Approvals ({items.length})
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Review, edit, and approve controlled WhatsApp recovery notices before they are queued to AlwaysData.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchPendingApprovals}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-semibold min-h-[40px]"
          >
            <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin text-purple-600")} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4" />
          <span>{notice}</span>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-purple-900 text-white p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-lg animate-in fade-in">
          <div className="text-xs font-bold">
            {selectedIds.length} escalation message(s) selected
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={actionLoading}
              onClick={() => handleBulkAction("APPROVE")}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-sm disabled:opacity-50 min-h-[36px]"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approve Selected</span>
            </button>

            <button
              disabled={actionLoading}
              onClick={() => handleBulkAction("REJECT")}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-sm disabled:opacity-50 min-h-[36px]"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reject Selected</span>
            </button>
          </div>
        </div>
      )}

      {/* List Table / Cards */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 bg-white dark:bg-slate-900 rounded-2xl animate-pulse border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
          <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
            No Pending Guarantor Escalations
          </div>
          <p className="text-xs max-w-sm mx-auto text-slate-500">
            All guarantor recovery notices have been reviewed or auto-approved according to current policy.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 px-2">
            <label className="flex items-center gap-2 cursor-pointer font-semibold">
              <input
                type="checkbox"
                checked={selectedIds.length === items.length && items.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
              />
              <span>Select All Pending</span>
            </label>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            {items.map((item) => {
              const installment = item.customer?.installments?.[0];
              const isSelected = selectedIds.includes(item.id);

              return (
                <div
                  key={item.id}
                  className={clsx(
                    "p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors",
                    isSelected && "bg-purple-50/50 dark:bg-purple-950/20"
                  )}
                >
                  <div className="flex items-start gap-3.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(item.id)}
                      className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 mt-1"
                    />

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {item.customer?.customerName}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          Acc: {item.customer?.account}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200">
                          {item.messageType?.replace(/_/g, " ")} (Level {item.escalationLevel})
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <div>
                          Guarantor: <span className="font-bold text-slate-800 dark:text-slate-200">{item.recipientName}</span> ({item.recipientType})
                        </div>
                        <div className="font-mono text-slate-500">
                          Phone: {item.recipientPhone}
                        </div>
                        <div className="text-rose-600 font-bold">
                          Balance: Rs. {installment?.balance?.toLocaleString() || 0}
                        </div>
                      </div>

                      {item.escalationReason && (
                        <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-900/50 inline-block mt-1">
                          Reason: {item.escalationReason}
                        </div>
                      )}

                      <div className="pt-2">
                        <div className="text-[11px] font-semibold text-slate-400">Proposed Message:</div>
                        <div className="text-xs bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap mt-0.5 max-w-2xl border border-slate-100 dark:border-slate-700">
                          {item.messageText}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      onClick={() => openEditModal(item)}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center gap-1 min-h-[38px]"
                      title="Edit Message"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      disabled={actionLoading}
                      onClick={() => handleSingleAction(item.id, "APPROVE")}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 min-h-[38px]"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>

                    <button
                      disabled={actionLoading}
                      onClick={() => handleSingleAction(item.id, "REJECT")}
                      className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold border border-rose-200 min-h-[38px]"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Edit Guarantor Escalation Message
                </h3>
                <p className="text-xs text-slate-400">
                  Recipient: {editingItem.recipientName} ({editingItem.recipientPhone})
                </p>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              rows={6}
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
            />

            <div className="text-[11px] text-slate-400">
              Note: Editing will overwrite the message text and immediately approve it for dispatch.
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 min-h-[38px]"
              >
                Cancel
              </button>
              <button
                disabled={editLoading}
                onClick={handleSaveAndApprove}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-500/20 disabled:opacity-50 min-h-[38px]"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{editLoading ? "Saving..." : "Save & Approve"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
