"use client";

import { useEffect, useState } from "react";
import {
  MessageSquareText,
  Plus,
  Edit,
  Trash2,
  Eye,
  Check,
  Copy,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";
import { renderTemplate } from "@/lib/template-renderer";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [variables, setVariables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit / Create Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [type, setType] = useState("DUE_TODAY");
  const [language, setLanguage] = useState("ROMAN_URDU");
  const [body, setBody] = useState("");
  const [isActive, setIsActive] = useState(true);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
        setVariables(data.availableVariables || []);
      }
    } catch (err) {
      console.error("Failed to load templates", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const openCreateModal = () => {
    setEditId(null);
    setName("");
    setSlug("");
    setType("DUE_TODAY");
    setLanguage("ROMAN_URDU");
    setBody(
      "Assalam-o-Alaikum {{customer_name}},\n\nAap ki Rs. {{emi}} qist ki due date {{due_date}} hai (Account: {{account}}).\nBarah-e-karam waqt par payment clear karein.\n\nShukriya,\n{{recovery_person}}\nQistBazar"
    );
    setIsActive(true);
    setModalOpen(true);
  };

  const openEditModal = (t: any) => {
    setEditId(t.id);
    setName(t.name);
    setSlug(t.slug);
    setType(t.type);
    setLanguage(t.language);
    setBody(t.body);
    setIsActive(t.isActive);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name || !body) return;
    try {
      const url = editId ? `/api/templates/${editId}` : "/api/templates";
      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, type, language, body, isActive }),
      });

      if (res.ok) {
        setModalOpen(false);
        fetchTemplates();
      }
    } catch (err) {
      console.error("Failed to save template", err);
    }
  };

  const insertVariable = (token: string) => {
    setBody((prev) => prev + " " + token);
  };

  const samplePreview = renderTemplate(body, {
    customerName: "Mirza Amir Baig",
    account: "267000473",
    emi: 2900,
    balance: 10400,
    dueDate: new Date(),
    daysOverdue: 3,
    branch: "QBLAN",
    recoveryPerson: "Ghulam Ahmed",
    lastPaymentAmount: 2900,
    productName: "Itel P70",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <MessageSquareText className="w-5 h-5 text-emerald-500" />
            <span>WhatsApp Message Templates</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configurable Urdu and Roman Urdu reminder templates with live variable interpolation.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all hover:scale-105"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Template</span>
        </button>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Loading templates...</span>
          </div>
        ) : templates.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400">
            No templates configured yet. Click "New Template" to add one.
          </div>
        ) : (
          templates.map((tmpl) => (
            <div
              key={tmpl.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{tmpl.name}</h3>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 font-mono font-semibold">
                        {tmpl.type}
                      </span>
                      <span>•</span>
                      <span>{tmpl.language}</span>
                    </div>
                  </div>
                  <span
                    className={clsx(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold",
                      tmpl.isActive
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-500"
                    )}
                  >
                    {tmpl.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line max-h-48 overflow-y-auto leading-relaxed">
                  {tmpl.body}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {tmpl._count?.reminderRules || 0} automated rule(s)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEditModal(tmpl)}
                    className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Edit Template"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquareText className="w-4 h-4 text-emerald-500" />
                <span>{editId ? "Edit Message Template" : "Create New Message Template"}</span>
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 text-lg font-bold">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Due Date Urgent Reminder"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Template Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300"
                >
                  <option value="BEFORE_DUE">BEFORE_DUE (Upcoming)</option>
                  <option value="DUE_TODAY">DUE_TODAY</option>
                  <option value="OVERDUE">OVERDUE (Follow-up)</option>
                  <option value="PAYMENT_RECEIVED">PAYMENT_RECEIVED (Confirmation)</option>
                  <option value="CUSTOM">CUSTOM</option>
                </select>
              </div>
            </div>

            {/* Variable Insertion Pills */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Click to Insert Variable Token
              </label>
              <div className="flex flex-wrap gap-1.5">
                {variables.map((v) => (
                  <button
                    key={v.token}
                    type="button"
                    onClick={() => insertVariable(v.token)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-colors"
                  >
                    + {v.token}
                  </button>
                ))}
              </div>
            </div>

            {/* Template Body */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Template Message Body (Urdu / Roman Urdu)
              </label>
              <textarea
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>

            {/* Live Sample Preview Render */}
            <div className="p-3.5 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase">
                <Sparkles className="w-3 h-3" />
                <span>Live Sample Customer Render Preview</span>
              </div>
              <p className="text-xs whitespace-pre-line text-slate-300 font-sans leading-relaxed">
                {samplePreview}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
