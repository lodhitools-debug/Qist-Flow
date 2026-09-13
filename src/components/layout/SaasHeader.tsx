"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, Menu, User, ShieldCheck } from "lucide-react";
import { getClientSession } from "@/lib/client-auth";

interface SaasHeaderProps {
  onToggleMobileMenu?: () => void;
}

export default function SaasHeader({ onToggleMobileMenu }: SaasHeaderProps) {
  const [user, setUser] = useState<any>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    getClientSession().then((data) => {
      if (data?.user) {
        setUser(data.user);
      }
    });
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    window.location.href = "/saas/login";
  };

  return (
    <header className="h-16 shrink-0 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6 relative z-30 transition-colors">
      
      {/* Left side: Mobile Menu Toggle */}
      <div className="flex items-center gap-3 lg:gap-4">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="hidden lg:flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-500" />
          <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">Enterprise Administration</span>
        </div>
      </div>

      {/* Right side: Global Actions & User Menu */}
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 sm:gap-3 p-1.5 sm:pr-3 rounded-full sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 shrink-0 shadow-inner">
              <User className="w-4 h-4" />
            </div>
            {user && (
              <div className="hidden sm:block text-left mr-1">
                <p className="text-[13px] font-bold text-slate-700 dark:text-slate-200 leading-tight">
                  {user.name || "Super Admin"}
                </p>
                <p className="text-[10px] text-slate-500 font-medium tracking-wide">
                  ENTERPRISE
                </p>
              </div>
            )}
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl shadow-slate-200/20 dark:shadow-black/40 overflow-hidden animate-in fade-in slide-in-from-top-2">
              <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{user?.name || "Super Admin"}</p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
              </div>
              <div className="p-1.5">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 dark:text-rose-400 font-medium hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Click outside to close user menu (invisible overlay) */}
      {userMenuOpen && (
        <div 
          className="fixed inset-0 z-[-1]" 
          onClick={() => setUserMenuOpen(false)}
        />
      )}
    </header>
  );
}
