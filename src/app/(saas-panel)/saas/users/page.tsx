"use client";

import { useState } from "react";
import useSWR from "swr";
import { Users, Plus, Shield, Search, Key, Edit, Trash2, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function SaaSUsersPage() {
  const { data, error, isLoading, mutate } = useSWR("/api/saas/users", fetcher);
  const users = data?.users || [];

  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [globalRole, setGlobalRole] = useState("SAAS_ADMIN");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/saas/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, globalRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");
      
      mutate();
      setShowModal(false);
      setName("");
      setEmail("");
      setPassword("");
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-indigo-500" />
            SaaS User Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage global administrators, support agents, and their access levels.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-indigo-500/20 transition-all">
          <Plus className="w-4 h-4" />
          <span>Invite SaaS User</span>
        </button>
      </div>

      {error ? (
        <div className="p-4 bg-rose-50 text-rose-600 rounded-xl flex items-center gap-2 border border-rose-200">
          <AlertTriangle className="w-5 h-5"/> Failed to load users.
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-20"><RefreshCw className="w-8 h-8 animate-spin text-slate-300"/></div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 rounded-lg">
                  <Users className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium text-slate-500">Total Users</p>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{users.length}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 rounded-lg">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium text-slate-500">Active Sessions</p>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{users.filter((u:any) => u.isActive).length}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-50 dark:bg-purple-500/10 text-purple-500 rounded-lg">
                  <Shield className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium text-slate-500">Super Admins</p>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{users.filter((u:any) => u.globalRole === 'SUPER_ADMIN').length}</p>
            </div>
          </div>

          {/* Main Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50">
              <div className="relative w-full max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Search users..." 
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <Link href="/saas/users/roles" className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                Manage Roles
              </Link>
            </div>

            {users.length === 0 ? (
              <div className="p-10 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4"><Users className="w-8 h-8 text-slate-400"/></div>
                <h3 className="font-bold text-lg">No SaaS Users Found</h3>
                <p className="text-slate-500 max-w-sm mx-auto text-sm mt-2">There are currently no users with SaaS administration privileges in the database.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-100 dark:border-slate-800">
                      <th className="p-4 px-6">User</th>
                      <th className="p-4">Global Role</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Last Login</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm">
                    {users.map((user:any) => (
                      <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="p-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                              {user.name ? user.name.charAt(0) : 'U'}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">{user.name || 'Unnamed'}</p>
                              <p className="text-[11px] text-slate-500">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            <Shield className="w-3 h-3 text-indigo-500" />
                            {user.globalRole?.replace('_', ' ') || 'NONE'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={clsx(
                            "text-[10px] uppercase font-bold px-2 py-1 rounded-full",
                            user.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          )}>
                            {user.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="p-4 text-slate-500 text-xs">
                          {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors">
                              <Key className="w-4 h-4" />
                            </button>
                            <button className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={async () => {
                              if (confirm(`Are you sure you want to delete ${user.name || user.email}?`)) {
                                try {
                                  const res = await fetch(`/api/saas/users/${user.id}`, { method: 'DELETE' });
                                  const result = await res.json();
                                  if (!res.ok) throw new Error(result.error || 'Failed to delete');
                                  mutate(); // refresh the list
                                } catch (err: any) {
                                  alert(err.message);
                                }
                              }
                            }} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Invite User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Invite SaaS User</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 text-rose-600 text-xs rounded-lg border border-rose-200">{formError}</div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input required value={name} onChange={e => setName(e.target.value)} type="text" className="w-full text-sm px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" placeholder="Jane Doe" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                <input required value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full text-sm px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" placeholder="jane@qistflow.com" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Temporary Password</label>
                <input required value={password} onChange={e => setPassword(e.target.value)} type="text" className="w-full text-sm px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" placeholder="SecurePass123!" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Global Role</label>
                <select required value={globalRole} onChange={e => setGlobalRole(e.target.value)} className="w-full text-sm px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700">
                  <option value="SAAS_ADMIN">SaaS Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="SUPPORT_AGENT">Support Agent</option>
                  <option value="BILLING_MANAGER">Billing Manager</option>
                </select>
              </div>
              
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 mt-5">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button disabled={submitting} type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg flex items-center gap-2">
                  {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Send Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
