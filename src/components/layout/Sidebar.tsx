"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  PhoneCall,
  Send,
  QrCode,
  History,
  FileSpreadsheet,
  BarChart3,
  UserCheck,
  Settings,
  MessageSquareText,
  ChevronDown,
  Layers,
  Activity,
  Briefcase,
  User,
  Shield,
  X,
  Building,
  ShieldAlert,
  CalendarClock,
  Database,
} from "lucide-react";
import { useEffect, useState, Suspense } from "react";
import clsx from "clsx";

interface NavItem {
  title: string;
  href?: string;
  icon: any;
  badge?: string;
  children?: { title: string; href: string; badge?: string }[];
  allowedRoles?: ("ADMIN" | "MANAGER" | "RECOVERY_OFFICER")[];
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

function SidebarContent({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [waExpanded, setWaExpanded] = useState(true);
  const [importsExpanded, setImportsExpanded] = useState(true);
  const [recoveryExpanded, setRecoveryExpanded] = useState(true);
  const [settingsExpanded, setSettingsExpanded] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setCurrentUser(data.user);
      })
      .catch(() => {});
  }, []);

  // Close mobile drawer on navigation
  useEffect(() => {
    if (onClose) onClose();
  }, [pathname, searchParams]);

  const userRole = currentUser?.role || "ADMIN";

  const allNavItems: NavItem[] = [
    {
      title: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
      allowedRoles: ["ADMIN", "MANAGER", "RECOVERY_OFFICER"],
    },
    {
      title: "Customers",
      href: "/customers",
      icon: Users,
      allowedRoles: ["ADMIN", "MANAGER", "RECOVERY_OFFICER"],
    },
    {
      title: "Installments",
      href: "/installments",
      icon: CreditCard,
      allowedRoles: ["ADMIN", "MANAGER", "RECOVERY_OFFICER"],
    },
    {
      title: "Team Portfolio",
      href: "/team",
      icon: Briefcase,
      badge: "Team",
      allowedRoles: ["ADMIN", "MANAGER"],
    },
    {
      title: "Recovery",
      icon: PhoneCall,
      allowedRoles: ["ADMIN", "MANAGER", "RECOVERY_OFFICER"],
      children: [
        { title: "Recovery Workspace", href: "/recovery" },
        { title: "Send Reminders", href: "/recovery/send-reminders", badge: "Bulk" },
        { title: "Escalation Approvals", href: "/recovery/approvals", badge: "New" },
      ],
    },
    {
      title: "WhatsApp",
      icon: QrCode,
      allowedRoles: ["ADMIN", "MANAGER", "RECOVERY_OFFICER"],
      children: [
        { title: "Connection", href: "/whatsapp/connection" },
        { title: "Message History", href: "/whatsapp/message-history" },
        { title: "Templates", href: "/whatsapp/templates" },
      ],
    },
    {
      title: "Imports",
      icon: FileSpreadsheet,
      allowedRoles: ["ADMIN", "MANAGER"],
      children: [
        { title: "Import Excel", href: "/imports" },
        { title: "Import History", href: "/imports/history" },
      ],
    },
    {
      title: "Reports",
      href: "/reports",
      icon: BarChart3,
      allowedRoles: ["ADMIN", "MANAGER", "RECOVERY_OFFICER"],
    },
    {
      title: "System Health",
      href: "/system-health",
      icon: Activity,
      allowedRoles: ["ADMIN"],
    },
    {
      title: "Users",
      href: "/users",
      icon: UserCheck,
      allowedRoles: ["ADMIN", "MANAGER"],
    },
    {
      title: "Settings",
      icon: Settings,
      allowedRoles: ["ADMIN"],
      children: [
        { title: "Business Profile", href: "/settings?tab=BUSINESS" },
        { title: "WhatsApp Anti-Ban", href: "/settings?tab=WHATSAPP" },
        { title: "Guarantor Escalation", href: "/settings?tab=ESCALATION" },
        { title: "Reminder Schedules", href: "/settings?tab=RULES" },
        { title: "Database Backups", href: "/settings?tab=BACKUP" },
      ],
    },
    {
      title: "My Profile",
      href: "/profile",
      icon: User,
      allowedRoles: ["ADMIN", "MANAGER", "RECOVERY_OFFICER"],
    },
  ];

  const navItems = allNavItems.filter((item) =>
    item.allowedRoles ? item.allowedRoles.includes(userRole) : true
  );

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-950/40">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            Q
          </div>
          <div>
            <div className="font-extrabold text-white text-lg tracking-tight leading-none flex items-center gap-1.5">
              QistFlow
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                PRO
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium tracking-wide">
              Smart Recovery
            </div>
          </div>
        </Link>

        {/* Mobile close button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="md:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 custom-scrollbar text-xs">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href ? pathname === item.href : false;

          // Submenu Tree
          if (item.children) {
            let isExpanded = false;
            let toggleExpanded = () => {};

            if (item.title === "WhatsApp") {
              isExpanded = waExpanded;
              toggleExpanded = () => setWaExpanded(!waExpanded);
            } else if (item.title === "Imports") {
              isExpanded = importsExpanded;
              toggleExpanded = () => setImportsExpanded(!importsExpanded);
            } else if (item.title === "Recovery") {
              isExpanded = recoveryExpanded;
              toggleExpanded = () => setRecoveryExpanded(!recoveryExpanded);
            } else if (item.title === "Settings") {
              isExpanded = settingsExpanded;
              toggleExpanded = () => setSettingsExpanded(!settingsExpanded);
            }

            const currentTab = searchParams?.get("tab") || "BUSINESS";
            const hasActiveChild = item.children.some((c) => {
              if (c.href.includes("?")) {
                const [cPath, cQuery] = c.href.split("?");
                const cTab = new URLSearchParams(cQuery).get("tab");
                return pathname === cPath && cTab === currentTab;
              }
              return pathname === c.href;
            });

            return (
              <div key={item.title} className="space-y-1">
                <button
                  onClick={toggleExpanded}
                  className={clsx(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-semibold transition-colors group min-h-[44px]",
                    hasActiveChild
                      ? "text-emerald-400 bg-emerald-500/10"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={clsx("w-4 h-4", hasActiveChild ? "text-emerald-400" : "text-slate-400 group-hover:text-slate-200")} />
                    <span>{item.title}</span>
                  </div>
                  <ChevronDown
                    className={clsx("w-3.5 h-3.5 transition-transform duration-200", isExpanded && "rotate-180")}
                  />
                </button>

                {isExpanded && (
                  <div className="pl-9 pr-2 space-y-1 animate-in fade-in duration-150">
                    {item.children.map((child) => {
                      let isChildActive = false;
                      if (child.href.includes("?")) {
                        const [cPath, cQuery] = child.href.split("?");
                        const cTab = new URLSearchParams(cQuery).get("tab");
                        isChildActive = pathname === cPath && cTab === currentTab;
                      } else {
                        isChildActive = pathname === child.href;
                      }

                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={clsx(
                            "flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors min-h-[38px]",
                            isChildActive
                              ? "text-emerald-400 bg-emerald-500/20 font-semibold"
                              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                          )}
                        >
                          <span>{child.title}</span>
                          {child.badge && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              {child.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // Single Link
          return (
            <Link
              key={item.href}
              href={item.href!}
              className={clsx(
                "flex items-center justify-between px-3 py-2.5 rounded-xl font-semibold transition-colors group min-h-[44px]",
                isActive
                  ? "text-white bg-emerald-600 shadow-md shadow-emerald-600/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className={clsx("w-4 h-4", isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200")} />
                <span>{item.title}</span>
              </div>
              {item.badge && (
                <span className={clsx("text-[9px] font-bold px-1.5 py-0.2 rounded", isActive ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400")}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Role Scope Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/30 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center text-xs">
            {currentUser?.name?.substring(0, 2).toUpperCase() || "QF"}
          </div>
          <div>
            <span className="text-xs font-bold text-white block truncate max-w-[110px]">
              {currentUser?.name || "Staff"}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {userRole}
            </span>
          </div>
        </div>

        <Link
          href="/profile"
          title="User Profile"
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
        >
          <Settings className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Fixed width on >= md) */}
      <aside className="hidden md:flex w-64 flex-col flex-shrink-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (Slide-out on < md) */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in"
            onClick={onClose}
          />

          {/* Drawer Panel */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl animate-in slide-in-from-left duration-200 z-10">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

export default function Sidebar(props: SidebarProps) {
  return (
    <Suspense fallback={<aside className="hidden md:flex w-64 flex-col flex-shrink-0 h-screen bg-slate-900" />}>
      <SidebarContent {...props} />
    </Suspense>
  );
}
