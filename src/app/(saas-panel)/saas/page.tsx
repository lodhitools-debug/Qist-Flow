"use client";
import useSWR from "swr";
import { Activity, Users, Building, Database } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function DashboardPage() {
  const { data, error, isLoading } = useSWR("/api/saas/stats", fetcher);

  if (isLoading) {
    return <div className="flex-1 p-6 lg:p-8 flex items-center justify-center">Loading dashboard...</div>;
  }

  if (error || !data?.success) {
    return <div className="flex-1 p-6 lg:p-8 text-rose-500">Failed to load dashboard data.</div>;
  }

  const { stats, recentTenants } = data;

  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      <h1 className="text-2xl font-bold flex items-center gap-3 text-slate-900 dark:text-white">
        <Activity className="text-indigo-500"/> Enterprise Overview
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <Building className="w-5 h-5 text-indigo-500" />
            <h3 className="font-semibold text-sm">Total Tenants</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.totalTenants}</p>
        </div>
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <Activity className="w-5 h-5 text-emerald-500" />
            <h3 className="font-semibold text-sm">Active Tenants</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.activeTenants}</p>
        </div>
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <Users className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-sm">Total Users</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.totalUsers}</p>
        </div>
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <Database className="w-5 h-5 text-purple-500" />
            <h3 className="font-semibold text-sm">Total Customers</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.totalCustomers}</p>
        </div>
      </div>

      {recentTenants && recentTenants.length > 0 && (
        <div className="mt-8 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Recent Tenants</h2>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentTenants.map((tenant: any) => (
              <div key={tenant.id} className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{tenant.name}</p>
                  <p className="text-xs text-slate-500">Plan: {tenant.plan}</p>
                </div>
                <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">{tenant.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
