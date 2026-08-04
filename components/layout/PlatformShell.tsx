"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { navigationGroups } from "@/components/navigation/menu";

type DemoUser = {
  fullName?: string;
  role?: string;
  email?: string;
};

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/" || href === "/fx") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getPageTitle(pathname: string): string {
  const flatItems = navigationGroups.flatMap((group) => group.items);
  const exactMatch = flatItems.find((item) => item.href === pathname);

  if (exactMatch) {
    return exactMatch.label;
  }

  const nestedMatch = [...flatItems]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname.startsWith(`${item.href}/`));

  if (nestedMatch) {
    return nestedMatch.label;
  }

  return "VTC ONE";
}

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<DemoUser>({
    fullName: "Massih Chitsaz",
    role: "Admin",
  });

  const isLoginPage = pathname === "/login";
  const pageTitle = useMemo(() => getPageTitle(pathname), [pathname]);

  useEffect(() => {
    const rawSession = window.localStorage.getItem("vtc-demo-session");

    if (!rawSession) {
      return;
    }

    try {
      const parsedSession = JSON.parse(rawSession) as DemoUser;
      setUser(parsedSession);
    } catch {
      window.localStorage.removeItem("vtc-demo-session");
    }
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  function handleLogout() {
    window.localStorage.removeItem("vtc-demo-session");
    router.replace("/login");
    router.refresh();
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  const sidebar = (
    <aside className="flex h-full w-[280px] flex-col border-r border-slate-800 bg-[#08101f]">
      <div className="flex h-20 items-center border-b border-slate-800 px-5">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-lg font-bold text-white shadow-lg shadow-blue-950/40">
            V
          </span>

          <span>
            <span className="block text-base font-bold tracking-wide text-white">
              VTC ONE
            </span>
            <span className="block text-xs text-slate-500">
              Enterprise Operations Platform
            </span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {navigationGroups.map((group) => (
          <div key={group.label} className="mb-6">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">
              {group.label}
            </p>

            <div className="space-y-1">
              {group.items.map((item) => {
                const active = isActivePath(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${
                      active
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30"
                        : "text-slate-400 hover:bg-slate-800/70 hover:text-white"
                    }`}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-base">
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1 font-medium">{item.label}</span>
                    {item.badge ? (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? "bg-white/15 text-white" : "bg-slate-800 text-slate-400"}`}>
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="truncate text-sm font-semibold text-white">
            {user.fullName ?? user.email ?? "VTC User"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {user.role ?? "User"}
          </p>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-4 w-full rounded-xl border border-slate-700 px-3 py-2 text-left text-xs font-semibold text-slate-300 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[#060a12] text-slate-100">
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">
        {sidebar}
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 bg-black/70"
          />
          <div className="relative h-full w-[280px]">{sidebar}</div>
        </div>
      )}

      <div className="min-h-screen lg:pl-[280px]">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-800 bg-[#070d18]/95 px-4 backdrop-blur md:px-7">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 lg:hidden"
            >
              ☰
            </button>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-400">
                VTC Enterprise Management System
              </p>
              <h1 className="mt-1 text-lg font-semibold text-white md:text-xl">
                {pageTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <div className="hidden xl:block">
              <label className="relative block">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">⌕</span>
                <input
                  type="search"
                  placeholder="Search VTC ONE..."
                  className="w-64 rounded-xl border border-slate-800 bg-slate-900 py-2.5 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500"
                />
              </label>
            </div>
            <Link
              href="/fx/deals/new"
              className="hidden rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 sm:block"
            >
              + New FX Deal
            </Link>

            <Link
              href="/notifications"
              aria-label="Notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-sm text-slate-300 transition hover:border-slate-600 hover:text-white"
            >
              ●
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-slate-950">2</span>
            </Link>

            <div className="hidden rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 sm:block">
              <p className="max-w-44 truncate text-sm font-medium text-white">
                {user.fullName ?? "VTC User"}
              </p>
              <p className="text-xs text-slate-500">{user.role ?? "User"}</p>
            </div>
          </div>
        </header>

        <div className="min-h-[calc(100vh-5rem)]">{children}</div>
      </div>
    </div>
  );
}
