"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import clsx from "clsx";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"BUSINESS" | "WHATSAPP" | "ESCALATION" | "RULES" | "BACKUP">("BUSINESS");
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

  const fetchAllSettings = async () => {
    try {
      setLoading(true);
      const [settingsRes, rulesRes, backupRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/rules"),
        fetch("/api/settings/backup"),
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
          <Settings className="w-5 h-5 text-emerald-500" />
          <span>System Settings & Operational Controls</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Configure business details, anti-ban throttling parameters, guarantor recovery escalations, automated reminder schedules, and database backups.
        </p>
      </div>

      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4" />
          <span>{notice}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1 overflow-x-auto">
        {[
          { id: "BUSINESS", label: "Business Profile", icon: Building },
          { id: "WHATSAPP", label: "WhatsApp Anti-Ban", icon: QrCode },
          { id: "ESCALATION", label: "Guarantor Escalation", icon: Users },
          { id: "RULES", label: "Reminder Schedules", icon: Bell },
          { id: "BACKUP", label: "Database Backups", icon: Database },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setNotice(null);
              }}
              className={clsx(
                "flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 whitespace-nowrap",
                isActive
                  ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
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
    </div>
  );
}
