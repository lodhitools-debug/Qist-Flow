"use client";

import { useState } from "react";
import useSWR from "swr";
import { CreditCard, Plus, Edit, Copy, RefreshCw, AlertTriangle } from "lucide-react";
import clsx from "clsx";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function SaaSPlansPage() {
  const { data, error, isLoading, mutate } = useSWR("/api/saas/plans", fetcher);
  const plans = data?.plans || [];

  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState("");
  const [trialDays, setTrialDays] = useState("0");
  const [maxUsers, setMaxUsers] = useState("10");
  const [maxBranches, setMaxBranches] = useState("1");
  const [maxWaAccounts, setMaxWaAccounts] = useState("1");
  const [maxMonthlyMessages, setMaxMonthlyMessages] = useState("5000");
  const [isRecommended, setIsRecommended] = useState(false);

  const openCreateModal = () => {
    setEditingId(null);
    setName("");
    setMonthlyPrice("");
    setTrialDays("0");
    setMaxUsers("10");
    setMaxBranches("1");
    setMaxWaAccounts("1");
    setMaxMonthlyMessages("5000");
    setIsRecommended(false);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (plan: any) => {
    setEditingId(plan.id);
    setName(plan.name);
    setMonthlyPrice(plan.monthlyPrice.toString());
    setTrialDays(plan.trialDays.toString());
    setMaxUsers(plan.maxUsers.toString());
    setMaxBranches(plan.maxBranches.toString());
    setMaxWaAccounts(plan.maxWaAccounts.toString());
    setMaxMonthlyMessages(plan.maxMonthlyMessages.toString());
    setIsRecommended(plan.isRecommended);
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    
    const payload = {
      name, monthlyPrice, trialDays, maxUsers, maxBranches, maxWaAccounts, maxMonthlyMessages, isRecommended
    };

    try {
      const url = editingId ? `/api/saas/plans/${editingId}` : "/api/saas/plans";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save plan");
      
      mutate();
      setShowModal(false);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <CreditCard className="w-7 h-7 text-indigo-500" />
            Plan Builder
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure subscription tiers, feature flags, and usage limits.
          </p>
        </div>
        <button onClick={openCreateModal} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-indigo-500/20 transition-all">
          <Plus className="w-4 h-4" />
          <span>Create New Plan</span>
        </button>
      </div>

      {error ? (
        <div className="p-4 bg-rose-50 text-rose-600 rounded-xl flex items-center gap-2 border border-rose-200">
          <AlertTriangle className="w-5 h-5"/> Failed to load plans.
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-20"><RefreshCw className="w-8 h-8 animate-spin text-slate-300"/></div>
      ) : plans.length === 0 ? (
        <div className="p-10 text-center flex flex-col items-center border rounded-2xl bg-white dark:bg-slate-900 shadow-sm mt-4">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4"><CreditCard className="w-8 h-8 text-slate-400"/></div>
          <h3 className="font-bold text-lg">No Plans Configured</h3>
          <p className="text-slate-500 max-w-sm mx-auto text-sm mt-2">Create your first subscription plan to start onboarding tenants.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
          {plans.map((plan:any) => (
            <div key={plan.id} className={clsx(
              "relative bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border-2 flex flex-col transition-all",
              plan.isRecommended ? "border-indigo-500 shadow-lg shadow-indigo-500/10 scale-[1.02]" : "border-slate-200 dark:border-slate-800"
            )}>
              {plan.isRecommended && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-indigo-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm">
                  Recommended
                </div>
              )}
              <div className="flex justify-between items-start mb-4">
                <span className={clsx(
                  "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
                  plan.trialDays > 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                )}>
                  {plan.trialDays > 0 ? "TRIAL" : "RECURRING"}
                </span>
                <div className="flex gap-1.5">
                  <button onClick={() => openEditModal(plan)} className="p-1.5 text-slate-400 hover:text-indigo-500 bg-slate-50 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-500/10 rounded-lg"><Edit className="w-4 h-4" /></button>
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{plan.name}</h3>
              <div className="mt-4 mb-6 flex items-baseline gap-1">
                <span className="text-3xl font-black text-slate-900 dark:text-white">
                  {plan.monthlyPrice === 0 ? "Free" : `Rs ${plan.monthlyPrice.toLocaleString()}`}
                </span>
                {plan.monthlyPrice > 0 && <span className="text-sm font-medium text-slate-500">/ month</span>}
              </div>
              <div className="space-y-4 flex-1">
                <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">Limits</p>
                <ul className="space-y-3">
                  <LimitItem label="Admin Users" value={plan.maxUsers} />
                  <LimitItem label="Branches" value={plan.maxBranches} />
                  <LimitItem label="WhatsApp Accounts" value={plan.maxWaAccounts} />
                  <LimitItem label="Messages" value={plan.maxMonthlyMessages + '/mo'} />
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Plan Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{editingId ? 'Edit Plan' : 'Create New Plan'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-50 text-rose-600 text-xs rounded-lg border border-rose-200">{formError}</div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Plan Name</label>
                  <input required value={name} onChange={e => setName(e.target.value)} type="text" className="w-full text-sm px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" placeholder="e.g. Pro Tier" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Monthly Price (PKR)</label>
                  <input required value={monthlyPrice} onChange={e => setMonthlyPrice(e.target.value)} type="number" min="0" className="w-full text-sm px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" placeholder="5000" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Trial Days</label>
                  <input value={trialDays} onChange={e => setTrialDays(e.target.value)} type="number" min="0" className="w-full text-sm px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" placeholder="14" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Max Admin Users</label>
                  <input required value={maxUsers} onChange={e => setMaxUsers(e.target.value)} type="number" min="1" className="w-full text-sm px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Max Branches</label>
                  <input required value={maxBranches} onChange={e => setMaxBranches(e.target.value)} type="number" min="1" className="w-full text-sm px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Max WhatsApp Accounts</label>
                  <input required value={maxWaAccounts} onChange={e => setMaxWaAccounts(e.target.value)} type="number" min="0" className="w-full text-sm px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Monthly Messaging Limit</label>
                  <input required value={maxMonthlyMessages} onChange={e => setMaxMonthlyMessages(e.target.value)} type="number" min="0" className="w-full text-sm px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" />
                </div>
                <div className="sm:col-span-2 pt-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    <input type="checkbox" checked={isRecommended} onChange={e => setIsRecommended(e.target.checked)} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
                    Mark as Recommended Plan
                  </label>
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 mt-5">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button disabled={submitting} type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg flex items-center gap-2">
                  {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {editingId ? 'Save Changes' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function LimitItem({ label, value }: { label: string, value: any }) {
  return (
    <li className="flex justify-between items-center text-sm">
      <span className="text-slate-600 dark:text-slate-400 font-medium">{label}</span>
      <span className="font-bold text-slate-900 dark:text-white">{value}</span>
    </li>
  );
}
