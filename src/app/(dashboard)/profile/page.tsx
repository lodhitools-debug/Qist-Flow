"use client";

import { useEffect, useState } from "react";
import {
  User,
  Shield,
  Key,
  Building,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Briefcase,
  Save,
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

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdNotice, setPwdNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/auth/me");
      const data = await safeJsonParse(res);
      if (res.ok && data.user) {
        setUser(data.user);
      }
    } catch (err) {
      console.error("Failed to load profile", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdNotice(null);

    if (newPassword.length < 6) {
      setPwdNotice({ type: "error", text: "New password must be at least 6 characters long" });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwdNotice({ type: "error", text: "New passwords do not match" });
      return;
    }

    try {
      setPwdLoading(true);
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await safeJsonParse(res);
      if (res.ok && data.success) {
        setPwdNotice({ type: "success", text: "Password updated successfully!" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPwdNotice({ type: "error", text: data.error || "Failed to update password" });
      }
    } catch (err: any) {
      setPwdNotice({ type: "error", text: err.message || "Failed to change password" });
    } finally {
      setPwdLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-slate-400">
        Loading user profile...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
          <User className="w-6 h-6 text-emerald-500" />
          <span>User Profile & Security</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          View your staff credentials, role permissions, and manage your account password.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="md:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 text-white font-extrabold text-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            {user?.name?.substring(0, 2).toUpperCase() || "QF"}
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {user?.name}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
          </div>

          <div className="pt-2">
            {user?.role === "ADMIN" && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                <Shield className="w-3.5 h-3.5" />
                <span>System Administrator</span>
              </span>
            )}
            {user?.role === "MANAGER" && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                <Briefcase className="w-3.5 h-3.5" />
                <span>Recovery Team Manager</span>
              </span>
            )}
            {user?.role === "RECOVERY_OFFICER" && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <User className="w-3.5 h-3.5" />
                <span>Recovery Officer</span>
              </span>
            )}
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 text-xs text-left space-y-2.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Branch:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{user?.branch || "MAIN"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Employee Code:</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{user?.employeeCode || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Department:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{user?.department || "Recovery"}</span>
            </div>
            {user?.manager && (
              <div className="flex justify-between">
                <span className="text-slate-400">Manager:</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">{user.manager.name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-400">Last Login:</span>
              <span className="text-slate-600 dark:text-slate-300">{user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "First Session"}</span>
            </div>
          </div>
        </div>

        {/* Change Password Form */}
        <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-500" />
              <span>Change Password</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your current password and choose a new secure password.
            </p>
          </div>

          {pwdNotice && (
            <div
              className={clsx(
                "p-3 rounded-xl border text-xs flex items-center gap-2",
                pwdNotice.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                  : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
              )}
            >
              {pwdNotice.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{pwdNotice.text}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Current Password *
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  New Password *
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={pwdLoading}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-all hover:scale-105"
              >
                {pwdLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Update Password</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
