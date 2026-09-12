"use client";

import { Settings2, Database, ShieldAlert, Key } from "lucide-react";
import clsx from "clsx";

export default function SaasSettingsPage() {
  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-4 md:p-8 custom-scrollbar">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Global Settings</h1>
          <p className="text-sm text-slate-400 mt-1">
            System-wide configurations and security settings.
          </p>
        </div>

        <div className="space-y-6">
          {/* Security & Access */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">Security & Access</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Require 2FA for Branch Admins</h3>
                  <p className="text-xs text-slate-400 mt-1">Force all branch administrators to enable Two-Factor Authentication.</p>
                </div>
                <div className="w-12 h-6 bg-slate-800 rounded-full relative cursor-not-allowed opacity-50">
                  <div className="w-4 h-4 bg-slate-500 rounded-full absolute left-1 top-1" />
                </div>
              </div>
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Super Admin IPs</h3>
                  <p className="text-xs text-slate-400 mt-1">Restrict SaaS panel access to specific IP addresses.</p>
                </div>
                <button className="text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors">
                  Configure
                </button>
              </div>
            </div>
          </div>

          {/* Integrations */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-3">
              <Key className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">Global Integrations</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Primary WhatsApp API Gateway URL</label>
                <input 
                  type="text" 
                  disabled
                  defaultValue="https://wa.qistflow.com/api"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-400 font-mono focus:outline-none opacity-70 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Global Webhook Secret</label>
                <div className="flex gap-2">
                  <input 
                    type="password" 
                    disabled
                    defaultValue="************************"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-400 font-mono focus:outline-none opacity-70 cursor-not-allowed"
                  />
                  <button className="px-4 py-2 bg-slate-800 text-slate-300 text-sm font-bold rounded-lg hover:bg-slate-700">
                    Reveal
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Database */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-3">
              <Database className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold text-white">Database Operations</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Daily Automated Backups</h3>
                  <p className="text-xs text-slate-400 mt-1">Currently backing up to S3 bucket every 24 hours at 00:00 UTC.</p>
                </div>
                <div className="w-12 h-6 bg-indigo-500/20 border border-indigo-500/50 rounded-full relative cursor-not-allowed">
                  <div className="w-4 h-4 bg-indigo-500 rounded-full absolute right-1 top-1" />
                </div>
              </div>
              <div className="pt-4 border-t border-slate-800">
                <button className="text-sm font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 px-4 py-2 rounded-lg transition-colors">
                  Trigger Manual Backup
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
