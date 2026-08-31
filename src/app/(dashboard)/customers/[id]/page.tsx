"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  Phone,
  CreditCard,
  Smartphone,
  ShieldCheck,
  Send,
  PlusCircle,
  ArrowLeft,
  Calendar,
  DollarSign,
  History,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Edit,
  Save,
  Trash2,
  UserCheck,
  Users,
  ShieldAlert,
  HelpCircle,
} from "lucide-react";
import clsx from "clsx";
import { getStatusBadgeConfig } from "@/lib/installment-engine";
import { formatDisplayPhone, formatPhoneNumber } from "@/lib/excel/mapper";

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

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  // Form edit states
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [recoveryPerson, setRecoveryPerson] = useState("");
  const [comment, setComment] = useState("");
  const [optedOut, setOptedOut] = useState(false);

  // Customer Message modal state
  const [msgOpen, setMsgOpen] = useState(false);
  const [customMsg, setCustomMsg] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [msgNotice, setMsgNotice] = useState<string | null>(null);

  // Guarantor Message modal state
  const [guarantorModalOpen, setGuarantorModalOpen] = useState(false);
  const [selectedGuarantor, setSelectedGuarantor] = useState<"GUARANTOR_1" | "GUARANTOR_2">("GUARANTOR_1");
  const [guarantorMessageType, setGuarantorMessageType] = useState<"GUARANTOR_FIRST_NOTICE" | "GUARANTOR_FOLLOWUP" | "GUARANTOR_FINAL_NOTICE">("GUARANTOR_FIRST_NOTICE");
  const [guarantorCustomMsg, setGuarantorCustomMsg] = useState("");
  const [sendingGuarantorMsg, setSendingGuarantorMsg] = useState(false);
  const [guarantorMsgNotice, setGuarantorMsgNotice] = useState<string | null>(null);

  // History Tab
  const [historyTab, setHistoryTab] = useState<"CUSTOMER" | "GUARANTOR">("CUSTOMER");

  // Payment modal state
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [recordingPay, setRecordingPay] = useState(false);

  // Status Override State
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("PAID");
  const [overrideReason, setOverrideReason] = useState("");

  // Staff Assignment State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState("");
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const fetchStaffUsers = async () => {
    try {
      const [meRes, usersRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/users"),
      ]);
      const meData = await safeJsonParse(meRes);
      const usersData = await safeJsonParse(usersRes);

      if (meRes.ok && meData.user) setCurrentUser(meData.user);
      if (usersRes.ok && usersData.users) setStaffUsers(usersData.users);
    } catch {}
  };

  const fetchCustomer = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/customers/${customerId}`);
      const data = await safeJsonParse(res);
      if (res.ok && data.customer) {
        setCustomer(data.customer);
        setPhone(data.customer.primaryPhone);
        setAddress(data.customer.address || "");
        setRecoveryPerson(data.customer.recoveryPerson || "");
        setComment(data.customer.comment || "");
        setOptedOut(data.customer.optedOut || false);
        setSelectedOfficerId(data.customer.assignedToUserId || "");
        setSelectedManagerId(data.customer.assignedManagerId || "");
      }
    } catch (err) {
      console.error("Failed to load customer details", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) {
      fetchCustomer();
      fetchStaffUsers();
    }
  }, [customerId]);

  const handleSaveAssignment = async () => {
    try {
      setAssigning(true);
      setAssignError(null);

      const res = await fetch("/api/customers/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          targetOfficerId: selectedOfficerId || undefined,
          targetManagerId: selectedManagerId || undefined,
          notes: assignNotes || undefined,
        }),
      });

      const data = await safeJsonParse(res);
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to assign customer");
      }

      setAssignOpen(false);
      setAssignNotes("");
      fetchCustomer();
    } catch (err: any) {
      setAssignError(err.message || "Assignment failed");
    } finally {
      setAssigning(false);
    }
  };

  const handleUpdateCustomer = async () => {
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryPhone: phone,
          address,
          recoveryPerson,
          comment,
          optedOut,
        }),
      });

      if (res.ok) {
        setEditMode(false);
        fetchCustomer();
      }
    } catch (err) {
      console.error("Failed to update customer", err);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!customMsg) return;
    try {
      setSendingMsg(true);
      setMsgNotice(null);

      const res = await fetch("/api/whatsapp/send-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          recipientPhone: customer.primaryPhone,
          recipientName: customer.customerName,
          recipientType: "CUSTOMER",
          messageText: customMsg,
          installmentId: customer.installments?.[0]?.id,
        }),
      });

      const data = await safeJsonParse(res);
      if (res.ok && data.success) {
        setMsgNotice(data.message || (data.status === "SENT" ? "Message dispatched successfully!" : "Message added to queue!"));
        setTimeout(() => {
          setMsgOpen(false);
          fetchCustomer();
        }, 1500);
      } else {
        setMsgNotice("Error: " + (data.error || "Failed to send message"));
      }
    } catch (err: any) {
      setMsgNotice("Error: " + err.message);
    } finally {
      setSendingMsg(false);
    }
  };

  const openGuarantorModal = (type: "GUARANTOR_1" | "GUARANTOR_2") => {
    setSelectedGuarantor(type);
    setGuarantorMessageType("GUARANTOR_FIRST_NOTICE");
    const gName = type === "GUARANTOR_1" ? customer.guarantor1Name || "Guarantor Sahab" : customer.guarantor2Name || "Guarantor Sahab";
    const inst = customer.installments?.[0];
    const dueStr = inst?.dueDate ? new Date(inst.dueDate).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }) : "N/A";

    const defaultFirstNotice = `Assalam-o-Alaikum ${gName},\n\nYeh paigham aap ko bataur Zamanat-daar (Guarantor) bhaija ja raha hai.\n\nCustomer: ${customer.customerName}\nAccount: ${customer.account}\nPending Amount: Rs. ${inst?.balance || 0}\nDue Date: ${dueStr}\n\nBarah-e-karam customer se rabta kar ke unhein un ki pending qist ada karne ki yad-dihani karwayein.\n\nShukriya,\n${customer.recoveryPerson || "QistFlow Recovery Team"}`;
    setGuarantorCustomMsg(defaultFirstNotice);
    setGuarantorMsgNotice(null);
    setGuarantorModalOpen(true);
  };

  const handleGuarantorTypeChange = (type: "GUARANTOR_FIRST_NOTICE" | "GUARANTOR_FOLLOWUP" | "GUARANTOR_FINAL_NOTICE") => {
    setGuarantorMessageType(type);
    const gName = selectedGuarantor === "GUARANTOR_1" ? customer.guarantor1Name || "Guarantor Sahab" : customer.guarantor2Name || "Guarantor Sahab";
    const inst = customer.installments?.[0];
    const dueStr = inst?.dueDate ? new Date(inst.dueDate).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }) : "N/A";

    let text = "";
    if (type === "GUARANTOR_FIRST_NOTICE") {
      text = `Assalam-o-Alaikum ${gName},\n\nYeh paigham aap ko bataur Zamanat-daar (Guarantor) bhaija ja raha hai.\n\nCustomer: ${customer.customerName}\nAccount: ${customer.account}\nPending Amount: Rs. ${inst?.balance || 0}\nDue Date: ${dueStr}\n\nBarah-e-karam customer se rabta kar ke unhein un ki pending qist ada karne ki yad-dihani karwayein.\n\nShukriya,\n${customer.recoveryPerson || "QistFlow Recovery Team"}`;
    } else if (type === "GUARANTOR_FOLLOWUP") {
      text = `Yad-dihani Paigham - Zamanat\n\nAssalam-o-Alaikum ${gName},\n\n${customer.customerName} ke account (${customer.account}) ki installment unpaid hai.\n\nAap is account ke guarantor hain. Barah-e-karam fori tor par customer se baat kar ke payment schedule confirm karwayein.\n\nPending Balance: Rs. ${inst?.balance || 0}\nRecovery Officer: ${customer.recoveryPerson || "QistFlow Team"}`;
    } else {
      text = `IMPORTANT NOTICE - GUARANTOR OBLIGATION\n\nMuazzaz ${gName},\n\n${customer.customerName} (Account: ${customer.account}) ka account overdue chal raha hai aur mutaddad koshishon ke bawajood payment masool nahi hui.\n\nBataur Guarantor aap ki zimadari hai ke customer se rabta kar ke mamla fori hal karwayein.\n\nTotal Balance: Rs. ${inst?.balance || 0}\nRecovery Contact: ${customer.recoveryPerson || "Recovery Department"}`;
    }
    setGuarantorCustomMsg(text);
  };

  const handleSendGuarantorWhatsApp = async () => {
    if (!guarantorCustomMsg) return;
    const phone = selectedGuarantor === "GUARANTOR_1" ? customer.guarantor1Phone : customer.guarantor2Phone;
    const name = selectedGuarantor === "GUARANTOR_1" ? customer.guarantor1Name : customer.guarantor2Name;

    if (!phone) {
      setGuarantorMsgNotice("Error: Guarantor phone number is missing");
      return;
    }

    try {
      setSendingGuarantorMsg(true);
      setGuarantorMsgNotice(null);

      const level = guarantorMessageType === "GUARANTOR_FINAL_NOTICE" ? 3 : guarantorMessageType === "GUARANTOR_FOLLOWUP" ? 2 : 1;

      const res = await fetch("/api/whatsapp/send-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          recipientPhone: phone,
          recipientName: name,
          recipientType: selectedGuarantor,
          guarantorId: selectedGuarantor,
          messageType: guarantorMessageType,
          escalationLevel: level,
          messageText: guarantorCustomMsg,
          installmentId: customer.installments?.[0]?.id,
        }),
      });

      const data = await safeJsonParse(res);
      if (res.ok && data.success) {
        setGuarantorMsgNotice(data.message || "Guarantor notice dispatched successfully!");
        setTimeout(() => {
          setGuarantorModalOpen(false);
          fetchCustomer();
        }, 1500);
      } else {
        setGuarantorMsgNotice("Error: " + (data.error || "Failed to send guarantor notice"));
      }
    } catch (err: any) {
      setGuarantorMsgNotice("Error: " + err.message);
    } finally {
      setSendingGuarantorMsg(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) return;
    try {
      setRecordingPay(true);
      const res = await fetch("/api/installments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record-payment",
          customerId,
          installmentId: customer.installments?.[0]?.id,
          amount: parseFloat(payAmount),
          paymentMethod: payMethod,
        }),
      });

      if (res.ok) {
        setPayOpen(false);
        setPayAmount("");
        fetchCustomer();
      }
    } catch (err) {
      console.error("Failed to record payment", err);
    } finally {
      setRecordingPay(false);
    }
  };

  const handleOverrideStatus = async () => {
    try {
      const inst = customer.installments?.[0];
      if (!inst) return;

      const res = await fetch("/api/installments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "override-status",
          installmentId: inst.id,
          overrideStatus: newStatus,
          overrideReason,
        }),
      });

      if (res.ok) {
        setOverrideOpen(false);
        fetchCustomer();
      }
    } catch (err) {
      console.error("Failed to override status", err);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <span>Loading customer 360 profile...</span>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="py-24 text-center text-slate-400">
        <p>Customer record not found.</p>
        <Link href="/customers" className="text-emerald-500 text-xs font-semibold mt-2 inline-block">
          ← Back to Customers
        </Link>
      </div>
    );
  }

  const inst = customer.installments?.[0];
  const badge = getStatusBadgeConfig(inst?.status || "UNKNOWN");
  const dueStr = inst?.dueDate ? new Date(inst.dueDate).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }) : "N/A";
  const lastPaidDateStr = inst?.lastPaymentDate ? new Date(inst.lastPaymentDate).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  // Filter messages
  const customerLogs = (customer.messageLogs || []).filter((l: any) => !l.recipientType || l.recipientType === "CUSTOMER");
  const guarantorLogs = (customer.messageLogs || []).filter((l: any) => ["GUARANTOR_1", "GUARANTOR_2"].includes(l.recipientType));
  const pendingGuarantorQueues = (customer.messageQueues || []).filter((q: any) => ["GUARANTOR_1", "GUARANTOR_2"].includes(q.recipientType) && q.status === "QUEUED");

  const g1PhoneValid = customer.guarantor1Phone ? formatPhoneNumber(customer.guarantor1Phone).isValid : false;
  const g2PhoneValid = customer.guarantor2Phone ? formatPhoneNumber(customer.guarantor2Phone).isValid : false;

  const g1MessageCount = (customer.messageLogs || []).filter((l: any) => l.recipientType === "GUARANTOR_1").length;
  const g2MessageCount = (customer.messageLogs || []).filter((l: any) => l.recipientType === "GUARANTOR_2").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/customers"
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {customer.customerName}
              </h1>
              <span
                className={clsx(
                  "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border",
                  badge.color
                )}
              >
                <span className={clsx("w-1.5 h-1.5 rounded-full", badge.dot)} />
                <span>{badge.label}</span>
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">
              Account No: <span className="font-bold text-slate-700 dark:text-slate-200">{customer.account}</span> • Web Ref: {customer.webNo || "N/A"} • Branch: {customer.branch}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            onClick={() => {
              setCustomMsg(
                `Assalam-o-Alaikum ${customer.customerName},\n\nAap ki Rs. ${inst?.emi || 0} qist ki due date ${dueStr} hai (Account: ${customer.account}).\nRemaining Balance: Rs. ${inst?.balance || 0}.\n\nBarah-e-karam waqt par payment clear karein.\nShukriya,\nQistBazar Recovery`
              );
              setMsgOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-500/20 min-h-[44px]"
          >
            <Send className="w-4 h-4" />
            <span>Send WhatsApp</span>
          </button>

          <button
            onClick={() => setPayOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 text-white text-xs font-bold border border-slate-700 transition-colors min-h-[44px]"
          >
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>Record Payment</span>
          </button>

          <button
            onClick={() => setOverrideOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 min-h-[44px]"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Override Status</span>
          </button>
        </div>
      </div>

      {/* Grid: 3-Column Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Customer Contact & Profile */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-500" />
              <span>Contact & Demographics</span>
            </h2>
            <button
              onClick={() => {
                if (editMode) handleUpdateCustomer();
                else setEditMode(true);
              }}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
            >
              {editMode ? <Save className="w-3.5 h-3.5" /> : <Edit className="w-3.5 h-3.5" />}
              <span>{editMode ? "Save" : "Edit"}</span>
            </button>
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Primary WhatsApp Phone:</span>
              {editMode ? (
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs mt-1"
                />
              ) : (
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {formatDisplayPhone(customer.primaryPhone)}
                </span>
              )}
            </div>

            {customer.secondaryPhone && (
              <div>
                <span className="text-slate-400 block text-[11px]">Secondary Phone:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {formatDisplayPhone(customer.secondaryPhone)}
                </span>
              </div>
            )}

            <div>
              <span className="text-slate-400 block text-[11px]">CNIC:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {customer.cnic || "—"}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Address:</span>
              {editMode ? (
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs mt-1"
                />
              ) : (
                <span className="text-slate-700 dark:text-slate-300">
                  {customer.address || "No address on record"}
                </span>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Staff Assignment
                </span>
                {(currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOfficerId(customer.assignedToUserId || "");
                      setSelectedManagerId(customer.assignedManagerId || "");
                      setAssignError(null);
                      setAssignOpen(true);
                    }}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Assign / Reassign
                  </button>
                )}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-[11px]">Assigned Manager:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {customer.assignedManager?.name || "Unassigned"}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-[11px]">Recovery Officer:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {customer.assignedTo?.name || customer.recoveryPerson || "Unassigned"}
                </span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Staff Comments:</span>
              {editMode ? (
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs mt-1"
                />
              ) : (
                <span className="text-slate-600 dark:text-slate-400 italic">
                  {customer.comment || "None"}
                </span>
              )}
            </div>

            {editMode && (
              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="optout"
                  checked={optedOut}
                  onChange={(e) => setOptedOut(e.target.checked)}
                />
                <label htmlFor="optout" className="text-[11px] text-rose-500 font-semibold">
                  Customer opted-out from WhatsApp reminders
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Loan & Installment Schedule */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-500" />
              <span>Installment & Balances</span>
            </h2>
            <span className="text-[11px] font-bold text-slate-400">
              {inst?.noOfMonths || 12} Months Tenure
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Monthly EMI</span>
              <span className="text-base font-bold text-slate-900 dark:text-white">
                Rs. {inst?.emi ? inst.emi.toLocaleString() : 0}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Remaining Balance</span>
              <span className="text-base font-bold text-rose-600 dark:text-rose-400">
                Rs. {inst?.balance ? inst.balance.toLocaleString() : 0}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Due Date</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{dueStr}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Short / Excess</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Rs. {inst?.shortExcess || 0}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Down Payment</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Rs. {inst?.advanceReceived ? inst.advanceReceived.toLocaleString() : 0}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Total Credit</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Rs. {inst?.installmentTotal ? inst.installmentTotal.toLocaleString() : 0}
              </span>
            </div>
          </div>

          <div className="pt-2 text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800 flex justify-between">
            <span>Last Payment Recorded:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Rs. {inst?.lastPaymentAmount || 0} on {lastPaidDateStr}
            </span>
          </div>
        </div>

        {/* Card 3: Financed Product */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-500" />
              <span>Financed Product Details</span>
            </h2>
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Product Name:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {customer.productName || "General Installment Loan"}
              </span>
              {customer.brand && (
                <span className="text-[10px] ml-2 px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
                  {customer.brand}
                </span>
              )}
            </div>

            {customer.imei1 && (
              <div>
                <span className="text-slate-400 block text-[11px]">IMEI 1:</span>
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                  {customer.imei1}
                </span>
              </div>
            )}

            {customer.imei2 && (
              <div>
                <span className="text-slate-400 block text-[11px]">IMEI 2:</span>
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                  {customer.imei2}
                </span>
              </div>
            )}

            <div>
              <span className="text-slate-400 block text-[11px]">Sales Person:</span>
              <span className="text-slate-800 dark:text-slate-200 font-semibold">
                {customer.salesPerson || "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Guarantor Contact Cards (2 Columns) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>Guarantor Recovery References</span>
          </h2>
          <span className="text-xs text-slate-400">
            Escalation contacts for overdue recovery
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Guarantor 1 Card */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200">
                  GUARANTOR 1
                </span>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  {customer.guarantor1Name || "Not Provided"}
                </h3>
              </div>
              <span
                className={clsx(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full",
                  g1PhoneValid
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                )}
              >
                {g1PhoneValid ? "Valid Phone" : "Missing / Invalid"}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 text-[11px]">Phone Number:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {customer.guarantor1Phone ? formatDisplayPhone(customer.guarantor1Phone) : "—"}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400 text-[11px]">Messages Sent:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {g1MessageCount} notice(s)
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                disabled={!g1PhoneValid}
                onClick={() => openGuarantorModal("GUARANTOR_1")}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm shadow-purple-500/20 disabled:opacity-50 min-h-[38px]"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Notice to Guarantor 1</span>
              </button>
            </div>
          </div>

          {/* Guarantor 2 Card */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200">
                  GUARANTOR 2
                </span>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  {customer.guarantor2Name || "Not Provided"}
                </h3>
              </div>
              <span
                className={clsx(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full",
                  g2PhoneValid
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-slate-100 text-slate-500 border border-slate-200"
                )}
              >
                {g2PhoneValid ? "Valid Phone" : "Missing / Optional"}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 text-[11px]">Phone Number:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {customer.guarantor2Phone ? formatDisplayPhone(customer.guarantor2Phone) : "—"}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400 text-[11px]">Messages Sent:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {g2MessageCount} notice(s)
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                disabled={!g2PhoneValid}
                onClick={() => openGuarantorModal("GUARANTOR_2")}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold shadow-sm disabled:opacity-50 min-h-[38px]"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Notice to Guarantor 2</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs / Ledger Views: Payment History & WhatsApp History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment History */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-500" />
              <span>Verified Payment History</span>
            </h3>
            <button
              onClick={() => setPayOpen(true)}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              + Add Payment
            </button>
          </div>

          {customer.payments && customer.payments.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {customer.payments.map((p: any) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      Rs. {p.amount.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Method: {p.paymentMethod} {p.receiptNo ? `• Ref: ${p.receiptNo}` : ""}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-500">
                    {new Date(p.paymentDate).toLocaleDateString("en-PK", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              No payment transactions recorded yet.
            </div>
          )}
        </div>

        {/* WhatsApp Message Delivery & Escalation History */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          {/* Sub-tabs: Customer vs Guarantor */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setHistoryTab("CUSTOMER")}
                className={clsx(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-colors",
                  historyTab === "CUSTOMER"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                Customer Reminders ({customerLogs.length})
              </button>

              <button
                onClick={() => setHistoryTab("GUARANTOR")}
                className={clsx(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-colors",
                  historyTab === "GUARANTOR"
                    ? "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                Guarantor Escalations ({guarantorLogs.length + pendingGuarantorQueues.length})
              </button>
            </div>
          </div>

          {/* Customer Log Tab */}
          {historyTab === "CUSTOMER" && (
            <div>
              {customerLogs.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs max-h-80 overflow-y-auto">
                  {customerLogs.map((log: any) => (
                    <div key={log.id} className="py-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span
                          className={clsx(
                            "px-2 py-0.5 rounded text-[10px] font-bold",
                            log.status === "SENT"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : log.status === "FAILED"
                              ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                              : "bg-slate-100 text-slate-600"
                          )}
                        >
                          {log.status} ({log.messageType})
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(log.sentAt).toLocaleString("en-PK")}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl whitespace-pre-line font-mono">
                        {log.messageText}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  No WhatsApp reminders sent to this customer yet.
                </div>
              )}
            </div>
          )}

          {/* Guarantor Log Tab */}
          {historyTab === "GUARANTOR" && (
            <div className="space-y-3">
              {/* Pending Queue notices */}
              {pendingGuarantorQueues.map((q: any) => (
                <div key={q.id} className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-700 dark:text-amber-300">
                      ⏳ {q.approvalStatus === "PENDING_APPROVAL" ? "PENDING MANAGER APPROVAL" : "QUEUED FOR WORKER"}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Target: {q.recipientName} ({q.recipientType})
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-line font-mono bg-white dark:bg-slate-900 p-2 rounded-lg border border-amber-100">
                    {q.messageText}
                  </p>
                </div>
              ))}

              {/* Sent / Logged notices */}
              {guarantorLogs.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs max-h-80 overflow-y-auto">
                  {guarantorLogs.map((log: any) => (
                    <div key={log.id} className="py-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200">
                            {log.recipientType} • Level {log.escalationLevel || 1}
                          </span>
                          <span
                            className={clsx(
                              "px-1.5 py-0.5 rounded text-[10px] font-bold",
                              log.status === "SENT"
                                ? "bg-emerald-50 text-emerald-700"
                                : log.status === "FAILED"
                                ? "bg-rose-50 text-rose-700"
                                : "bg-slate-100 text-slate-600"
                            )}
                          >
                            {log.status}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(log.sentAt).toLocaleString("en-PK")}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl whitespace-pre-line font-mono">
                        {log.messageText}
                      </p>
                    </div>
                  ))}
                </div>
              ) : pendingGuarantorQueues.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No guarantor escalation notices sent for this account yet.
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Assignment History Log */}
      {customer.assignments && customer.assignments.length > 0 && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-indigo-500" />
            <span>Staff Assignment History & Audit Trail</span>
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {customer.assignments.map((asg: any) => (
              <div key={asg.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Assigned to {asg.user?.name} ({asg.role})
                  </span>
                  <div className="text-[11px] text-slate-400">
                    By: {asg.assignedBy?.name || "System"} • Status: {asg.isActive ? "Active Assignment" : "Reassigned / Inactive"}
                    {asg.notes && ` • Notes: ${asg.notes}`}
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-500">
                  {new Date(asg.assignedAt).toLocaleString("en-PK")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Assign Staff */}
      {assignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-500" />
                <span>Assign Customer to Staff</span>
              </h3>
              <button onClick={() => setAssignOpen(false)} className="text-slate-400 text-lg font-bold">
                ✕
              </button>
            </div>

            {assignError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{assignError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              {currentUser?.role === "ADMIN" && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Assign Manager / Team
                  </label>
                  <select
                    value={selectedManagerId}
                    onChange={(e) => setSelectedManagerId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="">-- No Manager (Direct / Global) --</option>
                    {staffUsers
                      .filter((u) => u.role === "MANAGER")
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.branch || "MAIN"})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Assign Recovery Officer
                </label>
                <select
                  value={selectedOfficerId}
                  onChange={(e) => setSelectedOfficerId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="">-- Unassigned Officer --</option>
                  {staffUsers
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
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Assignment Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Assigned for special follow-up"
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAssignOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold min-h-[38px]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={assigning}
                onClick={handleSaveAssignment}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 min-h-[38px]"
              >
                {assigning ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5" />
                )}
                <span>Save Assignment</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Send WhatsApp Message (Customer) */}
      {msgOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-500" />
                <span>Send WhatsApp Reminder</span>
              </h3>
              <button onClick={() => setMsgOpen(false)} className="text-slate-400 text-lg font-bold">
                ✕
              </button>
            </div>

            {msgNotice && (
              <div
                className={clsx(
                  "p-3 rounded-xl text-xs font-semibold",
                  msgNotice.startsWith("Error")
                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                )}
              >
                {msgNotice}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Personalized Urdu / Roman-Urdu Message
              </label>
              <textarea
                rows={6}
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMsgOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold min-h-[38px]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sendingMsg}
                onClick={handleSendWhatsApp}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 min-h-[38px]"
              >
                {sendingMsg ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Dispatch to WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Send Guarantor Notice */}
      {guarantorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-600" />
                <span>Send Guarantor Recovery Notice</span>
              </h3>
              <button onClick={() => setGuarantorModalOpen(false)} className="text-slate-400 text-lg font-bold">
                ✕
              </button>
            </div>

            {guarantorMsgNotice && (
              <div
                className={clsx(
                  "p-3 rounded-xl text-xs font-semibold",
                  guarantorMsgNotice.startsWith("Error")
                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                )}
              >
                {guarantorMsgNotice}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Target Guarantor</label>
                  <select
                    value={selectedGuarantor}
                    onChange={(e) => setSelectedGuarantor(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="GUARANTOR_1">Guarantor 1: {customer.guarantor1Name || "G1"}</option>
                    <option value="GUARANTOR_2">Guarantor 2: {customer.guarantor2Name || "G2"}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Notice Template</label>
                  <select
                    value={guarantorMessageType}
                    onChange={(e) => handleGuarantorTypeChange(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="GUARANTOR_FIRST_NOTICE">Level 1: First Notice</option>
                    <option value="GUARANTOR_FOLLOWUP">Level 2: Follow-up</option>
                    <option value="GUARANTOR_FINAL_NOTICE">Level 3: Final Notice</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Message Text (Privacy Safe: No CNIC / Full Address)
                </label>
                <textarea
                  rows={6}
                  value={guarantorCustomMsg}
                  onChange={(e) => setGuarantorCustomMsg(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setGuarantorModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold min-h-[38px]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sendingGuarantorMsg}
                onClick={handleSendGuarantorWhatsApp}
                className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 min-h-[38px]"
              >
                {sendingGuarantorMsg ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Dispatch Notice</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Record Payment */}
      {payOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                <span>Record Customer Payment</span>
              </h3>
              <button onClick={() => setPayOpen(false)} className="text-slate-400 text-lg font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Amount (PKR)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 2900"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Method
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300"
                >
                  <option value="CASH">Cash Collection</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="EASYPAISA">EasyPaisa</option>
                  <option value="JAZZCASH">JazzCash</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPayOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold min-h-[38px]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={recordingPay}
                onClick={handleRecordPayment}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 min-h-[38px]"
              >
                {recordingPay ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Save Payment & Recalculate</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Status Override */}
      {overrideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Manual Installment Status Override</span>
              </h3>
              <button onClick={() => setOverrideOpen(false)} className="text-slate-400 text-lg font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300"
                >
                  <option value="PAID">PAID (Clear from reminder queue)</option>
                  <option value="DUE_TODAY">DUE_TODAY</option>
                  <option value="OVERDUE">OVERDUE</option>
                  <option value="UPCOMING">UPCOMING</option>
                  <option value="UNKNOWN">UNKNOWN (Hold reminders)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Override Reason / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Special arrangement made with manager"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOverrideOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold min-h-[38px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleOverrideStatus}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 min-h-[38px]"
              >
                <span>Save Override</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
