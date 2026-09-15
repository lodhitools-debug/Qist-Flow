"use client";
import useSWR from "swr";
import { CreditCard, RefreshCw, Calendar, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import clsx from "clsx";
import { format } from "date-fns";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function SubscriptionsPage() {
  const { data, isLoading } = useSWR("/api/saas/billing/subscriptions", fetcher);
  const subscriptions = data?.subscriptions || [];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <CreditCard className="w-7 h-7 text-indigo-500" />
            Subscriptions
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage and view active tenant subscriptions.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-slate-300 w-8 h-8"/></div>
      ) : subscriptions.length === 0 ? (
        <div className="p-10 text-center flex flex-col items-center border rounded-2xl bg-white dark:bg-slate-900 shadow-sm mt-4">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4"><CreditCard className="w-8 h-8 text-slate-400"/></div>
          <h3 className="font-bold text-lg">No Subscriptions Found</h3>
          <p className="text-slate-500 max-w-sm mx-auto text-sm mt-2">There are currently no active tenant subscriptions in the system.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4">Tenant</th>
                  <th className="px-6 py-4">Plan</th>
                  <th className="px-6 py-4">Billing Cycle</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Renewal Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {subscriptions.map((sub: any) => (
                  <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 dark:text-white">{sub.tenant?.name || "Unknown"}</div>
                      <div className="text-xs text-slate-500">{sub.tenant?.slug}</div>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {sub.planVersion?.name || "Custom"}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 capitalize">
                      {sub.billingCycle.toLowerCase()}
                    </td>
                    <td className="px-6 py-4 font-bold">
                      {sub.amount === 0 ? "Free" : `${sub.currency} ${sub.amount.toLocaleString()}`}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      {sub.renewsAt ? format(new Date(sub.renewsAt), "MMM dd, yyyy") : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE") {
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5"/> Active</span>;
  }
  if (status === "PAST_DUE") {
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"><AlertCircle className="w-3.5 h-3.5"/> Past Due</span>;
  }
  if (status === "CANCELLED" || status === "SUSPENDED") {
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"><XCircle className="w-3.5 h-3.5"/> {status === "CANCELLED" ? "Cancelled" : "Suspended"}</span>;
  }
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{status}</span>;
}