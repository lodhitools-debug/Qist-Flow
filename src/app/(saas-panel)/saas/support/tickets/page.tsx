"use client";
import useSWR from "swr";
import { Ticket, RefreshCw } from "lucide-react";
const fetcher = (url: string) => fetch(url).then(r => r.json());
export default function TicketsPage() {
  const { data, isLoading } = useSWR("/api/saas/support/tickets", fetcher);
  const tickets = data?.tickets || [];
  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      <h1 className="text-2xl font-bold flex items-center gap-3"><Ticket className="text-rose-500"/> Support Tickets</h1>
      {isLoading ? <div className="flex justify-center p-10"><RefreshCw className="animate-spin text-slate-300 w-8 h-8"/></div> : 
       tickets.length === 0 ? <div className="p-10 text-center border rounded-2xl bg-white shadow-sm">No support tickets found.</div> :
       <div className="grid gap-4">
        {tickets.map((t:any) => (
          <div key={t.id} className="bg-white p-5 rounded-2xl border shadow-sm"><h3 className="font-bold">{t.subject}</h3><p className="text-sm text-slate-500">Tenant: {t.tenant?.name}</p></div>
        ))}
      </div>}
    </div>
  );
}