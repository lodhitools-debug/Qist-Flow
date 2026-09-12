"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SaasSidebar from "@/components/layout/SaasSidebar";
import Header from "@/components/layout/Header";
import PwaInstallPrompt from "@/components/layout/PwaInstallPrompt";
import { getClientSession } from "@/lib/client-auth";

export default function SaasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    getClientSession()
      .then((data) => {
        if (!data || !data.authenticated) {
          window.location.href = "/saas/login";
        } else if (data.user?.role !== "SUPER_ADMIN") {
          window.location.href = "/";
        } else {
          setCheckingAuth(false);
        }
      })
      .catch(() => {
        window.location.href = "/saas/login";
      });
  }, []);

  if (checkingAuth) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-lg animate-pulse">
            Q
          </div>
          <div className="text-xs font-semibold text-slate-400">Verifying Enterprise access...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* SaaS Sidebar */}
      <SaasSidebar
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
      />

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* We reuse the generic Header but we can hide some parts if needed. The Header component checks if you are SUPER_ADMIN to show/hide branch switcher. */}
        <Header onToggleMobileMenu={() => setMobileDrawerOpen(true)} />

        <main className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 lg:p-8 pb-24 md:pb-8">
          {children}
        </main>
      </div>

      <PwaInstallPrompt />
    </div>
  );
}
