
"use client";
import { FileText, Download } from "lucide-react";
export default function InvoicesPage() {
  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      <h1 className="text-2xl font-bold flex items-center gap-3"><FileText className="text-indigo-500"/> Invoices</h1>
      <div className="bg-white dark:bg-slate-900 border rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[11px]">
            <tr><th className="p-4">Invoice ID</th><th className="p-4">Tenant</th><th className="p-4">Amount</th><th className="p-4">Status</th><th className="p-4"></th></tr>
          </thead>
          <tbody className="divide-y">
            <tr><td className="p-4 font-mono text-xs">INV-2026-001</td><td className="p-4 font-bold">Lodhi Tools</td><td className="p-4 font-bold">Rs 35,000</td><td className="p-4"><span className="text-emerald-500 bg-emerald-50 px-2 py-1 rounded font-bold text-xs">PAID</span></td><td className="p-4 text-right"><button className="text-indigo-500 hover:bg-indigo-50 p-2 rounded"><Download className="w-4 h-4"/></button></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}