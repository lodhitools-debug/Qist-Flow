"use client";
import useSWR from "swr";
import { CreditCard, RefreshCw } from "lucide-react";
const fetcher = (url: string) => fetch(url).then(r => r.json());
export default function SubscriptionsPage() {
  const { data, isLoading } = useSWR("/api/saas/billing/subscriptions", fetcher);
  const subscriptions = data?.subscriptions || [];
  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      <h1 className="text-2xl font-bold flex items-center gap-3"><CreditCard className="text-indigo-500"/> Subscriptions</h1>
      {isLoading ? <div className="flex justify-center p-10"><RefreshCw className="animate-spin text-slate-300 w-8 h-8"/></div> : 
       subscriptions.length === 0 ? <div className="p-10 text-center border rounded-2xl bg-white shadow-sm">No active subscriptions found.</div> :
       <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        {subscriptions.map((s:any) => (
          <div key={s.id} className="p-4 border-b font-bold">{s.tenant?.name} - {s.planVersion?.name}</div>
        ))}
      </div>}
    </div>
  );
}