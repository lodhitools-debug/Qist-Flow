"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { MessageCircle, Save, RefreshCw, Key } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function WhatsAppApiSettingsPage() {
  const { data, mutate, isLoading } = useSWR("/api/settings/whatsapp-api", fetcher);
  
  const [waApiEndpoint, setWaApiEndpoint] = useState("");
  const [waApiToken, setWaApiToken] = useState("");
  const [waPhoneNumberId, setWaPhoneNumberId] = useState("");
  const [waAccountId, setWaAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (data?.credentials) {
      setWaApiEndpoint(data.credentials.waApiEndpoint || "https://graph.facebook.com/v19.0/");
      setWaApiToken(data.credentials.waApiToken || "");
      setWaPhoneNumberId(data.credentials.waPhoneNumberId || "");
      setWaAccountId(data.credentials.waAccountId || "");
    }
  }, [data]);
  
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/whatsapp-api", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waApiEndpoint, waApiToken, waPhoneNumberId, waAccountId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setMessage("WhatsApp API Credentials saved successfully.");
      mutate();
    } catch (err: any) {
      setMessage("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="p-8 flex justify-center"><RefreshCw className="w-8 h-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MessageCircle className="w-7 h-7 text-emerald-500" />
            <span>WhatsApp Cloud API</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Connect your official Meta WhatsApp Business API credentials.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50">
          <Key className="w-5 h-5 text-indigo-500" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">API Credentials</h2>
        </div>
        
        <div className="p-6 space-y-5">
          {message && (
            <div className={`p-4 rounded-xl text-sm font-semibold border ${message.includes("Error") ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
              {message}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Meta API Endpoint</label>
              <input 
                required
                value={waApiEndpoint}
                onChange={e => setWaApiEndpoint(e.target.value)}
                type="text" 
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 font-mono focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Access Token</label>
              <input 
                value={waApiToken}
                onChange={e => setWaApiToken(e.target.value)}
                type="password" 
                placeholder="EAAGm0P..."
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 font-mono focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Phone Number ID</label>
              <input 
                value={waPhoneNumberId}
                onChange={e => setWaPhoneNumberId(e.target.value)}
                type="text" 
                placeholder="123456789012345"
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 font-mono focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">WhatsApp Business Account ID</label>
              <input 
                value={waAccountId}
                onChange={e => setWaAccountId(e.target.value)}
                type="text" 
                placeholder="987654321098765"
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 font-mono focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
          
          <div className="pt-5 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button 
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-indigo-500/20"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Credentials
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
