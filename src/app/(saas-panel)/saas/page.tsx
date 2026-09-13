"use client";

import { useState, useEffect } from "react";
import { 
  Building, Users, Server, Shield, Activity, TrendingUp, RefreshCw,
  MessageSquare, DollarSign, AlertCircle, CheckCircle2, XCircle, Clock
} from "lucide-react";
import clsx from "clsx";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export default function SaasDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock data for the advanced dashboard display (until full API is built)
  const stats = {
    totalTenants: 124,
    activeTenants: 98,
    trialTenants: 15,
    suspendedTenants: 8,
    expiredTenants: 3,
    
    totalUsers: 842,
    activeUsers: 790,
    
    whatsappAccounts: 115,
    connectedWhatsApp: 108,
    
    messagesSent: 1250400,
    deliveredMessages: 1230000,
    readMessages: 980500,
    failedMessages: 20400,
    
    mrr: 45000,
    arr: 540000,
    monthlyRevenue: 48500,
    activeSubscriptions: 110,
    expiringSubscriptions: 5,
    churnRate: 2.1
  };

  const systemHealth = [
    { name: "Database", status: "GREEN", uptime: "99.99%" },
    { name: "WhatsApp API", status: "GREEN", uptime: "99.98%" },
    { name: "Webhooks", status: "YELLOW", uptime: "98.50%", note: "High latency detected" },
    { name: "Message Queue", status: "GREEN", uptime: "99.99%" },
    { name: "Cron Jobs", status: "GREEN", uptime: "100%" },
    { name: "Email Service", status: "GREEN", uptime: "100%" },
    { name: "Storage", status: "GREEN", uptime: "99.99%", note: "45% Capacity" },
  ];

  const actionsRequired = [
    { type: "WhatsApp", message: "3 accounts disconnected in last 24h", severity: "high" },
    { type: "Billing", message: "5 failed subscription payments", severity: "high" },
    { type: "Subscriptions", message: "12 subscriptions expiring in 3 days", severity: "medium" },
    { type: "Usage", message: "2 tenants reached 90% message limit", severity: "medium" },
    { type: "Webhook", message: "Elevated error rate on Tenant #45", severity: "low" },
  ];

  useEffect(() => {
    // Simulate API fetch
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 h-full bg-slate-50 dark:bg-slate-950">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 h-full bg-slate-50 dark:bg-slate-950">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-red-500">
          <p className="font-semibold text-lg">Error loading dashboard</p>
          <p className="text-sm mt-1 opacity-80">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-8">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Enterprise Overview</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Comprehensive metrics and system health monitoring.
        </p>
      </div>

      {/* Top Metrics Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Tenants" value={stats.totalTenants} icon={Building} color="indigo" 
          subStats={[
            { label: "Active", value: stats.activeTenants },
            { label: "Trial", value: stats.trialTenants }
          ]} />
        <StatCard title="Monthly Revenue" value={`$${stats.monthlyRevenue.toLocaleString()}`} icon={DollarSign} color="emerald" 
          subStats={[
            { label: "MRR", value: `$${stats.mrr.toLocaleString()}` },
            { label: "ARR", value: `$${stats.arr.toLocaleString()}` }
          ]} />
        <StatCard title="WhatsApp Accts" value={stats.whatsappAccounts} icon={MessageSquare} color="blue" 
          subStats={[
            { label: "Connected", value: stats.connectedWhatsApp },
            { label: "Disconnected", value: stats.whatsappAccounts - stats.connectedWhatsApp }
          ]} />
        <StatCard title="Total Users" value={stats.totalUsers} icon={Users} color="purple" 
          subStats={[
            { label: "Active", value: stats.activeUsers },
            { label: "Inactive", value: stats.totalUsers - stats.activeUsers }
          ]} />
      </div>

      {/* Row 2: Charts and Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Revenue & Tenant Growth</h2>
          <div className="h-72">
            <Line 
              data={{
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
                datasets: [
                  {
                    label: 'MRR ($)',
                    data: [25000, 28000, 32000, 35000, 39000, 42000, 45000],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true
                  }
                ]
              }}
              options={{ responsive: true, maintainAspectRatio: false }}
            />
          </div>
        </div>

        {/* Action Required */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-rose-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Action Required</h2>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
            {actionsRequired.map((action, i) => (
              <div key={i} className="flex gap-3 items-start p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800/50">
                <div className={clsx(
                  "w-2 h-2 rounded-full mt-1.5 shrink-0",
                  action.severity === "high" ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" : 
                  action.severity === "medium" ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" : "bg-blue-500"
                )} />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{action.type}</p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-0.5">{action.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Messages and System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Message Usage Stats */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-6">Messaging Performance (30 Days)</h2>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800/50">
              <p className="text-xs font-medium text-slate-500">Sent</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.messagesSent.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800/50">
              <p className="text-xs font-medium text-slate-500">Delivered Rate</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {((stats.deliveredMessages / stats.messagesSent) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="h-48">
             <Bar 
              data={{
                labels: ['Sent', 'Delivered', 'Read', 'Failed'],
                datasets: [
                  {
                    label: 'Messages',
                    data: [stats.messagesSent, stats.deliveredMessages, stats.readMessages, stats.failedMessages],
                    backgroundColor: ['#6366f1', '#10b981', '#3b82f6', '#f43f5e'],
                    borderRadius: 6
                  }
                ]
              }}
              options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
            />
          </div>
        </div>

        {/* System Health */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">System Health</h2>
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full">
              <Shield className="w-3.5 h-3.5" />
              All Systems Nominal
            </div>
          </div>
          
          <div className="space-y-3">
            {systemHealth.map((sys, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  {sys.status === "GREEN" ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : sys.status === "YELLOW" ? (
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-500" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">{sys.name}</p>
                    {sys.note && <p className="text-[10px] font-medium text-slate-500">{sys.note}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{sys.uptime}</p>
                  <p className="text-[10px] text-slate-500">Uptime</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, subStats }: any) {
  const colorClasses = {
    indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  }[color as string] || "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400";

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start">
          <div className={clsx("p-2 rounded-xl", colorClasses)}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <p className="text-3xl font-bold text-slate-900 dark:text-white mt-4">{value}</p>
        <p className="text-sm font-medium text-slate-500 mt-1">{title}</p>
      </div>
      
      {subStats && (
        <div className="flex gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60">
          {subStats.map((stat: any, i: number) => (
            <div key={i}>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{stat.value}</p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
