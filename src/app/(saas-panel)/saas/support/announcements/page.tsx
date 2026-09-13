"use client";
import useSWR from "swr";
import { Megaphone, RefreshCw } from "lucide-react";
const fetcher = (url: string) => fetch(url).then(r => r.json());
export default function AnnouncementsPage() {
  const { data, isLoading } = useSWR("/api/saas/support/announcements", fetcher);
  const announcements = data?.announcements || [];
  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      <h1 className="text-2xl font-bold flex items-center gap-3"><Megaphone className="text-amber-500"/> Announcements</h1>
      {isLoading ? <div className="flex justify-center p-10"><RefreshCw className="animate-spin text-slate-300 w-8 h-8"/></div> : 
       announcements.length === 0 ? <div className="p-10 text-center border rounded-2xl bg-white shadow-sm">No announcements found.</div> :
       <div className="grid gap-4">
        {announcements.map((a:any) => (
          <div key={a.id} className="bg-white p-5 rounded-2xl border shadow-sm"><h3 className="font-bold">{a.title}</h3><p className="text-sm text-slate-500">{a.content}</p></div>
        ))}
      </div>}
    </div>
  );
}