"use client";

import { useState, useEffect } from "react";
import { CreditCard, CheckCircle2, Shield, Zap, RefreshCw } from "lucide-react";
import clsx from "clsx";

const PLANS = [
  { id: "FREE", name: "Free", price: "$0", limits: "10 Users, 1,000 Customers", icon: Shield, color: "slate" },
  { id: "BASIC", name: "Basic", price: "$29", limits: "25 Users, 5,000 Customers", icon: CheckCircle2, color: "blue" },
  { id: "PRO", name: "Pro", price: "$99", limits: "50 Users, 50,000 Customers", icon: Zap, color: "purple" },
  { id: "ENTERPRISE", name: "Enterprise", price: "$299", limits: "Unlimited", icon: CreditCard, color: "amber" },
];

export default function SaasBillingPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/saas/tenants");
      const data = await res.json();
      if (res.ok) setTenants(data.tenants || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-4 md:p-8 custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Billing & Subscriptions</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage plans and limits for all branches.
          </p>
        </div>

        {/* Plans Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {PLANS.map(plan => (
            <div key={plan.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group">
              <div className={clsx(
                "absolute top-0 right-0 w-24 h-24 bg-gradient-to-br opacity-10 rounded-bl-full",
                plan.color === "slate" ? "from-slate-400 to-slate-600" :
                plan.color === "blue" ? "from-blue-400 to-blue-600" :
                plan.color === "purple" ? "from-purple-400 to-purple-600" :
                "from-amber-400 to-amber-600"
              )} />
              
              <div className="flex items-center gap-3 mb-4">
                <div className={clsx(
                  "p-2 rounded-xl",
                  plan.color === "slate" ? "bg-slate-500/10 text-slate-400" :
                  plan.color === "blue" ? "bg-blue-500/10 text-blue-400" :
                  plan.color === "purple" ? "bg-purple-500/10 text-purple-400" :
                  "bg-amber-500/10 text-amber-400"
                )}>
                  <plan.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white">{plan.name}</h3>
                  <p className="text-xs text-slate-400">{plan.price} / month</p>
                </div>
              </div>
              
              <p className="text-xs font-medium text-slate-500 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
                {plan.limits}
              </p>
            </div>
          ))}
        </div>

        {/* Tenants List */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-lg font-bold text-white">Active Subscriptions</h2>
            <button onClick={fetchTenants} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg">
              <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/50">
                  <th className="px-5 py-3 text-xs font-bold text-slate-400 uppercase">Branch</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-400 uppercase">Current Plan</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-400 uppercase">Users Limit</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-400 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-500 text-sm">Loading subscriptions...</td>
                  </tr>
                ) : tenants.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-500 text-sm">No branches found.</td>
                  </tr>
                ) : tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-sm font-bold text-white">{t.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">{t.slug}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={clsx(
                        "text-[10px] uppercase font-black px-2.5 py-1 rounded-md tracking-wider border",
                        t.plan === "FREE" ? "bg-slate-800 text-slate-400 border-slate-700" :
                        t.plan === "BASIC" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                        t.plan === "PRO" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                        "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      )}>
                        {t.plan || "FREE"}
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
                    <td className="px-5 py-4">
                      <button className="text-xs font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg transition-colors">
                        Change Plan
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
