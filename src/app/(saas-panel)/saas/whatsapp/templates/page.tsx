
"use client";
import { MessageSquare, CheckCircle2 } from "lucide-react";
export default function TemplatesPage() {
  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      <h1 className="text-2xl font-bold flex items-center gap-3"><MessageSquare className="text-emerald-500"/> Global WhatsApp Templates</h1>
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <div><h3 className="font-bold text-slate-900">payment_reminder_v1</h3><p className="text-sm text-slate-500">Category: UTILITY</p></div>
          <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> APPROVED</span>
        </div>
        <div className="p-4 bg-slate-50 text-sm font-mono text-slate-700">
          "Dear {{1}}, your installment of Rs {{2}} for {{3}} is due on {{4}}. Please pay on time to avoid late fees."
        </div>
      </div>
    </div>
  );
}