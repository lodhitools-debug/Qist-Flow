"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  PhoneCall,
  QrCode,
  Menu,
  X,
  FileSpreadsheet,
  BarChart3,
  UserCheck,
  Settings,
  Activity,
  Briefcase,
  User,
  Shield,
  CreditCard,
  Send,
} from "lucide-react";
import clsx from "clsx";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setCurrentUser(data.user);
      })
      .catch(() => {});
  }, []);

  // Close sheet on navigation
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const userRole = currentUser?.role || "ADMIN";

  const isHomeActive = pathname === "/";
  const isCustomersActive = pathname.startsWith("/customers");
  const isRecoveryActive = pathname.startsWith("/recovery");
  const isWhatsAppActive = pathname.startsWith("/whatsapp");
  const isMoreActive =
    moreOpen ||
    pathname.startsWith("/imports") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/team") ||
    pathname.startsWith("/users") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/system-health");

  return (
    <>
      {/* Fixed Bottom Navigation Bar (Visible only on mobile < md) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 text-slate-400 select-none pb-safe">
        <div className="grid grid-cols-5 h-16 max-w-lg mx-auto">
          {/* Home */}
          <Link
            href="/"
            className={clsx(
              "flex flex-col items-center justify-center gap-1 transition-colors min-h-[48px]",
              isHomeActive ? "text-emerald-400 font-bold" : "hover:text-slate-200"
            )}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px]">Home</span>
          </Link>

          {/* Customers */}
          <Link
            href="/customers"
            className={clsx(
              "flex flex-col items-center justify-center gap-1 transition-colors min-h-[48px]",
              isCustomersActive ? "text-emerald-400 font-bold" : "hover:text-slate-200"
            )}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px]">Customers</span>
          </Link>

          {/* Recovery */}
          <Link
            href="/recovery"
            className={clsx(
              "flex flex-col items-center justify-center gap-1 transition-colors min-h-[48px]",
              isRecoveryActive ? "text-emerald-400 font-bold" : "hover:text-slate-200"
            )}
          >
            <PhoneCall className="w-5 h-5" />
            <span className="text-[10px]">Recovery</span>
          </Link>

          {/* WhatsApp */}
          <Link
            href="/whatsapp/connection"
            className={clsx(
              "flex flex-col items-center justify-center gap-1 transition-colors min-h-[48px]",
              isWhatsAppActive ? "text-emerald-400 font-bold" : "hover:text-slate-200"
            )}
          >
            <QrCode className="w-5 h-5" />
            <span className="text-[10px]">WhatsApp</span>
          </Link>

          {/* More */}
          <button
            type="button"
            onClick={() => setMoreOpen(!moreOpen)}
            className={clsx(
              "flex flex-col items-center justify-center gap-1 transition-colors min-h-[48px]",
              isMoreActive ? "text-emerald-400 font-bold" : "hover:text-slate-200"
            )}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px]">More</span>
          </button>
        </div>
      </nav>

      {/* Slide-Up "More" Menu Sheet */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm animate-in fade-in">
          {/* Backdrop click to close */}
          <div className="flex-1" onClick={() => setMoreOpen(false)} />

          <div className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                  Q
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">QistFlow Navigation</h3>
                  <p className="text-[10px] text-slate-400">
                    Logged in as <strong className="text-emerald-400">{currentUser?.name || "Staff"}</strong> ({userRole})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Links Grid */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <Link
                href="/installments"
                className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-200 hover:bg-slate-700"
              >
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span>Installments</span>
              </Link>

              <Link
                href="/recovery/send-reminders"
                className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-200 hover:bg-slate-700"
              >
                <Send className="w-4 h-4 text-teal-400" />
                <span>Send Reminders</span>
              </Link>

              {(userRole === "ADMIN" || userRole === "MANAGER") && (
                <Link
                  href="/team"
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-200 hover:bg-slate-700"
                >
                  <Briefcase className="w-4 h-4 text-indigo-400" />
                  <span>Team Portfolio</span>
                </Link>
              )}

              {(userRole === "ADMIN" || userRole === "MANAGER") && (
                <Link
                  href="/imports"
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-200 hover:bg-slate-700"
                >
                  <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                  <span>Import Excel</span>
                </Link>
              )}

              <Link
                href="/reports"
                className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-200 hover:bg-slate-700"
              >
                <BarChart3 className="w-4 h-4 text-purple-400" />
                <span>Reports</span>
              </Link>

              {(userRole === "ADMIN" || userRole === "MANAGER") && (
                <Link
                  href="/users"
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-200 hover:bg-slate-700"
                >
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span>Users & Staff</span>
                </Link>
              )}

              {userRole === "ADMIN" && (
                <Link
                  href="/system-health"
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-200 hover:bg-slate-700"
                >
                  <Activity className="w-4 h-4 text-rose-400" />
                  <span>System Health</span>
                </Link>
              )}

              {userRole === "ADMIN" && (
                <Link
                  href="/settings"
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-200 hover:bg-slate-700"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>Settings</span>
                </Link>
              )}

              <Link
                href="/profile"
                className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-200 hover:bg-slate-700 col-span-2"
              >
                <User className="w-4 h-4 text-emerald-400" />
                <span>My Profile & Password</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
