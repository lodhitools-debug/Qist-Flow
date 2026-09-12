"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Building, Plus, Users, Shield, RefreshCw, AlertTriangle, CheckCircle2, Edit, Trash2, Power, PowerOff } from "lucide-react";
import clsx from "clsx";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function SaasAdminPage() {
  const { data, error, mutate, isLoading } = useSWR("/api/saas/tenants", fetcher);
  const tenants = data?.tenants || [];
  
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  // Auto-generate slug when name changes
  useEffect(() => {
    if (name) {
      setSlug(name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000));
    } else {
      setSlug("");
    }
  }, [name]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/saas/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, slug, adminName, adminEmail, adminPassword,
          plan: "PRO", maxUsers: 50, maxCustomers: 50000
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to create branch");
      
      mutate(); // Revalidate SWR
      setShowModal(false);
      setName("");
      setSlug("");
      setAdminName("");
      setAdminPassword("");
      setAdminPassword("");
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await fetch(`/api/saas/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus })
      });
      mutate();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this branch? This action cannot be undone.")) return;
    try {
      await fetch(`/api/saas/tenants/${id}`, { method: "DELETE" });
      mutate();
    } catch (err) {
      console.error(err);
    }
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-rose-50 text-rose-600 p-4 rounded-xl border border-rose-200 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building className="w-7 h-7 text-indigo-500" />
            <span>SaaS Admin / Branches</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage all company branches, their isolated data, and admin accounts.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-indigo-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Branch</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-slate-300" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tenants.map(t => (
            <div key={t.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">{t.name}</h3>
                  <div className="flex gap-2 items-center mt-1">
                    <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      ID: {t.slug}
                    </span>
                    <span className={clsx(
                      "text-[10px] uppercase font-black px-2 py-0.5 rounded tracking-wider border",
                      t.plan === "FREE" ? "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700" :
                      t.plan === "BASIC" ? "bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20" :
                      t.plan === "PRO" ? "bg-purple-100 text-purple-600 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20" :
                      "bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
                    )}>
                      {t.plan || "FREE"}
                    </span>
                  </div>
                </div>
                <span className={clsx(
                  "text-[10px] uppercase font-bold px-2 py-1 rounded-full",
                  t.isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                )}>
                  {t.isActive ? "Active" : "Disabled"}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <Users className="w-3 h-3" /> Customers
                  </span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {t._count?.customers || 0}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Users
                  </span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {t._count?.users || 0}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Admin Account</p>
                {t.adminUser ? (
                  <p className="text-[11px] text-slate-500 mt-1 truncate">{t.adminUser.email}</p>
                ) : (
                  <p className="text-[11px] text-rose-500 mt-1">No admin user found</p>
                )}
              </div>
              
              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => handleToggleStatus(t.id, t.isActive)}
                  className="flex-1 text-[11px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-400 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  {t.isActive ? <PowerOff className="w-3 h-3 text-rose-500" /> : <Power className="w-3 h-3 text-emerald-500" />}
                  {t.isActive ? "Deactivate" : "Activate"}
                </button>
                <button 
                  onClick={() => handleDelete(t.id)}
                  className="px-3 text-[11px] font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 py-2 rounded-lg transition-colors flex items-center justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create New Branch</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 text-rose-600 text-xs rounded-lg border border-rose-200">
                  {formError}
                </div>
              )}
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Branch Name</label>
                  <input required value={name} onChange={e => setName(e.target.value)} type="text" className="w-full text-sm px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" placeholder="e.g. Korangi Branch" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Unique Slug / ID</label>
                  <input required value={slug} onChange={e => setSlug(e.target.value)} type="text" className="w-full text-sm px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" placeholder="e.g. korangi-01" />
                </div>
                
                <div className="pt-3 pb-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Admin Account Credentials</span>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Admin Name</label>
                  <input required value={adminName} onChange={e => setAdminName(e.target.value)} type="text" className="w-full text-sm px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" placeholder="John Doe" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Admin Email</label>
                  <input required value={adminEmail} onChange={e => setAdminEmail(e.target.value)} type="email" className="w-full text-sm px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" placeholder="admin@korangi.com" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Admin Password</label>
                  <input required value={adminPassword} onChange={e => setAdminPassword(e.target.value)} type="text" className="w-full text-sm px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" placeholder="SecretPass123" />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button disabled={submitting} type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg flex items-center gap-2">
                  {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Create Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
