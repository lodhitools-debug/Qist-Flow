
"use client";
import { Activity, Server, Database, Cloud } from "lucide-react";
export default function HealthPage() {
  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      <h1 className="text-2xl font-bold flex items-center gap-3"><Activity className="text-emerald-500"/> System Health</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col items-center justify-center text-center">
          <Server className="w-10 h-10 text-emerald-500 mb-3" />
          <h3 className="font-bold">App Servers</h3><p className="text-emerald-500 font-bold text-sm">99.99% Uptime</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col items-center justify-center text-center">
          <Database className="w-10 h-10 text-emerald-500 mb-3" />
          <h3 className="font-bold">Primary Database</h3><p className="text-emerald-500 font-bold text-sm">12ms Latency</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col items-center justify-center text-center">
          <Cloud className="w-10 h-10 text-amber-500 mb-3" />
          <h3 className="font-bold">WhatsApp API</h3><p className="text-amber-500 font-bold text-sm">Degraded Performance</p>
        </div>
      </div>
    </div>
  );
}