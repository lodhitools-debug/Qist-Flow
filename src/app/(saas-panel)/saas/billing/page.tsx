"use client";

import { useState } from "react";
import useSWR from "swr";
import { CreditCard, CheckCircle2, Shield, Zap, RefreshCw, Plus, Edit, Trash2 } from "lucide-react";
import clsx from "clsx";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function SaasBillingPage() {
  const { data: tenantData, mutate: mutateTenants, isLoading: loadingTenants } = useSWR("/api/saas/tenants", fetcher);
  const { data: planData, mutate: mutatePlans, isLoading: loadingPlans } = useSWR("/api/saas/plans", fetcher);
  
  const tenants = tenantData?.tenants || [];
  const dbPlans = planData?.plans || [];

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [maxUsers, setMaxUsers] = useState("");
  const [maxCustomers, setMaxCustomers] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  const openCreateModal = () => {
    setEditingPlanId(null);
    setName(""); setPrice(""); setMaxUsers(""); setMaxCustomers("");
    setShowPlanModal(true);
  };
  
  const openEditModal = (plan: any) => {
    setEditingPlanId(plan.id);
    setName(plan.name);
    setPrice(plan.price.toString());
    setMaxUsers(plan.maxUsers.toString());
    setMaxCustomers(plan.maxCustomers.toString());
    setShowPlanModal(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = editingPlanId ? `/api/saas/plans/${editingPlanId}` : "/api/saas/plans";
      const method = editingPlanId ? "PATCH" : "POST";
      
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, price, maxUsers, maxCustomers })
      });
      mutatePlans();
      setShowPlanModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleDeletePlan = async (id: string) => {
    if (!confirm("Are you sure you want to delete this plan?")) return;
    try {
      const res = await fetch(`/api/saas/plans/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || "Failed to delete plan.");
      } else {
        mutatePlans();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-4 md:p-8 custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Billing & Subscriptions</h1>
            <p className="text-sm text-slate-400 mt-1">
              Manage custom pricing plans and branch subscriptions.
            </p>
          </div>
          <button 
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md shadow-indigo-500/20"
          >
            <Plus className="w-4 h-4" /> Create Custom Plan
          </button>
        </div>

        {/* Plans Overview */}
        {loadingPlans ? (
          <div className="flex justify-center p-8"><RefreshCw className="w-6 h-6 animate-spin text-slate-500" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {dbPlans.map((plan: any) => (
              <div key={plan.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{plan.name}</h3>
                      <p className="text-xs text-slate-400">${plan.price} / month</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEditModal(plan)} className="text-slate-400 hover:text-indigo-400">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeletePlan(plan.id)} className="text-slate-400 hover:text-rose-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <p className="text-xs font-medium text-slate-500 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
                  {plan.maxUsers} Users, {plan.maxCustomers.toLocaleString()} Customers
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Tenants List */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-lg font-bold text-white">Active Subscriptions</h2>
            <button onClick={() => mutateTenants()} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg">
              <RefreshCw className={clsx("w-4 h-4", loadingTenants && "animate-spin")} />
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/50">
                  <th className="px-5 py-3 text-xs font-bold text-slate-400 uppercase">Branch</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-400 uppercase">Current Plan</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-400 uppercase">Users Limit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loadingTenants ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-slate-500 text-sm">Loading subscriptions...</td>
                  </tr>
                ) : tenants.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-slate-500 text-sm">No branches found.</td>
                  </tr>
                ) : tenants.map((t: any) => (
                  <tr key={t.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-sm font-bold text-white">{t.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">{t.slug}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[10px] uppercase font-black px-2.5 py-1 rounded-md tracking-wider border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                        {t.customPlan?.name || t.plan || "FREE"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500" style={{ width: `${Math.min(((t._count?.users || 0) / t.maxUsers) * 100, 100)}%` }} />
                        </div>
                        <span className="text-xs font-medium text-slate-400">
                          {t._count?.users || 0} / {t.maxUsers}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl shadow-xl w-full max-w-md border border-slate-800 overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">{editingPlanId ? "Edit Plan" : "Create Custom Plan"}</h2>
              <button onClick={() => setShowPlanModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSavePlan} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Plan Name</label>
                <input required value={name} onChange={e => setName(e.target.value)} type="text" className="w-full text-sm px-3 py-2 border rounded-lg bg-slate-950 border-slate-800 text-white" placeholder="e.g. Diamond" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Monthly Price ($)</label>
                <input required value={price} onChange={e => setPrice(e.target.value)} type="number" className="w-full text-sm px-3 py-2 border rounded-lg bg-slate-950 border-slate-800 text-white" placeholder="299" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Max Users</label>
                  <input required value={maxUsers} onChange={e => setMaxUsers(e.target.value)} type="number" className="w-full text-sm px-3 py-2 border rounded-lg bg-slate-950 border-slate-800 text-white" placeholder="100" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Max Customers</label>
                  <input required value={maxCustomers} onChange={e => setMaxCustomers(e.target.value)} type="number" className="w-full text-sm px-3 py-2 border rounded-lg bg-slate-950 border-slate-800 text-white" placeholder="100000" />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowPlanModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white rounded-lg">Cancel</button>
                <button disabled={submitting} type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg flex items-center gap-2">
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
