"use client";
import { useState } from "react";
import useSWR from "swr";
import { Ticket, RefreshCw, MessageSquare, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import clsx from "clsx";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function TicketsPage() {
  const { data, isLoading, mutate } = useSWR("/api/saas/support/tickets", fetcher);
  const tickets = data?.tickets || [];
  
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/saas/support/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        mutate();
        if (selectedTicket && selectedTicket.id === id) {
          setSelectedTicket({ ...selectedTicket, status });
        }
      }
    } catch (e) {
      alert("Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Ticket className="w-7 h-7 text-rose-500" />
            Support Tickets
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage incoming support requests from tenants.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-slate-300 w-8 h-8"/></div>
      ) : tickets.length === 0 ? (
        <div className="p-10 text-center flex flex-col items-center border rounded-2xl bg-white dark:bg-slate-900 shadow-sm mt-4">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4"><Ticket className="w-8 h-8 text-slate-400"/></div>
          <h3 className="font-bold text-lg">No Tickets Found</h3>
          <p className="text-slate-500 max-w-sm mx-auto text-sm mt-2">There are currently no support tickets to display.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          {/* Ticket List */}
          <div className="lg:col-span-1 space-y-3">
            {tickets.map((t: any) => (
              <div 
                key={t.id} 
                onClick={() => setSelectedTicket(t)}
                className={clsx(
                  "p-4 rounded-xl border cursor-pointer transition-all",
                  selectedTicket?.id === t.id 
                    ? "bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/30 shadow-sm" 
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300"
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.category}</span>
                  <StatusBadge status={t.status} />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1">{t.subject}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-1">{t.tenant?.name}</p>
              </div>
            ))}
          </div>

          {/* Ticket Detail View */}
          <div className="lg:col-span-2">
            {selectedTicket ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedTicket.subject}</h2>
                    <p className="text-sm text-slate-500 mt-1">Tenant: <span className="font-medium text-slate-700 dark:text-slate-300">{selectedTicket.tenant?.name}</span></p>
                  </div>
                  <div className="flex gap-2">
                    <select 
                      value={selectedTicket.status}
                      onChange={(e) => updateStatus(selectedTicket.id, e.target.value)}
                      disabled={updatingId === selectedTicket.id}
                      className="text-xs font-bold bg-slate-50 border rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="WAITING">Waiting on Customer</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-100 dark:border-slate-800 min-h-[200px]">
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{selectedTicket.description}</p>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors">
                    <MessageSquare className="w-4 h-4"/> Reply to Ticket (Coming Soon)
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-center text-slate-400">
                Select a ticket to view details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "OPEN") return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700"><AlertCircle className="w-3 h-3 inline mr-1"/>Open</span>;
  if (status === "IN_PROGRESS") return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700"><RefreshCw className="w-3 h-3 inline mr-1"/>Progress</span>;
  if (status === "WAITING") return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><Clock className="w-3 h-3 inline mr-1"/>Waiting</span>;
  if (status === "RESOLVED" || status === "CLOSED") return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3 inline mr-1"/>{status === "CLOSED" ? "Closed" : "Resolved"}</span>;
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{status}</span>;
}