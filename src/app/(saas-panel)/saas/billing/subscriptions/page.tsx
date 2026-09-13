
"use client";
import { CreditCard, Search, ArrowUpRight } from "lucide-react";
export default function SubscriptionsPage() {
  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-3"><CreditCard className="text-indigo-500"/> Subscriptions</h1>
      </div>
      <div className="bg-white dark:bg-slate-900 border rounded-2xl p-6 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500 uppercase text-[11px] border-b">
            <tr><th className="pb-3">Tenant</th><th className="pb-3">Plan</th><th className="pb-3">Status</th><th className="pb-3">Next Billing</th></tr>
          </thead>
          <tbody className="divide-y">
            <tr className="h-14"><td className="font-bold">Lodhi Tools</td><td><span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-bold">PRO</span></td><td><span className="text-emerald-500 font-bold text-xs bg-emerald-50 px-2 py-1 rounded">ACTIVE</span></td><td>Oct 15, 2026</td></tr>
            <tr className="h-14"><td className="font-bold">Acme Corp</td><td><span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">ESSENTIAL</span></td><td><span className="text-rose-500 font-bold text-xs bg-rose-50 px-2 py-1 rounded">PAST DUE</span></td><td>Sep 01, 2026</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}