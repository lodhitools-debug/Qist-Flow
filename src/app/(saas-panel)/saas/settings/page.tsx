"use client";

import { useState } from "react";
import useSWR from "swr";
import { Settings2, Database, ShieldAlert, Key, MessageCircle, Save, RefreshCw } from "lucide-react";
import clsx from "clsx";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function SaasSettingsPage() {
  const { data, mutate, isLoading } = useSWR("/api/saas/settings", fetcher);
  
  const [saving, setSaving] = useState(false);
  
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Simulate API call for now since we just need the UI complete
      await new Promise(r => setTimeout(r, 1000));
      mutate();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-4 md:p-8 custom-scrollbar">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Global Settings</h1>
            <p className="text-sm text-slate-400 mt-1">
              System-wide configurations and security settings.
            </p>
          </div>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-indigo-500/20"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          
          {/* WhatsApp API */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-3">
              <MessageCircle className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">Global WhatsApp Business API</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Meta API Endpoint</label>
                  <input 
                    type="text" 
                    defaultValue="https://graph.facebook.com/v19.0/"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-300 font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Access Token</label>
                  <input 
                    type="password" 
                    placeholder="EAAGm0P..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-300 font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Phone Number ID</label>
                  <input 
                    type="text" 
                    placeholder="123456789012345"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-300 font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">WhatsApp Business Account ID</label>
                  <input 
                    type="text" 
                    placeholder="987654321098765"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-300 font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="pt-4 mt-2 border-t border-slate-800">
                <p className="text-xs text-slate-400">
                  This configuration acts as a fallback. Branches can override this by providing their own API keys in their tenant settings.
                </p>
              </div>
            </div>
          </div>

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
                <div className="w-12 h-6 bg-slate-800 rounded-full relative cursor-pointer">
                  <div className="w-4 h-4 bg-slate-500 rounded-full absolute left-1 top-1 transition-all" />
                </div>
              </div>
            </div>
          </div>
          
        </form>
      </div>
    </div>
  );
}
