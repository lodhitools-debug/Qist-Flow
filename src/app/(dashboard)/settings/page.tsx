"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Settings,
  Building,
  QrCode,
  Bell,
  Database,
  ShieldCheck,
  Save,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  UserCheck,
  Sliders,
  Users,
  Archive,
  Trash2,
  Clock,
  FileText,
  Check,
  Eye,
  RefreshCw,
  AlertTriangle,
  Lock,
  ShieldAlert,
} from "lucide-react";
import clsx from "clsx";

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab")?.toUpperCase();
  const activeTab: "BUSINESS" | "WHATSAPP" | "ESCALATION" | "RULES" | "BACKUP" | "RETENTION" =
    tabParam === "WHATSAPP" ||
    tabParam === "ESCALATION" ||
    tabParam === "RULES" ||
    tabParam === "BACKUP" ||
    tabParam === "RETENTION"
      ? (tabParam as any)
      : "BUSINESS";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Business Settings
  const [companyName, setCompanyName] = useState("QistFlow Recovery (QistBazar)");
  const [tagline, setTagline] = useState("Smart Recovery & WhatsApp Reminder System");
  const [supportPhone, setSupportPhone] = useState("021-111-747835");
  const [defaultBranch, setDefaultBranch] = useState("QBLAN");

  // WhatsApp Throttling & Anti-ban
  const [minDelay, setMinDelay] = useState(6000);
  const [maxDelay, setMaxDelay] = useState(14000);
  const [dailyLimit, setDailyLimit] = useState(250);
  const [antiBan, setAntiBan] = useState(true);

  // Guarantor Escalation Policy Settings
  const [escalationEnabled, setEscalationEnabled] = useState(true);
  const [level1DelayDays, setLevel1DelayDays] = useState(1);
  const [level2OverdueDays, setLevel2OverdueDays] = useState(3);
  const [level3OverdueDays, setLevel3OverdueDays] = useState(7);
  const [maxMessagesPerAccount, setMaxMessagesPerAccount] = useState(3);
  const [maxMessagesPerDay, setMaxMessagesPerDay] = useState(50);
  const [onlyAfterCustomerFailure, setOnlyAfterCustomerFailure] = useState(false);
  const [onlyAfterOverdue, setOnlyAfterOverdue] = useState(true);
  const [requireManagerApproval, setRequireManagerApproval] = useState(false);

  // Reminder Rules
  const [rules, setRules] = useState<any[]>([]);
  const [runningScheduler, setRunningScheduler] = useState(false);
  const [schedulerOutput, setSchedulerOutput] = useState<any>(null);

  // Backups
  const [backups, setBackups] = useState<any[]>([]);
  const [creatingBackup, setCreatingBackup] = useState(false);

  // Data Retention & Safe Cleanup Settings
  const [retentionEnabled, setRetentionEnabled] = useState(false);
  const [retentionDays, setRetentionDays] = useState<30 | 60 | 90>(90);
  const [retentionPolicyType, setRetentionPolicyType] = useState<"INACTIVITY" | "COMPLETION" | "BOTH">("BOTH");
  const [retentionActionType, setRetentionActionType] = useState<"ARCHIVE" | "PERMANENT_DELETE">("ARCHIVE");
  const [requireBackupBeforeDeletion, setRequireBackupBeforeDeletion] = useState(true);
  const [retentionLastRun, setRetentionLastRun] = useState<any>(null);

  // Retention Preview & Execution State
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState("");
  const [executingCleanup, setExecutingCleanup] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);

  const fetchAllSettings = async () => {
    try {
      setLoading(true);
      const [settingsRes, rulesRes, backupRes, retentionRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/rules"),
        fetch("/api/settings/backup"),
        fetch("/api/settings/retention"),
      ]);

      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        const biz = sData.settings?.business_profile;
        if (biz) {
          setCompanyName(biz.companyName || companyName);
          setTagline(biz.tagline || tagline);
          setSupportPhone(biz.supportPhone || supportPhone);
          setDefaultBranch(biz.defaultBranch || defaultBranch);
        }

        const wa = sData.settings?.whatsapp_config;
        if (wa) {
          setMinDelay(wa.minDelayMs || minDelay);
          setMaxDelay(wa.maxDelayMs || maxDelay);
          setDailyLimit(wa.dailyLimit || dailyLimit);
          setAntiBan(wa.antiBanEnabled !== undefined ? wa.antiBanEnabled : true);
        }

        const esc = sData.settings?.guarantor_escalation_config;
        if (esc) {
          setEscalationEnabled(esc.enabled !== undefined ? esc.enabled : true);
          setLevel1DelayDays(esc.level1DelayDays || 1);
          setLevel2OverdueDays(esc.level2OverdueDays || 3);
          setLevel3OverdueDays(esc.level3OverdueDays || 7);
          setMaxMessagesPerAccount(esc.maxMessagesPerAccount || 3);
          setMaxMessagesPerDay(esc.maxMessagesPerDay || 50);
          setOnlyAfterCustomerFailure(esc.onlyAfterCustomerFailure || false);
          setOnlyAfterOverdue(esc.onlyAfterOverdue !== undefined ? esc.onlyAfterOverdue : true);
          setRequireManagerApproval(esc.requireManagerApproval || false);
        }
      }

      if (rulesRes.ok) {
        const rData = await rulesRes.json();
        setRules(rData.rules || []);
      }

      if (backupRes.ok) {
        const bData = await backupRes.json();
        setBackups(bData.backups || []);
      }

      if (retentionRes.ok) {
        const retData = await retentionRes.json();
        const pol = retData.policy;
        if (pol) {
          setRetentionEnabled(pol.enabled || false);
          setRetentionDays(pol.retentionDays || 90);
          setRetentionPolicyType(pol.policyType || "BOTH");
          setRetentionActionType(pol.actionType || "ARCHIVE");
          setRequireBackupBeforeDeletion(
            pol.requireBackupBeforeDeletion !== undefined ? pol.requireBackupBeforeDeletion : true
          );
          setRetentionLastRun(pol.lastRunResult || null);
        }
      }
    } catch (err) {
      console.error("Failed to load settings", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllSettings();
  }, []);

  const handleSaveBusiness = async () => {
    try {
      setSaving(true);
      setNotice(null);
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "business_profile",
          value: {
            companyName,
            tagline,
            supportPhone,
            defaultBranch,
          },
        }),
      });

      if (res.ok) {
        setNotice("Business settings updated successfully!");
      }
    } catch (err: any) {
      setNotice("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWhatsApp = async () => {
    try {
      setSaving(true);
      setNotice(null);
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "whatsapp_config",
          value: {
            minDelayMs: Number(minDelay),
            maxDelayMs: Number(maxDelay),
            dailyLimit: Number(dailyLimit),
            antiBanEnabled: antiBan,
          },
        }),
      });

      if (res.ok) {
        setNotice("WhatsApp rate-limiting and anti-ban settings saved!");
      }
    } catch (err: any) {
      setNotice("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEscalation = async () => {
    try {
      setSaving(true);
      setNotice(null);
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "guarantor_escalation_config",
          value: {
            enabled: escalationEnabled,
            level1DelayDays: Number(level1DelayDays),
            level2OverdueDays: Number(level2OverdueDays),
            level3OverdueDays: Number(level3OverdueDays),
            maxMessagesPerAccount: Number(maxMessagesPerAccount),
            maxMessagesPerDay: Number(maxMessagesPerDay),
            onlyAfterCustomerFailure,
            onlyAfterOverdue,
            requireManagerApproval,
          },
        }),
      });

      if (res.ok) {
        setNotice("Guarantor Recovery Escalation settings saved successfully!");
      }
    } catch (err: any) {
      setNotice("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleRuleActive = async (ruleId: string, currentStatus: boolean) => {
    try {
      const res = await fetch("/api/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: ruleId,
          isActive: !currentStatus,
        }),
      });

      if (res.ok) {
        fetchAllSettings();
      }
    } catch (err) {
      console.error("Failed to toggle rule", err);
    }
  };

  const handleRunScheduler = async () => {
    try {
      setRunningScheduler(true);
      setSchedulerOutput(null);
      const res = await fetch("/api/rules/run-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bypassTimeWindow: true }),
      });

      const data = await res.json();
      if (res.ok) {
        setSchedulerOutput(data.result);
      }
    } catch (err: any) {
      alert("Scheduler check failed: " + err.message);
    } finally {
      setRunningScheduler(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setCreatingBackup(true);
      const res = await fetch("/api/settings/backup", { method: "POST" });
      if (res.ok) {
        fetchAllSettings();
        alert("Instant database backup snapshot created successfully!");
      }
    } catch (err: any) {
      alert("Backup failed: " + err.message);
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleRestoreBackup = async (snapshotId: string, name: string) => {
    if (!confirm(`Are you sure you want to restore database snapshot "${name}"?`)) return;
    try {
      const res = await fetch("/api/settings/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Restored successfully");
      } else {
        alert("Restore failed: " + (data.error || "Unknown"));
      }
    } catch (err: any) {
      alert("Restore failed: " + err.message);
    }
  };

  const handleSaveRetention = async () => {
    try {
      setSaving(true);
      setNotice(null);
      const res = await fetch("/api/settings/retention", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: retentionEnabled,
          retentionDays: Number(retentionDays),
          policyType: retentionPolicyType,
          actionType: retentionActionType,
          requireBackupBeforeDeletion,
        }),
      });

      if (res.ok) {
        setNotice("Data Retention & Cleanup policy saved successfully!");
      } else {
        const err = await res.json();
        setNotice("Error: " + (err.error || "Failed to save"));
      }
    } catch (err: any) {
      setNotice("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFetchPreview = async () => {
    try {
      setLoadingPreview(true);
      const res = await fetch("/api/settings/retention/preview");
      const data = await res.json();
      if (res.ok) {
        setPreviewData(data.preview);
      } else {
        alert("Failed to load preview: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Preview error: " + err.message);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExecuteCleanup = async () => {
    if (confirmationInput !== "CONFIRM_CLEANUP") {
      alert("Please type exactly 'CONFIRM_CLEANUP' to authorize this operation.");
      return;
    }
    try {
      setExecutingCleanup(true);
      setExecutionResult(null);
      const res = await fetch("/api/settings/retention/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "CONFIRM_CLEANUP" }),
      });
      const data = await res.json();
      setExecutionResult(data.result);
      if (res.ok && data.success) {
        setShowConfirmModal(false);
        setConfirmationInput("");
        fetchAllSettings();
        handleFetchPreview();
        setNotice(data.result.reason || "Cleanup executed successfully!");
      } else {
        alert("Cleanup failed or aborted: " + (data.result?.reason || data.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Execution error: " + err.message);
    } finally {
      setExecutingCleanup(false);
    }
  };

  const navigateTab = (tab: string) => {
    router.push(`/settings?tab=${tab}`);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
          <Settings className="w-5 h-5 text-emerald-500" />
          <span>System Settings & Operational Controls</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Configure business profile, anti-ban throttling parameters, guarantor escalations, reminder schedules, database backups, and automated data retention policies.
        </p>
      </div>

      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4" />
          <span>{notice}</span>
        </div>
      )}

      {/* Interactive Module Navigation Pills */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => navigateTab("BUSINESS")}
          className={clsx(
            "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
            activeTab === "BUSINESS"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Business Profile</span>
        </button>

        <button
          type="button"
          onClick={() => navigateTab("WHATSAPP")}
          className={clsx(
            "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
            activeTab === "WHATSAPP"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <QrCode className="w-3.5 h-3.5" />
          <span>WhatsApp Anti-Ban</span>
        </button>

        <button
          type="button"
          onClick={() => navigateTab("ESCALATION")}
          className={clsx(
            "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
            activeTab === "ESCALATION"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Guarantor Escalation</span>
        </button>

        <button
          type="button"
          onClick={() => navigateTab("RULES")}
          className={clsx(
            "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
            activeTab === "RULES"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Reminder Schedules</span>
        </button>

        <button
          type="button"
          onClick={() => navigateTab("BACKUP")}
          className={clsx(
            "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
            activeTab === "BACKUP"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Database Backups</span>
        </button>

        <button
          type="button"
          onClick={() => navigateTab("RETENTION")}
          className={clsx(
            "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
            activeTab === "RETENTION"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <Archive className="w-3.5 h-3.5 text-amber-400" />
          <span>Data Retention & Cleanup</span>
        </button>
      </div>

      {/* TAB 1: Business Profile */}
      {activeTab === "BUSINESS" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5 animate-in fade-in">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Business Identity</h2>
            <p className="text-xs text-slate-400">Used in reminder message footers and official reports.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Company / Organization Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                System Tagline
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Support Helpline / WhatsApp Contact
              </label>
              <input
                type="text"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Branch
              </label>
              <select
                value={defaultBranch}
                onChange={(e) => setDefaultBranch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
              >
                <option value="QBLAN">QBLAN (Landhi)</option>
                <option value="QBKOR">QBKOR (Korangi)</option>
                <option value="QBNZN">QBNZN (North Nazimabad)</option>
                <option value="QBGUL">QBGUL (Gulshan)</option>
                <option value="HEAD_OFFICE">HEAD_OFFICE</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              onClick={handleSaveBusiness}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 min-h-[40px]"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Business Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: WhatsApp Anti-Ban & Limits */}
      {activeTab === "WHATSAPP" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6 animate-in fade-in">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              WhatsApp Throttling & Anti-Ban Rate Limiting
            </h2>
            <p className="text-xs text-slate-400">
              Control the jitter delays and daily caps between outgoing messages to prevent WhatsApp number bans.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Minimum Delay (Milliseconds)
              </label>
              <input
                type="number"
                value={minDelay}
                onChange={(e) => setMinDelay(Number(e.target.value))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold"
              />
              <span className="text-[10px] text-slate-400 block">Recommended: 6000ms (6s)</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Maximum Delay (Milliseconds)
              </label>
              <input
                type="number"
                value={maxDelay}
                onChange={(e) => setMaxDelay(Number(e.target.value))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold"
              />
              <span className="text-[10px] text-slate-400 block">Recommended: 14000ms (14s)</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Max Messages / 24 Hours
              </label>
              <input
                type="number"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold"
              />
              <span className="text-[10px] text-slate-400 block">Recommended: 250 max/day</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Idempotency & Duplicate Protection Active:</span>
              <p className="text-[11px] mt-0.5 leading-relaxed">
                Even if you re-import Excel reports or trigger schedulers multiple times, the system will never deliver duplicate reminder messages to the same customer for the same payment due date.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              onClick={handleSaveWhatsApp}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 min-h-[40px]"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Anti-Ban Limits</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: Guarantor Escalation */}
      {activeTab === "ESCALATION" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Guarantor Recovery Escalation Policy
              </h2>
              <p className="text-xs text-slate-400">
                Controlled multi-level WhatsApp notifications for customer guarantors when recovery criteria are met.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
              <span>Enable Escalation</span>
              <input
                type="checkbox"
                checked={escalationEnabled}
                onChange={(e) => setEscalationEnabled(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
            </label>
          </div>

          {/* Level Thresholds */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Level 1: Customer WA Fail / Delay (Days)
              </label>
              <input
                type="number"
                min={1}
                value={level1DelayDays}
                onChange={(e) => setLevel1DelayDays(Number(e.target.value))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold"
              />
              <span className="text-[10px] text-slate-400 block">First Notice to Guarantor</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Level 2: Follow-up Overdue (Days)
              </label>
              <input
                type="number"
                min={1}
                value={level2OverdueDays}
                onChange={(e) => setLevel2OverdueDays(Number(e.target.value))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold"
              />
              <span className="text-[10px] text-slate-400 block">Overdue Follow-up Notice</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Level 3: Final Notice Overdue (Days)
              </label>
              <input
                type="number"
                min={1}
                value={level3OverdueDays}
                onChange={(e) => setLevel3OverdueDays(Number(e.target.value))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold"
              />
              <span className="text-[10px] text-slate-400 block">Final Urgent Escalation</span>
            </div>
          </div>

          {/* Limits & Safety */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Max Messages Per Account
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={maxMessagesPerAccount}
                onChange={(e) => setMaxMessagesPerAccount(Number(e.target.value))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold"
              />
              <span className="text-[10px] text-slate-400 block">Lifetime cap on guarantor messages per contract</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Max Messages Per Day (System-wide)
              </label>
              <input
                type="number"
                min={1}
                value={maxMessagesPerDay}
                onChange={(e) => setMaxMessagesPerDay(Number(e.target.value))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold"
              />
              <span className="text-[10px] text-slate-400 block">Daily quota for guarantor escalation messages</span>
            </div>
          </div>

          {/* Conditional Policy Toggles */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyAfterCustomerFailure}
                onChange={(e) => setOnlyAfterCustomerFailure(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Only escalate after customer WhatsApp message failure / unreachable
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyAfterOverdue}
                onChange={(e) => setOnlyAfterOverdue(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Only escalate after installment due date is overdue (balance &gt; 0)
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={requireManagerApproval}
                onChange={(e) => setRequireManagerApproval(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                Require Manager Approval before sending guarantor escalations (Holds messages in pending queue)
              </span>
            </label>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              onClick={handleSaveEscalation}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 min-h-[40px]"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Escalation Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: Reminder Rules */}
      {activeTab === "RULES" && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Automated Reminder Schedules
                </h2>
                <p className="text-xs text-slate-400">
                  Rules run automatically during active business hours (e.g. 10:00 AM - 07:00 PM).
                </p>
              </div>

              <button
                disabled={runningScheduler}
                onClick={handleRunScheduler}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 text-white text-xs font-bold shadow-sm disabled:opacity-50 min-h-[40px]"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{runningScheduler ? "Evaluating Rules..." : "Test Run Scheduler Now"}</span>
              </button>
            </div>

            {schedulerOutput && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                <span className="font-bold text-emerald-600">Scheduler Evaluation Results:</span>
                <div>Rules Evaluated: {schedulerOutput.rulesChecked}</div>
                <div>Eligible Customers Found: {schedulerOutput.totalEligible}</div>
                <div>Customer Messages Enqueued: {schedulerOutput.enqueued}</div>
                <div>Duplicate Reminders Skipped: {schedulerOutput.duplicatesSkipped}</div>
                {schedulerOutput.guarantorEnqueued !== undefined && (
                  <div>Guarantor Messages Enqueued: {schedulerOutput.guarantorEnqueued}</div>
                )}
                {schedulerOutput.guarantorPendingApproval !== undefined && (
                  <div>Guarantor Pending Approval: {schedulerOutput.guarantorPendingApproval}</div>
                )}
              </div>
            )}

            {/* Rules Table */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {rules.map((rule) => (
                <div key={rule.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{rule.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                        Offset: {rule.daysOffset > 0 ? `+${rule.daysOffset}d` : `${rule.daysOffset}d`}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Template: <span className="text-slate-600 dark:text-slate-300 font-semibold">{rule.template?.name}</span> • Window: {rule.timeWindowStart} - {rule.timeWindowEnd}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleRuleActive(rule.id, rule.isActive)}
                      className={clsx(
                        "px-3 py-1 rounded-full text-xs font-bold transition-all min-h-[36px]",
                        rule.isActive
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-500 border border-slate-300 dark:bg-slate-800"
                      )}
                    >
                      {rule.isActive ? "Enabled 🟢" : "Disabled ⚪"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Database Backups & Restore */}
      {activeTab === "BACKUP" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Database Snapshots & Rollback Protection
              </h2>
              <p className="text-xs text-slate-400">
                Snapshots preserve customer ledgers, payment history, and templates before large Excel imports.
              </p>
            </div>

            <button
              disabled={creatingBackup}
              onClick={handleCreateBackup}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 min-h-[40px]"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{creatingBackup ? "Creating Snapshot..." : "Create Backup Snapshot"}</span>
            </button>
          </div>

          {/* Backup List */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {backups.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                No backup snapshots found. Click "Create Backup Snapshot" to create one.
              </div>
            ) : (
              backups.map((b) => {
                let counts: any = {};
                try {
                  counts = JSON.parse(b.recordCounts || "{}");
                } catch {}

                return (
                  <div key={b.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{b.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Date: {new Date(b.createdAt).toLocaleString("en-PK")} • Type: {b.type} • Created by: {b.user?.name || "System"}
                      </div>
                      {counts.customers !== undefined && (
                        <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                          {counts.customers} Customers, {counts.installments} Installments, {counts.payments} Payments
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleRestoreBackup(b.id, b.name)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[36px]"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                      <span>Restore</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 6: Data Retention & Safe Cleanup */}
      {activeTab === "RETENTION" && (
        <div className="space-y-6 animate-in fade-in">
          {/* Main Policy Configuration Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Archive className="w-5 h-5 text-amber-500" />
                  <span>Data Retention & Automated Cleanup Policy</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Configure retention rules for completed and closed accounts. Ongoing loans, unpaid balances, and active installment agreements are strictly protected.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Automatic Cleanup:
                </span>
                <button
                  type="button"
                  onClick={() => setRetentionEnabled(!retentionEnabled)}
                  className={clsx(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                    retentionEnabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                  )}
                >
                  <span
                    className={clsx(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm",
                      retentionEnabled ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
                <span
                  className={clsx(
                    "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    retentionEnabled
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  )}
                >
                  {retentionEnabled ? "Enabled (Daily 00:00 UTC)" : "Disabled (Manual Only)"}
                </span>
              </div>
            </div>

            {/* Retention Period Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                1. Retention Threshold Period (Inactivity Window)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[30, 60, 90].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setRetentionDays(days as any)}
                    className={clsx(
                      "p-3.5 rounded-xl border text-left transition-all",
                      retentionDays === days
                        ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 ring-1 ring-emerald-500 text-emerald-900 dark:text-emerald-200"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">{days} Days</span>
                      {retentionDays === days && <Check className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {days === 30 && "Quick retire: eligible after 1 month of zero activity."}
                      {days === 60 && "Balanced: preserves accounts for 2 full payment cycles."}
                      {days === 90 && "Maximum safety (Recommended): preserves records for a full quarter."}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Policy Type Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                2. Eligibility Policy Criteria
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    type: "BOTH",
                    title: "Both: Completed & Inactive",
                    badge: "Recommended",
                    desc: "Account must be 100% PAID (balance = 0) AND inactive for the retention threshold.",
                  },
                  {
                    type: "COMPLETION",
                    title: "Completion-Based Only",
                    badge: "Settled Loans",
                    desc: "Eligible immediately once all loan installments are paid in full, regardless of days.",
                  },
                  {
                    type: "INACTIVITY",
                    title: "Inactivity-Based with Zero Debt",
                    badge: "Zero Debt",
                    desc: "Eligible after retention period has elapsed, provided balance is strictly 0.",
                  },
                ].map((p) => (
                  <button
                    key={p.type}
                    type="button"
                    onClick={() => setRetentionPolicyType(p.type as any)}
                    className={clsx(
                      "p-3.5 rounded-xl border text-left transition-all",
                      retentionPolicyType === p.type
                        ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 ring-1 ring-emerald-500 text-emerald-900 dark:text-emerald-200"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">{p.title}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                        {p.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{p.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Action Strategy & Backup Requirement */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  3. Action Strategy
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRetentionActionType("ARCHIVE")}
                    className={clsx(
                      "flex-1 p-3 rounded-xl border text-left transition-all",
                      retentionActionType === "ARCHIVE"
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold"
                        : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs"
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Archive className="w-3.5 h-3.5 text-amber-500" />
                      <span>Safe Archival (Preserves Data)</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 font-normal">
                      Stamps customer as archived; stops WhatsApp notifications while keeping financial history intact.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRetentionActionType("PERMANENT_DELETE")}
                    className={clsx(
                      "flex-1 p-3 rounded-xl border text-left transition-all",
                      retentionActionType === "PERMANENT_DELETE"
                        ? "border-red-500 bg-red-50 dark:bg-red-950/40 ring-1 ring-red-500 text-red-900 dark:text-red-200 font-bold"
                        : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs"
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      <span>Permanent Purge (With Backup)</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 font-normal">
                      Purges records only after creating a verified database snapshot.
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  4. Safety Constraints & Verification
                </label>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={requireBackupBeforeDeletion}
                      onChange={(e) => setRequireBackupBeforeDeletion(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                    <span>Require verified recoverable database snapshot before purge</span>
                  </label>
                  <p className="text-[10px] text-slate-400 pl-6">
                    If snapshot generation or integrity validation fails, cleanup is immediately aborted.
                  </p>
                </div>
              </div>
            </div>

            {/* Save Policy Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleSaveRetention}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50 min-h-[40px]"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? "Saving Policy..." : "Save Retention Settings"}</span>
              </button>
            </div>
          </div>

          {/* Safe Data Rules & Protection Guarantees Banner */}
          <div className="bg-amber-50/60 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/60 p-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs uppercase tracking-wide">
              <ShieldAlert className="w-4 h-4" />
              <span>Safety Rules & Ledger Protection Guarantees</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-amber-900/80 dark:text-amber-200/80">
              <div className="flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span><strong>Unpaid Debt Immunity:</strong> Any account with balance &gt; 0 is strictly protected and never touched.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span><strong>Active Plan Protection:</strong> Installments marked OVERDUE, DUE_TODAY, or UPCOMING are never eligible.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span><strong>Company Isolation:</strong> Cleanup scans strictly scope to your company ID; other tenants cannot be affected.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span><strong>Re-import Safety:</strong> Re-uploading Excel sheets will not trigger accidental deletion of active accounts.</span>
              </div>
            </div>
          </div>

          {/* Dry-Run Preview & Execution Controls */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-500" />
                  <span>Dry-Run Record Inspection & Execution</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Scan existing database records to preview accounts eligible for retention without altering any data.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleFetchPreview}
                  disabled={loadingPreview}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all disabled:opacity-50 min-h-[38px]"
                >
                  <RefreshCw className={clsx("w-3.5 h-3.5", loadingPreview && "animate-spin")} />
                  <span>{loadingPreview ? "Scanning Database..." : "Run Dry-Run Preview"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={!previewData || previewData.eligibleCount === 0}
                  className={clsx(
                    "flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all min-h-[38px]",
                    previewData && previewData.eligibleCount > 0
                      ? retentionActionType === "ARCHIVE"
                        ? "bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                        : "bg-red-600 hover:bg-red-700 text-white shadow-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                  )}
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Execute Cleanup Now</span>
                </button>
              </div>
            </div>

            {/* Preview Inspection Results */}
            {previewData && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Evaluated</div>
                    <div className="text-xl font-black text-slate-900 dark:text-white mt-1">{previewData.totalCustomers}</div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                    <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Protected Active</div>
                    <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">{previewData.protectedCount}</div>
                  </div>

                  <div className={clsx(
                    "p-3.5 rounded-xl border",
                    previewData.eligibleCount > 0
                      ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                      : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-500"
                  )}>
                    <div className="text-[10px] font-bold uppercase tracking-wider">Eligible for Cleanup</div>
                    <div className="text-xl font-black mt-1">{previewData.eligibleCount}</div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Threshold</div>
                    <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1">
                      {previewData.policy.retentionDays}d • {previewData.policy.policyType}
                    </div>
                  </div>
                </div>

                {/* Protection Breakdown */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-4">
                  <span className="font-bold text-slate-900 dark:text-white">Protected Breakdown:</span>
                  <span><strong>{previewData.ineligibilityBreakdown.unpaidBalance}</strong> with unpaid balance</span>
                  <span>•</span>
                  <span><strong>{previewData.ineligibilityBreakdown.activePlan}</strong> active/overdue plans</span>
                  <span>•</span>
                  <span><strong>{previewData.ineligibilityBreakdown.recentActivity}</strong> active within {previewData.policy.retentionDays} days</span>
                  <span>•</span>
                  <span><strong>{previewData.ineligibilityBreakdown.pendingQueue}</strong> pending WhatsApp dispatch</span>
                </div>

                {/* Eligible Records Table */}
                {previewData.eligibleRecords && previewData.eligibleRecords.length > 0 ? (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                      Eligible Account Records ({previewData.eligibleRecords.length})
                    </div>
                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {previewData.eligibleRecords.map((r: any) => (
                        <div key={r.id} className="px-4 py-2.5 flex items-center justify-between gap-4">
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white mr-2">{r.account}</span>
                            <span className="text-slate-600 dark:text-slate-300">{r.customerName}</span>
                            <span className="text-slate-400 text-[11px] ml-2">({r.branch})</span>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {r.eligibilityReason}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-emerald-600">PKR {r.totalPaid.toLocaleString()} Paid</span>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {r.daysInactive} days inactive
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>All records are protected. Zero completed or expired accounts currently meet cleanup threshold.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Last Run Audit Trail Card */}
          {retentionLastRun && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>Last Execution Audit Record</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Timestamp & Trigger</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 mt-1">
                    {new Date(retentionLastRun.timestamp).toLocaleString("en-PK")}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Source: {retentionLastRun.triggeredBy}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Outcome Status</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 mt-1 flex items-center gap-1.5">
                    <span className={clsx(
                      "w-2 h-2 rounded-full",
                      retentionLastRun.status === "SUCCESS" ? "bg-emerald-500" : "bg-red-500"
                    )} />
                    <span>{retentionLastRun.status}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Processed: {retentionLastRun.processedCount} records
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Backup Snapshot</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">
                    {retentionLastRun.backupSnapshotId ? "Snapshot Verified" : "None Required"}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                    ID: {retentionLastRun.backupSnapshotId || "—"}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Summary: {retentionLastRun.reason}
              </p>
            </div>
          )}

          {/* Execution Confirmation Modal */}
          {showConfirmModal && previewData && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4">
                <div className="flex items-center gap-2.5 text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <h3 className="font-bold text-base">Authorize Data Retention Cleanup</h3>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300">
                  You are about to execute a data retention cleanup for <strong>{previewData.eligibleCount}</strong> eligible records under the <strong>{retentionActionType}</strong> policy.
                </p>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
                  <div className="flex justify-between">
                    <span>Company / Tenant:</span>
                    <span className="font-bold">{previewData.tenantId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Action:</span>
                    <span className="font-bold text-amber-600">{retentionActionType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Recoverable Backup:</span>
                    <span className="font-bold text-emerald-600">Yes (Auto-Verified)</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Type <code className="text-red-600 dark:text-red-400 font-black">CONFIRM_CLEANUP</code> to confirm:
                  </label>
                  <input
                    type="text"
                    value={confirmationInput}
                    onChange={(e) => setConfirmationInput(e.target.value)}
                    placeholder="CONFIRM_CLEANUP"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowConfirmModal(false);
                      setConfirmationInput("");
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleExecuteCleanup}
                    disabled={confirmationInput !== "CONFIRM_CLEANUP" || executingCleanup}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all disabled:opacity-40"
                  >
                    {executingCleanup ? "Processing..." : "Confirm & Execute Cleanup"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-xs text-slate-400">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span>Loading settings...</span>
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
