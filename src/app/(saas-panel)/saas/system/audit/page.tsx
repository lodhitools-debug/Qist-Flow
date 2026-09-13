"use client";
import useSWR from "swr";
import { Shield, RefreshCw } from "lucide-react";
const fetcher = (url: string) => fetch(url).then(r => r.json());
export default function AuditPage() {
  const { data, isLoading } = useSWR("/api/saas/system/audit", fetcher);
  const logs = data?.logs || [];
  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      <h1 className="text-2xl font-bold flex items-center gap-3"><Shield className="text-slate-700"/> Global Audit Logs</h1>
      {isLoading ? <div className="flex justify-center p-10"><RefreshCw className="animate-spin text-slate-300 w-8 h-8"/></div> : 
       logs.length === 0 ? <div className="p-10 text-center border rounded-2xl bg-white shadow-sm">No audit logs found.</div> :
       <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        {logs.map((l:any) => (
          <div key={l.id} className="p-4 border-b font-bold">{l.action}</div>
        ))}
      </div>}
    </div>
  );
}