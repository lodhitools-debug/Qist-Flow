"use client";
import { Activity } from "lucide-react";
export default function DashboardPage() {
  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      <h1 className="text-2xl font-bold flex items-center gap-3"><Activity className="text-indigo-500"/> Enterprise Overview</h1>
      <div className="p-10 text-center border rounded-2xl bg-white shadow-sm mt-4">
        <h3 className="font-bold text-lg">No Dashboard Data</h3>
        <p className="text-slate-500 text-sm mt-2">There is no active tenant data or revenue to display on the dashboard yet.</p>
      </div>
    </div>
  );
}
