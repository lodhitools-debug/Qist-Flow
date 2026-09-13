
"use client";
import { Server, Shield } from "lucide-react";
export default function AuditPage() {
  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      <h1 className="text-2xl font-bold flex items-center gap-3"><Shield className="text-slate-700"/> Global Audit Logs</h1>
      <div className="bg-white border rounded-2xl shadow-sm p-1 text-sm">
        <div className="p-4 border-b flex justify-between"><span className="font-bold text-slate-900">Ali Raza (SUPER_ADMIN)</span> <span className="text-slate-500">Created Tenant 'Acme Corp'</span> <span className="text-xs text-slate-400">10 mins ago</span></div>
        <div className="p-4 border-b flex justify-between"><span className="font-bold text-slate-900">System</span> <span className="text-slate-500">Processed 108 Subscription Renewals</span> <span className="text-xs text-slate-400">2 hours ago</span></div>
      </div>
    </div>
  );
}