"use client";

import useSWR from "swr";
import { CreditCard, Plus, Edit, Copy, RefreshCw, AlertTriangle } from "lucide-react";
import clsx from "clsx";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function SaaSPlansPage() {
  const { data, error, isLoading } = useSWR("/api/saas/plans", fetcher);
  const plans = data?.plans || [];

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
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-indigo-500/20 transition-all">
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
                  plan.isTrial ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                )}>
                  {plan.isTrial ? "TRIAL" : "RECURRING"}
                </span>
                <div className="flex gap-1.5">
                  <button className="p-1.5 text-slate-400 hover:text-indigo-500 bg-slate-50 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-500/10 rounded-lg"><Edit className="w-4 h-4" /></button>
                  <button className="p-1.5 text-slate-400 hover:text-blue-500 bg-slate-50 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-500/10 rounded-lg"><Copy className="w-4 h-4" /></button>
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
