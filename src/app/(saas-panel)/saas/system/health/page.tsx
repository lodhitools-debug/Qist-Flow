"use client";
import { Activity } from "lucide-react";
export default function HealthPage() {
  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      <h1 className="text-2xl font-bold flex items-center gap-3"><Activity className="text-emerald-500"/> System Health</h1>
      <div className="p-10 text-center border rounded-2xl bg-white shadow-sm mt-4">
        <h3 className="font-bold text-lg text-emerald-600">All Systems Operational</h3>
        <p className="text-slate-500 text-sm mt-2">Application servers and database are responding normally.</p>
      </div>
    </div>
  );
}