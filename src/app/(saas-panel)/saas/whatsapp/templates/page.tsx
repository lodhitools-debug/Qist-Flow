"use client";
import useSWR from "swr";
import { MessageSquare, RefreshCw } from "lucide-react";
const fetcher = (url: string) => fetch(url).then(r => r.json());
export default function TemplatesPage() {
  const { data, isLoading } = useSWR("/api/saas/whatsapp/templates", fetcher);
  const templates = data?.templates || [];
  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      <h1 className="text-2xl font-bold flex items-center gap-3"><MessageSquare className="text-emerald-500"/> Global WhatsApp Templates</h1>
      {isLoading ? <div className="flex justify-center p-10"><RefreshCw className="animate-spin text-slate-300 w-8 h-8"/></div> : 
       templates.length === 0 ? <div className="p-10 text-center border rounded-2xl bg-white shadow-sm">No templates found.</div> :
       <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        {templates.map((t:any) => (
          <div key={t.id} className="border-b last:border-0 p-4">
            <h3 className="font-bold">{t.name}</h3><p className="text-sm text-slate-500">{t.body}</p>
          </div>
        ))}
      </div>}
    </div>
  );
}