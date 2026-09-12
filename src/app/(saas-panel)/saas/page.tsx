"use client";

import { useState, useEffect } from "react";
import { Building, Users, Server, Shield, Activity, TrendingUp, RefreshCw } from "lucide-react";
import clsx from "clsx";

export default function SaasDashboardPage() {
  const [stats, setStats] = useState({
    totalTenants: 0,
    activeTenants: 0,
    totalUsers: 0,
    totalCustomers: 0,
    totalMessagesSent: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/saas/tenants");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load dashboard stats");
      
      const tenants = data.tenants || [];
      let active = 0;
      let users = 0;
      let customers = 0;
      let messages = 0;

      tenants.forEach((t: any) => {
        if (t.isActive) active++;
        users += t._count?.users || 0;
        customers += t._count?.customers || 0;
        messages += t.sentToday || 0;
      });

      setStats({
        totalTenants: tenants.length,
        activeTenants: active,
        totalUsers: users,
        totalCustomers: customers,
        totalMessagesSent: messages,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-red-500">
          <p className="font-semibold text-lg">Error loading dashboard</p>
          <p className="text-sm mt-1 opacity-80">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-4 md:p-8 custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Enterprise Overview</h1>
          <p className="text-sm text-slate-400 mt-1">
            System-wide metrics and health across all branches.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Total Branches" 
            value={stats.totalTenants} 
            subtitle={`${stats.activeTenants} active currently`}
            icon={Building} 
            color="indigo" 
          />
          <StatCard 
            title="Total Users" 
            value={stats.totalUsers} 
            subtitle="Across all branches"
            icon={Users} 
            color="emerald" 
          />
          <StatCard 
            title="Total Customers" 
            value={stats.totalCustomers} 
            subtitle="System-wide database"
            icon={Server} 
            color="blue" 
          />
          <StatCard 
            title="Messages Today" 
            value={stats.totalMessagesSent} 
            subtitle="WhatsApp sent today"
            icon={Activity} 
            color="purple" 
          />
        </div>

        {/* System Health */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">System Health</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-950 rounded-xl p-4 border border-emerald-500/20">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-400">Database</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-pulse" />
              </div>
              <p className="text-lg font-semibold text-white mt-2">Operational</p>
            </div>
            <div className="bg-slate-950 rounded-xl p-4 border border-emerald-500/20">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-400">WhatsApp API</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-pulse" />
              </div>
              <p className="text-lg font-semibold text-white mt-2">Connected</p>
            </div>
            <div className="bg-slate-950 rounded-xl p-4 border border-blue-500/20">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-400">Load</span>
                <TrendingUp className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-lg font-semibold text-white mt-2">Normal</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color }: any) {
  const colorClasses = {
    indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  }[color as string] || "bg-slate-800 text-slate-400 border-slate-700";

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <p className="text-3xl font-bold text-white mt-1">{value.toLocaleString()}</p>
        </div>
        <div className={clsx("p-2 rounded-xl border", colorClasses)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {subtitle && (
        <p className="text-[11px] font-medium text-slate-500 mt-3">{subtitle}</p>
      )}
    </div>
  );
}
