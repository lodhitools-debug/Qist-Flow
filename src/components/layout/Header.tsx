"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Bell,
  LogOut,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  RefreshCw,
  PlusCircle,
  FileSpreadsheet,
  Send,
  Menu,
  WifiOff,
  Wifi,
} from "lucide-react";
import clsx from "clsx";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getClientSession } from "@/lib/client-auth";

interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

export default function Header({ onToggleMobileMenu }: HeaderProps) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [waStatus, setWaStatus] = useState<string>("DISCONNECTED");
  const [waPhone, setWaPhone] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const { isOnline, showReconnected } = useOnlineStatus();

  const fetchSession = async () => {
    try {
      const data = await getClientSession();
      if (data?.user) {
        setUser(data.user);
      }
    } catch {}
  };

  const fetchWAStatus = async () => {
    try {
      const res = await fetch(`/api/whatsapp/status?t=${Date.now()}`, {
        cache: "no-store",
        headers: { Pragma: "no-cache" },
      });
      if (res.ok) {
        const data = await res.json();
        setWaStatus(data.status || "NOT_CONNECTED");
        setWaPhone(data.phone || "");
      }
    } catch {}
  };

  useEffect(() => {
    fetchSession();
    fetchWAStatus();
    // Poll every 30s — the connection page handles real-time updates
    const interval = setInterval(fetchWAStatus, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    window.location.href = "/login";
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchSession(), fetchWAStatus()]);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <>
      {/* Network Offline / Reconnection Banner */}
      {!isOnline && (
        <div className="bg-rose-600 text-white text-xs px-4 py-2 flex items-center justify-center gap-2 font-semibold shadow-md animate-in slide-in-from-top z-50">
          <WifiOff className="w-4 h-4 animate-bounce" />
          <span>You are offline. Live ledger updates and WhatsApp dispatch are paused.</span>
        </div>
      )}

      {showReconnected && (
        <div className="bg-emerald-600 text-white text-xs px-4 py-2 flex items-center justify-center gap-2 font-semibold shadow-md animate-in slide-in-from-top z-50">
          <Wifi className="w-4 h-4" />
          <span>Internet connection restored! Resuming live sync...</span>
        </div>
      )}

      <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 px-3 sm:px-6 flex items-center justify-between">
        {/* Left Side: Mobile Menu Button & Search */}
        <div className="flex items-center gap-2 sm:gap-4 flex-1 max-w-md">
          {/* Mobile Hamburger Toggle (44px touch target) */}
          <button
            type="button"
            onClick={onToggleMobileMenu}
            aria-label="Toggle navigation menu"
            className="md:hidden flex items-center justify-center w-11 h-11 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search Input */}
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search customer, CNIC, phone..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  router.push(`/customers?search=${encodeURIComponent((e.target as HTMLInputElement).value)}`);
                }
              }}
              className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl pl-8 sm:pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>
        </div>

        {/* Action Center & Profile */}
        <div className="flex items-center gap-1.5 sm:gap-3 ml-2">
          {/* Desktop Shortcuts */}
          <Link
            href="/imports"
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Import Excel</span>
          </Link>

          <Link
            href="/recovery/send-reminders"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-emerald-600 text-white hover:bg-slate-800 transition-colors shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Send Reminders</span>
            <span className="md:hidden">Remind</span>
          </Link>

          {/* WhatsApp Live Status Pill */}
          <Link
            href="/whatsapp/connection"
            title="WhatsApp Connection Status"
            className={clsx(
              "flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold border transition-all hover:scale-105 min-h-[36px]",
              waStatus === "CONNECTED"
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700"
                : waStatus === "CONNECTING" || waStatus === "QR_READY" || waStatus === "INIT_QR" || waStatus === "RECONNECTING"
                ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700"
                : "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-700"
            )}
          >
            <span
              className={clsx(
                "w-2 h-2 rounded-full",
                waStatus === "CONNECTED"
                  ? "bg-emerald-500 animate-pulse"
                  : waStatus === "CONNECTING" || waStatus === "QR_READY"
                  ? "bg-amber-500 animate-ping"
                  : "bg-rose-500"
              )}
            />
            <QrCode className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {waStatus === "CONNECTED"
                ? `WhatsApp Active ${waPhone ? `(${waPhone})` : ""}`
                : waStatus === "QR_READY"
                ? "Scan QR Code"
                : waStatus === "CONNECTING"
                ? "Connecting..."
                : "WhatsApp Offline"}
            </span>
          </Link>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            title="Refresh Data"
            className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={clsx("w-4 h-4", isRefreshing && "animate-spin text-emerald-500")} />
          </button>

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 pl-1.5 pr-2 sm:pr-3 py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 min-h-[44px]"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                {user?.name ? user.name[0].toUpperCase() : "A"}
              </div>
              <div className="text-left hidden md:block">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-none">
                  {user?.name || "Super Admin"}
                </div>
                <div className="text-[10px] text-slate-400 font-medium leading-none mt-1">
                  {user?.role || "ADMIN"} • {user?.branch || "QBLAN"}
                </div>
              </div>
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 text-xs animate-in fade-in zoom-in-95">
                <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-700/60">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">{user?.name}</div>
                  <div className="text-slate-400 text-[11px] truncate">{user?.email || "admin@qistflow.com"}</div>
                </div>

                <Link
                  href="/profile"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-3.5 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <User className="w-3.5 h-3.5 text-emerald-500" />
                  <span>My Profile & Password</span>
                </Link>

                <Link
                  href="/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-3.5 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Account Settings</span>
                </Link>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-left font-medium"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
