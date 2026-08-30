"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { useState } from "react";
import clsx from "clsx";

interface NavItem {
  title: string;
  href?: string;
  icon: any;
  badge?: string;
  children?: { title: string; href: string; badge?: string }[];
}

export default function Sidebar() {
  const pathname = usePathname();
  const [waExpanded, setWaExpanded] = useState(true);
  const [importsExpanded, setImportsExpanded] = useState(true);
  const [recoveryExpanded, setRecoveryExpanded] = useState(true);

  const navItems: NavItem[] = [
    {
      title: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
    },
    {
      title: "Customers",
      href: "/customers",
      icon: Users,
    },
    {
      title: "Installments",
      href: "/installments",
      icon: CreditCard,
    },
    {
      title: "Recovery",
      icon: PhoneCall,
      children: [
        { title: "Recovery Workspace", href: "/recovery" },
        { title: "Send Reminders", href: "/recovery/send-reminders", badge: "Bulk" },
      ],
    },
    {
      title: "WhatsApp",
      icon: QrCode,
      children: [
        { title: "Connection", href: "/whatsapp/connection" },
        { title: "Message History", href: "/whatsapp/message-history" },
        { title: "Templates", href: "/whatsapp/templates" },
      ],
    },
    {
      title: "Imports",
      icon: FileSpreadsheet,
      children: [
        { title: "Import Excel", href: "/imports" },
        { title: "Import History", href: "/imports/history" },
      ],
    },
    {
      title: "Reports",
      href: "/reports",
      icon: BarChart3,
    },
    {
      title: "System Health",
      href: "/system-health",
      icon: Activity,
    },
    {
      title: "Users",
      href: "/users",
      icon: UserCheck,
    },
    {
      title: "Settings",
      href: "/settings",
      icon: Settings,
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col flex-shrink-0 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950/40">
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
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;

          if (item.children) {
            let isExpanded = true;
            let toggle = () => {};
            if (item.title === "WhatsApp") {
              isExpanded = waExpanded;
              toggle = () => setWaExpanded(!waExpanded);
            } else if (item.title === "Imports") {
              isExpanded = importsExpanded;
              toggle = () => setImportsExpanded(!importsExpanded);
            } else if (item.title === "Recovery") {
              isExpanded = recoveryExpanded;
              toggle = () => setRecoveryExpanded(!recoveryExpanded);
            }

            const hasActiveChild = item.children.some((c) => pathname === c.href);

            return (
              <div key={item.title} className="space-y-1">
                <button
                  onClick={toggle}
                  className={clsx(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    hasActiveChild
                      ? "text-emerald-400 bg-slate-800/60"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/40"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={clsx("w-4 h-4", hasActiveChild ? "text-emerald-400" : "text-slate-400")} />
                    <span>{item.title}</span>
                  </div>
                  <ChevronDown
                    className={clsx(
                      "w-4 h-4 transition-transform text-slate-400",
                      isExpanded && "rotate-180"
                    )}
                  />
                </button>

                {isExpanded && (
                  <div className="pl-9 space-y-1">
                    {item.children.map((sub) => {
                      const isActive = pathname === sub.href;
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={clsx(
                            "flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                            isActive
                              ? "bg-emerald-500/15 text-emerald-400 font-semibold border-l-2 border-emerald-400"
                              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
                          )}
                        >
                          <span>{sub.title}</span>
                          {sub.badge && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
                              {sub.badge}
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

          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href!}
              className={clsx(
                "flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-emerald-600 text-white shadow-sm shadow-emerald-700/50"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/50"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className={clsx("w-4 h-4", isActive ? "text-white" : "text-slate-400")} />
                <span>{item.title}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/30 text-xs text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          <span>QistBazar Mode</span>
        </div>
        <span className="text-[11px] text-slate-500">v1.0</span>
      </div>
    </aside>
  );
}
