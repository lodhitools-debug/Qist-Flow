"use client";

import { useEffect, useState } from "react";
import {
  UserCheck,
  Plus,
  Edit,
  Trash2,
  Shield,
  RefreshCw,
  Lock,
  Mail,
  User,
  Phone,
  Building,
  CheckCircle2,
  AlertTriangle,
  Search,
  Key,
  Users,
  Copy,
  Check,
  X,
  Eye,
  Briefcase,
} from "lucide-react";
import clsx from "clsx";

async function safeJsonParse(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return {
      success: false,
      error: `Server HTTP ${res.status}: ${text.slice(0, 200)}`,
    };
  }
}

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [managerFilter, setManagerFilter] = useState("ALL");

  // Modal State (Create / Edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("RECOVERY_OFFICER");
  const [branch, setBranch] = useState("MAIN");
  const [phone, setPhone] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [department, setDepartment] = useState("Recovery");
  const [managerId, setManagerId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Success Password Modal
  const [tempPasswordNotice, setTempPasswordNotice] = useState<{ name: string; email: string; pass: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await safeJsonParse(res);
      if (res.ok && data.user) {
        setCurrentUser(data.user);
      }
    } catch {}
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        search,
        role: roleFilter,
        status: statusFilter,
        managerId: managerFilter,
      });

      const res = await fetch(`/api/users?${params.toString()}`);
      const data = await safeJsonParse(res);
      if (res.ok && data.users) {
        setUsers(data.users);
        if (data.managers) setManagers(data.managers);
      }
    } catch (err) {
      console.error("Failed to load users", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [search, roleFilter, statusFilter, managerFilter]);

  const openCreateModal = () => {
    setEditId(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole(currentUser?.role === "MANAGER" ? "RECOVERY_OFFICER" : "RECOVERY_OFFICER");
    setBranch("MAIN");
    setPhone("");
    setEmployeeCode("");
    setDepartment("Recovery");
    setManagerId(currentUser?.role === "MANAGER" ? currentUser.id : "");
    setIsActive(true);
    setModalError(null);
    setModalOpen(true);
  };

  const openEditModal = (u: any) => {
    setEditId(u.id);
    setName(u.name);
    setEmail(u.email);
    setPassword("");
    setRole(u.role);
    setBranch(u.branch || "MAIN");
    setPhone(u.phone || "");
    setEmployeeCode(u.employeeCode || "");
    setDepartment(u.department || "Recovery");
    setManagerId(u.managerId || "");
    setIsActive(u.isActive);
    setModalError(null);
    setModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!name.trim() || !email.trim()) {
      setModalError("Name and Email are required");
      return;
    }

    try {
      setSubmitting(true);
      setModalError(null);

      const url = editId ? `/api/users/${editId}` : "/api/users";
      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password: password.trim() || undefined,
          role,
          branch,
          phone: phone.trim() || undefined,
          employeeCode: employeeCode.trim() || undefined,
          department: department.trim() || undefined,
          managerId: managerId || undefined,
          isActive,
        }),
      });

      const data = await safeJsonParse(res);
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save user");
      }

      setModalOpen(false);
      fetchUsers();

      if (data.temporaryPassword) {
        setTempPasswordNotice({
          name: data.user.name,
          email: data.user.email,
          pass: data.temporaryPassword,
        });
      }
    } catch (err: any) {
      setModalError(err.message || "Failed to save user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (u: any) => {
    if (!confirm(`Are you sure you want to force reset password for ${u.name}?`)) return;

    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetPassword: true }),
      });

      const data = await safeJsonParse(res);
      if (res.ok && data.temporaryPassword) {
        setTempPasswordNotice({
          name: u.name,
          email: u.email,
          pass: data.temporaryPassword,
        });
        fetchUsers();
      } else {
        alert("Reset failed: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleToggleStatus = async (u: any) => {
    try {
      const nextStatus = !u.isActive;
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextStatus }),
      });

      const data = await safeJsonParse(res);
      if (res.ok && data.success) {
        fetchUsers();
      } else {
        alert("Status update failed: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.isActive).length;
  const totalManagers = users.filter((u) => u.role === "MANAGER").length;
  const totalOfficers = users.filter((u) => u.role === "RECOVERY_OFFICER").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <UserCheck className="w-6 h-6 text-emerald-500" />
            <span>User Management & RBAC</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage Admin, Manager, and Recovery Officer accounts, team hierarchies, and access controls.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all hover:scale-105"
        >
          <Plus className="w-4 h-4" />
          <span>Create User</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Staff</span>
          <span className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 block">{totalUsers}</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/40 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">Active Accounts</span>
          <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block">{activeUsers}</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 block">Managers</span>
          <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1 block">{totalManagers}</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-purple-100 dark:border-purple-900/40 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400 block">Recovery Officers</span>
          <span className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 mt-1 block">{totalOfficers}</span>
        </div>
      </div>

      {/* Toolbar Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, email, code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="MANAGER">Manager</option>
            <option value="RECOVERY_OFFICER">Recovery Officer</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>

          {/* Manager Filter for Admin */}
          {currentUser?.role === "ADMIN" && managers.length > 0 && (
            <select
              value={managerFilter}
              onChange={(e) => setManagerFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              <option value="ALL">All Teams / Managers</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  Team: {m.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={fetchUsers}
            title="Refresh"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Manager / Team</th>
                <th className="py-3 px-4">Assigned Portfolio</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    No users match the selected criteria.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    {/* User Info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-xs flex-shrink-0">
                          {u.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {u.name}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {u.employeeCode ? `Code: ${u.employeeCode}` : u.branch || "MAIN"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="py-3 px-4">
                      <span className="text-slate-800 dark:text-slate-200 block font-medium">{u.email}</span>
                      <span className="font-mono text-[11px] text-slate-400">{u.phone || "—"}</span>
                    </td>

                    {/* Role */}
                    <td className="py-3 px-4">
                      {u.role === "ADMIN" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          <Shield className="w-3 h-3" />
                          <span>Admin</span>
                        </span>
                      )}
                      {u.role === "MANAGER" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          <Briefcase className="w-3 h-3" />
                          <span>Manager</span>
                        </span>
                      )}
                      {u.role === "RECOVERY_OFFICER" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <User className="w-3 h-3" />
                          <span>Recovery Officer</span>
                        </span>
                      )}
                    </td>

                    {/* Manager / Team */}
                    <td className="py-3 px-4">
                      {u.role === "RECOVERY_OFFICER" ? (
                        u.manager ? (
                          <span className="text-slate-800 dark:text-slate-200 font-semibold">
                            {u.manager.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Unassigned Manager</span>
                        )
                      ) : u.role === "MANAGER" ? (
                        <span className="text-indigo-600 dark:text-indigo-400 text-[11px] font-bold">
                          {u._count?.subordinates || 0} Officers in Team
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>

                    {/* Assigned Portfolio */}
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {u._count?.assignedCustomers || 0} Customers
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleStatus(u)}
                        className={clsx(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors",
                          u.isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200"
                        )}
                      >
                        {u.isActive ? "● Active" : "○ Inactive"}
                      </button>
                    </td>

                    {/* Last Login */}
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleResetPassword(u)}
                          title="Force Password Reset"
                          className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/60 border border-amber-200 dark:border-amber-800 transition-colors"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(u)}
                          title="Edit User"
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT USER MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-500" />
                <span>{editId ? "Edit Staff User" : "Create New Staff User"}</span>
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Muhammad Farhan"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    placeholder="farhan@qistbazar.pk"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="03001234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Employee Code
                  </label>
                  <input
                    type="text"
                    placeholder="EMP-104"
                    value={employeeCode}
                    onChange={(e) => setEmployeeCode(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    System Role
                  </label>
                  <select
                    disabled={currentUser?.role !== "ADMIN"}
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="RECOVERY_OFFICER">Recovery Officer</option>
                    {currentUser?.role === "ADMIN" && <option value="MANAGER">Manager</option>}
                    {currentUser?.role === "ADMIN" && <option value="ADMIN">Admin</option>}
                  </select>
                </div>

                {role === "RECOVERY_OFFICER" && currentUser?.role === "ADMIN" && (
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Assigned Manager
                    </label>
                    <select
                      value={managerId}
                      onChange={(e) => setManagerId(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                    >
                      <option value="">-- No Manager (Independent) --</option>
                      {managers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.branch || "MAIN"})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {!editId && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Initial Password (Leave blank to auto-generate)
                  </label>
                  <input
                    type="password"
                    placeholder="Auto-generated secure password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    User will be required to change this password upon first login.
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSaveUser}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                {submitting ? "Saving..." : editId ? "Update User" : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEMPORARY PASSWORD COPY MODAL */}
      {tempPasswordNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-center animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto">
              <Key className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Temporary Credentials Generated
            </h3>

            <p className="text-xs text-slate-500">
              Please copy and provide these credentials to <strong>{tempPasswordNotice.name}</strong>. The user will be required to change their password upon first login.
            </p>

            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-left space-y-1.5 font-mono text-xs">
              <div className="text-slate-500">
                Email: <strong className="text-slate-900 dark:text-white">{tempPasswordNotice.email}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>
                  Password: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{tempPasswordNotice.pass}</strong>
                </span>
                <button
                  onClick={() => copyToClipboard(`Email: ${tempPasswordNotice.email}\nPassword: ${tempPasswordNotice.pass}`)}
                  className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-[10px] font-bold flex items-center gap-1"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>

            <button
              onClick={() => setTempPasswordNotice(null)}
              className="w-full py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm"
            >
              Done / Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
