"use client";

import { useState, useEffect } from "react";
import { MessageSquare, ArrowLeft, RefreshCw, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function WhatsAppOnboardingPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [tenantId, setTenantId] = useState("");
  const [waApiToken, setWaApiToken] = useState("");
  const [waPhoneNumberId, setWaPhoneNumberId] = useState("");
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/saas/tenants")
      .then(r => r.json())
      .then(data => {
        if (data.tenants) setTenants(data.tenants);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/saas/whatsapp/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, waApiToken, waPhoneNumberId }),
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to save credentials");
      
      setSuccess(true);
      setTimeout(() => {
        router.push("/saas/whatsapp");
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-3xl mx-auto space-y-6">
        
        <Link href="/saas/whatsapp" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Accounts
        </Link>
        
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/50 rounded-2xl flex items-center justify-center">
              <MessageSquare className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Onboard WhatsApp Account</h1>
              <p className="text-sm text-slate-500 mt-1">Connect a tenant's Meta Business account for official API messaging.</p>
            </div>
          </div>

          {success ? (
            <div className="p-10 text-center flex flex-col items-center bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
              <h2 className="text-xl font-bold text-emerald-700 dark:text-emerald-400">Account Connected!</h2>
              <p className="text-emerald-600/80 dark:text-emerald-400/80 mt-2">The tenant's WhatsApp Cloud API has been successfully configured.</p>
              <p className="text-xs text-emerald-500 mt-4">Redirecting back...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-sm font-medium">
                  {error}
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Select Tenant</label>
                  {loading ? (
                    <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse"></div>
                  ) : (
                    <select required value={tenantId} onChange={e => setTenantId(e.target.value)} className="w-full text-sm px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-emerald-500">
                      <option value="">-- Choose a tenant --</option>
                      {tenants.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="pt-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="font-bold text-slate-900 dark:text-white">API Credentials</h3>
                  <p className="text-xs text-slate-500 mt-1">Get these from the Meta App Dashboard under WhatsApp &gt; API Setup.</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Permanent Access Token</label>
                  <textarea required value={waApiToken} onChange={e => setWaApiToken(e.target.value)} rows={3} className="w-full text-sm px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 font-mono" placeholder="EAAB..." />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Phone Number ID</label>
                  <input required value={waPhoneNumberId} onChange={e => setWaPhoneNumberId(e.target.value)} type="text" className="w-full text-sm px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 font-mono" placeholder="10543232145" />
                </div>
              </div>

              <div className="pt-6">
                <button disabled={submitting || !tenantId} type="submit" className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex justify-center items-center gap-2">
                  {submitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <MessageSquare className="w-5 h-5" />}
                  {submitting ? "Saving Configuration..." : "Connect WhatsApp Account"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
