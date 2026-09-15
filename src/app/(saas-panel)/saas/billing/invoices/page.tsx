"use client";
import { useState } from "react";
import useSWR from "swr";
import { FileText, RefreshCw, Calendar, CheckCircle2, AlertCircle, Clock, Check } from "lucide-react";
import { format } from "date-fns";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function InvoicesPage() {
  const { data, isLoading, mutate } = useSWR("/api/saas/billing/invoices", fetcher);
  const invoices = data?.invoices || [];
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const markAsPaid = async (id: string) => {
    if (!confirm("Are you sure you want to mark this invoice as PAID?")) return;
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/saas/billing/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID" })
      });
      if (res.ok) mutate();
    } catch (e) {
      alert("Failed to update invoice");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <FileText className="w-7 h-7 text-indigo-500" />
            Invoices
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track and manage billing invoices for all tenants.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-slate-300 w-8 h-8"/></div>
      ) : invoices.length === 0 ? (
        <div className="p-10 text-center flex flex-col items-center border rounded-2xl bg-white dark:bg-slate-900 shadow-sm mt-4">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4"><FileText className="w-8 h-8 text-slate-400"/></div>
          <h3 className="font-bold text-lg">No Invoices Found</h3>
          <p className="text-slate-500 max-w-sm mx-auto text-sm mt-2">There are currently no invoices generated in the system.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4">Invoice #</th>
                  <th className="px-6 py-4">Tenant</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {invoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4 font-mono text-indigo-600 dark:text-indigo-400 font-medium">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                      {inv.tenant?.name || "Unknown"}
                    </td>
                    <td className="px-6 py-4 font-bold">
                      {inv.currency} {inv.total.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5 mb-1"><Calendar className="w-3.5 h-3.5"/> Issued: {format(new Date(inv.createdAt), "MMM dd")}</div>
                      {inv.dueAt && <div className="flex items-center gap-1.5 text-xs text-rose-500"><Clock className="w-3.5 h-3.5"/> Due: {format(new Date(inv.dueAt), "MMM dd")}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      {inv.status !== "PAID" && (
                        <button
                          onClick={() => markAsPaid(inv.id)}
                          disabled={updatingId === inv.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          {updatingId === inv.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin"/> : <Check className="w-3.5 h-3.5"/>}
                          Mark Paid
                        </button>
                      )}
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
  if (status === "PAID") return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5"/> Paid</span>;
  if (status === "PENDING") return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"><Clock className="w-3.5 h-3.5"/> Pending</span>;
  if (status === "OVERDUE") return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"><AlertCircle className="w-3.5 h-3.5"/> Overdue</span>;
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{status}</span>;
}