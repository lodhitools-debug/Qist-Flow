"use client";

import { useState } from "react";
import { MessageSquare, Plus, Activity, RefreshCw, CheckCircle2, AlertTriangle, Smartphone, Link as LinkIcon, Settings } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";

export default function WhatsAppAccountsPage() {
  const [accounts] = useState([
    { id: 1, tenant: "Lodhi Tools", phone: "+92 300 1234567", status: "CONNECTED", quality: "GREEN", limit: "10K / 24h", lastActive: "10 mins ago" },
    { id: 2, tenant: "Acme Corp", phone: "+971 50 9876543", status: "CONNECTED", quality: "YELLOW", limit: "1K / 24h", lastActive: "2 hours ago" },
    { id: 3, tenant: "Alpha Tech", phone: "+92 321 4567890", status: "DISCONNECTED", quality: "UNKNOWN", limit: "N/A", lastActive: "1 day ago" }
  ]);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <MessageSquare className="w-7 h-7 text-emerald-500" />
            WhatsApp Cloud API Accounts
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monitor and manage official WhatsApp Business Platform integrations across all tenants.
          </p>
        </div>
        <Link href="/saas/whatsapp/onboarding" className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-emerald-500/20 transition-all">
          <Plus className="w-4 h-4" />
          <span>Onboard New Account</span>
        </Link>
      </div>

      {/* Global Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Connected</p>
          <div className="flex items-end gap-3">
            <p className="text-3xl font-bold text-slate-900 dark:text-white">108</p>
            <span className="text-xs font-medium text-emerald-500 mb-1 flex items-center gap-1">
              <TrendingUpIcon /> +12%
            </span>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Disconnected</p>
          <div className="flex items-end gap-3">
            <p className="text-3xl font-bold text-rose-500">7</p>
            <span className="text-xs font-medium text-rose-500 mb-1 flex items-center gap-1">
              Action Req
            </span>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Msg Volume (24h)</p>
          <div className="flex items-end gap-3">
            <p className="text-3xl font-bold text-slate-900 dark:text-white">45.2K</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">API Health</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
            <span className="text-lg font-bold text-emerald-500">Operational</span>
          </div>
        </div>
      </div>

      {/* Accounts List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-100 dark:border-slate-800">
                <th className="p-4 px-6">Tenant & Phone</th>
                <th className="p-4">Connection Status</th>
                <th className="p-4">Quality Rating</th>
                <th className="p-4">Messaging Limit</th>
                <th className="p-4">Last Active</th>
                <th className="p-4 text-right">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm">
              {accounts.map(acc => (
                <tr key={acc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                  <td className="p-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{acc.tenant}</p>
                        <p className="text-xs font-mono text-slate-500 mt-0.5">{acc.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={clsx(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase",
                      acc.status === "CONNECTED" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
                    )}>
                      {acc.status === "CONNECTED" ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      {acc.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className={clsx(
                        "w-2.5 h-2.5 rounded-full",
                        acc.quality === "GREEN" ? "bg-emerald-500" : 
                        acc.quality === "YELLOW" ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600"
                      )} />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{acc.quality}</span>
                    </div>
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-300 font-semibold text-xs">
                    {acc.limit}
                  </td>
                  <td className="p-4 text-slate-500 text-xs">
                    {acc.lastActive}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors" title="Test Connection">
                        <Activity className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors" title="Webhook Settings">
                        <LinkIcon className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TrendingUpIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
      <polyline points="17 6 23 6 23 12"></polyline>
    </svg>
  );
}
