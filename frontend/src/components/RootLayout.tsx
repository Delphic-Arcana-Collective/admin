"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { hasValidToken, redirectToAuth } from "@/lib/session";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const openWithoutToken = pathname === "/services";

  useEffect(() => {
    if (openWithoutToken || hasValidToken()) {
      setReady(true);
      return;
    }
    redirectToAuth();
  }, [openWithoutToken]);

  if (!ready) return null;

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      <div className="flex-1 flex overflow-hidden">
        {/* 移动端侧边栏遮罩 */}
        {!sidebarCollapsed && (
          <div
            className="fixed inset-0 bg-black/30 z-40 lg:hidden"
            onClick={() => setSidebarCollapsed(true)}
          />
        )}

        <aside
          className={`shrink-0 fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto ${
            sidebarCollapsed
              ? "-translate-x-full lg:translate-x-0 w-0 lg:w-0 opacity-0"
              : "w-52 opacity-100 translate-x-0"
          } transition-all duration-300 ease-in-out lg:block`}
        >
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(true)}
          />
        </aside>

        <div className="flex flex-col min-w-0 flex-1 lg:flex">
          <Header
            sidebarCollapsed={sidebarCollapsed}
            onMenuClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
          <main className="flex-1 overflow-y-auto p-2 sm:p-4">{children}</main>
        </div>
      </div>
    </div>
  );
}
