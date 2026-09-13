"use client";
import useSWR from "swr";
import { FileText, RefreshCw } from "lucide-react";
const fetcher = (url: string) => fetch(url).then(r => r.json());
export default function InvoicesPage() {
  const { data, isLoading } = useSWR("/api/saas/billing/invoices", fetcher);
  const invoices = data?.invoices || [];
  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      <h1 className="text-2xl font-bold flex items-center gap-3"><FileText className="text-indigo-500"/> Invoices</h1>
      {isLoading ? <div className="flex justify-center p-10"><RefreshCw className="animate-spin text-slate-300 w-8 h-8"/></div> : 
       invoices.length === 0 ? <div className="p-10 text-center border rounded-2xl bg-white shadow-sm">No invoices found.</div> :
       <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        {invoices.map((i:any) => (
          <div key={i.id} className="p-4 border-b font-bold">{i.invoiceNumber} - Rs {i.total}</div>
        ))}
      </div>}
    </div>
  );
}