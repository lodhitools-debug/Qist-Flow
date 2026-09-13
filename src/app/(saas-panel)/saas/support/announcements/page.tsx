
"use client";
import { Megaphone, Plus } from "lucide-react";
export default function AnnouncementsPage() {
  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-3"><Megaphone className="text-amber-500"/> Announcements</h1>
        <button className="bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"><Plus className="w-4 h-4"/> New Broadcast</button>
      </div>
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border shadow-sm">
        <div className="border-b pb-4 mb-4">
          <span className="text-xs text-slate-500">Published: Sep 12, 2026</span>
          <h3 className="font-bold text-lg mt-1">V2 Upgrade Successfully Deployed</h3>
          <p className="text-slate-600 text-sm mt-2">All tenants have been migrated to the new infrastructure with zero downtime.</p>
        </div>
      </div>
    </div>
  );
}