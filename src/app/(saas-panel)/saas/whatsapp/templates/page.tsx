"use client";

import { useState } from "react";
import useSWR from "swr";
import { MessageSquare, RefreshCw, Plus, Trash2, Globe } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function GlobalTemplatesPage() {
  const { data, isLoading, mutate } = useSWR("/api/saas/whatsapp/templates", fetcher);
  const templates = data?.templates || [];

  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({ name: "", type: "DUE_TODAY", body: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/saas/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to create template");
      
      setFormData({ name: "", type: "DUE_TODAY", body: "" });
      setIsCreating(false);
      mutate();
    } catch (err) {
      alert("Error creating template");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this global template?")) return;
    try {
      await fetch(`/api/saas/whatsapp/templates/${id}`, { method: "DELETE" });
      mutate();
    } catch (err) {
      alert("Error deleting template");
    }
  };

  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Globe className="text-indigo-500" />
            Global WhatsApp Templates
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Templates created here will be automatically distributed and available to all tenants.
          </p>
        </div>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium transition-colors"
        >
          {isCreating ? "Cancel" : <><Plus className="w-4 h-4" /> Add Template</>}
        </button>
      </div>

      {isCreating && (
        <div className="bg-white border rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">Create Global Template</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Template Name</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. Due Today Notice"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Trigger Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                >
                  <option value="DUE_TODAY">Due Today</option>
                  <option value="OVERDUE">Overdue</option>
                  <option value="BEFORE_DUE">Before Due</option>
                  <option value="PAYMENT_RECEIVED">Payment Received</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Message Body</label>
              <textarea
                required
                rows={5}
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                className="w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                placeholder="Salam {{customerName}}, aap ki qist {{amount}} aaj due hai..."
              />
              <p className="text-xs text-slate-400 mt-1">
                Available variables: {'{{customerName}}'}, {'{{amount}}'}, {'{{dueDate}}'}, {'{{branchName}}'}, {'{{remainingAmount}}'}
              </p>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : "Save Global Template"}
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center p-10">
          <RefreshCw className="animate-spin text-slate-300 w-8 h-8" />
        </div>
      ) : templates.length === 0 ? (
        <div className="p-10 text-center border rounded-2xl bg-white shadow-sm text-slate-500 flex flex-col items-center">
          <MessageSquare className="w-10 h-10 text-slate-300 mb-3" />
          No global templates found. Create one above to distribute to all branches.
        </div>
      ) : (
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          {templates.map((t: any) => (
            <div key={t.id} className="border-b last:border-0 p-5 flex flex-col sm:flex-row justify-between gap-4 group hover:bg-slate-50 transition-colors">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-slate-800">{t.name}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">
                    {t.type}
                  </span>
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{t.body}</p>
              </div>
              <div className="flex items-start">
                <button
                  onClick={() => handleDelete(t.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete Global Template"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}