"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  Building,
  LogOut,
  ChevronLeft,
  LayoutDashboard,
  CreditCard,
  Settings,
  Users,
  MessageSquare,
  BarChart,
  Shield,
  Activity,
  Ticket,
  Megaphone,
  UserPlus,
  Server
} from "lucide-react";
import { useEffect, useState } from "react";
import { getClientSession } from "@/lib/client-auth";

export default function SaasSidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    getClientSession().then((session) => {
      if (session?.user) {
        setUserEmail(session.user.email);
      }
    });
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/saas/login";
  };

  const NavLink = ({ href, icon: Icon, label, exact = false }: { href: string, icon: any, label: string, exact?: boolean }) => {
    const isActive = exact ? pathname === href : pathname.startsWith(href);
    return (
      <Link
        href={href}
        onClick={onClose}
        className={clsx(
          "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 mb-1",
          isActive
            ? "bg-indigo-500/10 text-indigo-400 font-semibold"
            : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
        )}
      >
        <Icon className={clsx("w-4 h-4", isActive ? "text-indigo-400" : "text-slate-500")} />
        {label}
      </Link>
    );
  };

  const NavGroup = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="mb-4">
      <div className="px-3 mb-2 mt-4">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          {title}
        </span>
      </div>
      {children}
    </div>
  );

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={clsx(
          "fixed md:static inset-y-0 left-0 z-50 w-64 bg-slate-950 border-r border-slate-900",
          "flex flex-col h-full transform transition-transform duration-300 ease-out md:translate-x-0 shadow-2xl md:shadow-none",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <div className="h-[60px] md:h-[72px] flex items-center px-5 border-b border-slate-900 bg-slate-950/50 shrink-0">
          <Link href="/saas" className="flex items-center gap-2.5" onClick={onClose}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-500/20">
              Q
            </div>
            <div className="flex flex-col">
              <span className="text-[15px] font-bold text-white tracking-tight flex items-center gap-1.5">
                QistFlow
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  SAAS
                </span>
              </span>
              <span className="text-[10px] text-slate-500 font-medium tracking-wide">
                Enterprise Admin
              </span>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="ml-auto p-1.5 text-slate-500 hover:text-slate-300 md:hidden bg-slate-900 rounded-lg"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto px-3 py-4 custom-scrollbar">
          <NavGroup title="Overview">
            <NavLink href="/saas" icon={LayoutDashboard} label="Dashboard" exact />
            <NavLink href="/saas/analytics" icon={BarChart} label="Analytics" />
          </NavGroup>

          <NavGroup title="Tenants">
            <NavLink href="/saas/tenants" icon={Building} label="All Tenants" exact />
            <NavLink href="/saas/tenants/add" icon={UserPlus} label="Add Tenant" />
          </NavGroup>

          <NavGroup title="Users">
            <NavLink href="/saas/users" icon={Users} label="All Users" exact />
            <NavLink href="/saas/users/roles" icon={Shield} label="Roles & Permissions" />
          </NavGroup>

          <NavGroup title="WhatsApp">
            <NavLink href="/saas/whatsapp" icon={MessageSquare} label="Accounts" exact />
            <NavLink href="/saas/whatsapp/templates" icon={MessageSquare} label="Templates" />
          </NavGroup>

          <NavGroup title="Billing">
            <NavLink href="/saas/plans" icon={CreditCard} label="Plans & Pricing" />
            <NavLink href="/saas/billing/subscriptions" icon={CreditCard} label="Subscriptions" />
            <NavLink href="/saas/billing/invoices" icon={CreditCard} label="Invoices" />
          </NavGroup>

          <NavGroup title="Support">
            <NavLink href="/saas/support/tickets" icon={Ticket} label="Support Tickets" />
            <NavLink href="/saas/support/announcements" icon={Megaphone} label="Announcements" />
          </NavGroup>

          <NavGroup title="System">
            <NavLink href="/saas/settings" icon={Settings} label="Global Settings" exact />
            <NavLink href="/saas/system/health" icon={Activity} label="System Health" />
            <NavLink href="/saas/system/audit" icon={Server} label="Audit Logs" />
          </NavGroup>
        </div>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-slate-900 bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-sm shrink-0">
              {userEmail ? userEmail.charAt(0).toUpperCase() : "A"}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-white truncate">
                SaaS Admin
              </span>
              <span className="text-[10px] text-slate-500 truncate">
                {userEmail || "Loading..."}
              </span>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-lg text-xs font-semibold transition-colors border border-slate-800 hover:border-rose-500/30"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
