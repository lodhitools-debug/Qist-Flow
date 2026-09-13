
"use client";
import { Ticket, MessageSquare } from "lucide-react";
export default function TicketsPage() {
  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      <h1 className="text-2xl font-bold flex items-center gap-3"><Ticket className="text-rose-500"/> Support Tickets</h1>
      <div className="grid gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border flex justify-between items-center shadow-sm">
          <div><h3 className="font-bold text-lg">WhatsApp Connection Failing</h3><p className="text-sm text-slate-500">Tenant: Acme Corp • 2 hours ago</p></div>
          <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-xs font-bold uppercase">High Priority</span>
        </div>
      </div>
    </div>
  );
}