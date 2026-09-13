
"use client";
import { Shield, Check } from "lucide-react";
export default function RolesPage() {
  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      <h1 className="text-2xl font-bold flex items-center gap-3"><Shield className="text-purple-500"/> Roles & Permissions</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-lg border-b pb-3 mb-3 text-purple-700">SUPER_ADMIN</h3>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500"/> Full System Access</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500"/> Manage Tenants & Billing</li>
          </ul>
        </div>
        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-lg border-b pb-3 mb-3 text-blue-700">SUPPORT_AGENT</h3>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500"/> View Tenants</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500"/> Manage Support Tickets</li>
          </ul>
        </div>
      </div>
    </div>
  );
}