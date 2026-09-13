"use client";

import { MessageSquare, Construction } from "lucide-react";

export default function WhatsappTemplatesPage() {
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
          <MessageSquare className="w-7 h-7 text-indigo-500" />
          WhatsApp Templates
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          This module is currently being provisioned as part of the V2 upgrade.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 flex flex-col items-center justify-center text-center shadow-sm min-h-[400px]">
        <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-500/10 rounded-full flex items-center justify-center mb-6">
          <Construction className="w-10 h-10 text-indigo-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Module Under Construction</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          We are actively building out the advanced functionality for the <strong>WhatsApp Templates</strong> module. Check back shortly!
        </p>
      </div>
    </div>
  );
}
