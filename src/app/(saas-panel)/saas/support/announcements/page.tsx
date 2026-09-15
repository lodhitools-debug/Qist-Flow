"use client";
import { useState } from "react";
import useSWR from "swr";
import { Megaphone, RefreshCw, Plus, Trash2, Info, AlertTriangle, Settings, BellRing } from "lucide-react";
import { format } from "date-fns";
import clsx from "clsx";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function AnnouncementsPage() {
  const { data, isLoading, mutate } = useSWR("/api/saas/support/announcements", fetcher);
  const announcements = data?.announcements || [];

  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState("INFO");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/saas/support/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, type })
      });
      if (res.ok) {
        mutate();
        setShowModal(false);
        setTitle("");
        setContent("");
      } else {
        alert("Failed to create announcement");
      }
    } catch (err) {
      alert("Error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/saas/support/announcements/${id}`, { method: "DELETE" });
      if (res.ok) mutate();
    } catch (e) {
      alert("Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Megaphone className="w-7 h-7 text-amber-500" />
            Global Announcements
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Broadcast messages, updates, and maintenance alerts to all tenants.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-indigo-500/20 transition-all">
          <Plus className="w-4 h-4" />
          <span>New Announcement</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-slate-300 w-8 h-8"/></div>
      ) : announcements.length === 0 ? (
        <div className="p-10 text-center flex flex-col items-center border rounded-2xl bg-white dark:bg-slate-900 shadow-sm mt-4">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4"><BellRing className="w-8 h-8 text-slate-400"/></div>
          <h3 className="font-bold text-lg">No Announcements</h3>
          <p className="text-slate-500 max-w-sm mx-auto text-sm mt-2">Create an announcement to broadcast it to all tenant dashboards.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
          {announcements.map((a: any) => (
            <div key={a.id} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col relative group overflow-hidden">
              <div className="flex justify-between items-start mb-4 relative z-10">
                <AnnouncementBadge type={a.type} />
                <button 
                  onClick={() => handleDelete(a.id)}
                  disabled={deletingId === a.id}
                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {deletingId === a.id ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 relative z-10">{a.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 flex-1 relative z-10 whitespace-pre-wrap">{a.content}</p>
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-400 flex items-center gap-2 relative z-10">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                Posted on {format(new Date(a.createdAt), "MMM dd, yyyy")}
              </div>
              
              {/* Decorative Background Icon */}
              <div className="absolute -bottom-6 -right-6 opacity-[0.03] text-slate-900 dark:text-white pointer-events-none">
                {a.type === "INFO" && <Info className="w-40 h-40" />}
                {a.type === "WARNING" && <AlertTriangle className="w-40 h-40" />}
                {a.type === "MAINTENANCE" && <Settings className="w-40 h-40" />}
                {a.type === "PROMOTION" && <Megaphone className="w-40 h-40" />}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">New Announcement</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Title</label>
                <input required value={title} onChange={e => setTitle(e.target.value)} type="text" className="w-full text-sm px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" placeholder="e.g. System Maintenance" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Announcement Type</label>
                <select required value={type} onChange={e => setType(e.target.value)} className="w-full text-sm px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700">
                  <option value="INFO">Information</option>
                  <option value="WARNING">Warning</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="PROMOTION">Promotion</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Content</label>
                <textarea required value={content} onChange={e => setContent(e.target.value)} rows={4} className="w-full text-sm px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" placeholder="Details..."></textarea>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 mt-5">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button disabled={submitting} type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg flex items-center gap-2">
                  {submitting && <RefreshCw className="w-4 h-4 animate-spin" />} Broadcast
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AnnouncementBadge({ type }: { type: string }) {
  if (type === "INFO") return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"><Info className="w-3.5 h-3.5"/> Info</span>;
  if (type === "WARNING") return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"><AlertTriangle className="w-3.5 h-3.5"/> Warning</span>;
  if (type === "MAINTENANCE") return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"><Settings className="w-3.5 h-3.5"/> Maintenance</span>;
  if (type === "PROMOTION") return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400"><Megaphone className="w-3.5 h-3.5"/> Promotion</span>;
  return null;
}