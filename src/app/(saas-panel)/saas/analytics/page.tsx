
"use client";
import { BarChart, TrendingUp } from "lucide-react";
export default function AnalyticsPage() {
  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      <h1 className="text-2xl font-bold flex items-center gap-3"><BarChart className="text-blue-500"/> Analytics & Reports</h1>
      <div className="bg-white rounded-2xl border p-8 shadow-sm text-center py-20">
        <TrendingUp className="w-16 h-16 text-blue-100 mx-auto mb-4" />
        <h2 className="text-xl font-bold">Advanced Reporting Dashboard</h2>
        <p className="text-slate-500 mt-2 max-w-md mx-auto">Visualize MRR, Churn, and Tenant Growth over time. Connecting to data warehouse...</p>
      </div>
    </div>
  );
}