"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getDashboardSnapshot,
  getRecentActivity,
  type ActivityItem,
  type DashboardSnapshot,
} from "@/lib/supabase/operations";

const emptySnapshot: DashboardSnapshot = {
  customers: 0,
  suppliers: 0,
  quotations: 0,
  opportunities: 0,
  deals: 0,
  activeShipments: 0,
  openInvoices: 0,
  openInvoiceValue: 0,
  completedPayments: 0,
  completedPaymentValue: 0,
  openTasks: 0,
  unreadNotifications: 0,
  pendingApprovals: 0,
  fxDeals: 0,
  pendingFxApprovals: 0,
};

function money(value: number) {
  return `AED ${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function ago(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function MetricCard({ title, value, detail, href, loading }: { title: string; value: string | number; detail: string; href: string; loading: boolean }) {
  return (
    <Link href={href} className="group rounded-2xl border border-slate-800 bg-[#0c1424] p-5 transition duration-200 hover:-translate-y-0.5 hover:border-blue-500/40 hover:bg-[#0e182b]">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-medium text-slate-400">{title}</p>
        <span className="text-xs text-slate-600 transition group-hover:text-blue-400">↗</span>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight">{loading ? "…" : value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </Link>
  );
}

export function LiveDashboardPage({ userId, fullName }: { userId: string; fullName: string }) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(emptySnapshot);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (manual = false) => {
    try {
      if (manual) setRefreshing(true);
      setError("");
      const [nextSnapshot, nextActivity] = await Promise.all([
        getDashboardSnapshot(userId),
        getRecentActivity(userId),
      ]);
      setSnapshot(nextSnapshot);
      setActivity(nextActivity);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load operational data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  const attention = useMemo(
    () => snapshot.pendingApprovals + snapshot.pendingFxApprovals + snapshot.openTasks + snapshot.unreadNotifications,
    [snapshot],
  );

  const cards = [
    { title: "Customers", value: snapshot.customers, detail: "Registered customer accounts", href: "/customers" },
    { title: "Suppliers", value: snapshot.suppliers, detail: "Registered supplier accounts", href: "/suppliers" },
    { title: "Quotations", value: snapshot.quotations, detail: "Commercial and logistics quotations", href: "/quotations" },
    { title: "Opportunities", value: snapshot.opportunities, detail: "Commercial pipeline records", href: "/commercial/opportunities" },
    { title: "Commercial Deals", value: snapshot.deals, detail: "Registered commercial deals", href: "/deals" },
    { title: "Active Shipments", value: snapshot.activeShipments, detail: "Shipments currently in operation", href: "/shipping/shipments" },
    { title: "Open Invoices", value: snapshot.openInvoices, detail: money(snapshot.openInvoiceValue), href: "/finance/receivables" },
    { title: "Completed Payments", value: snapshot.completedPayments, detail: money(snapshot.completedPaymentValue), href: "/finance/payments" },
  ];

  const controlItems = [
    { label: "Open Tasks", value: snapshot.openTasks, href: "/tasks", tone: snapshot.openTasks > 0 ? "text-amber-300" : "text-emerald-400" },
    { label: "Unread Notifications", value: snapshot.unreadNotifications, href: "/notifications", tone: snapshot.unreadNotifications > 0 ? "text-blue-300" : "text-emerald-400" },
    { label: "Pending Approvals", value: snapshot.pendingApprovals, href: "/approvals", tone: snapshot.pendingApprovals > 0 ? "text-amber-300" : "text-emerald-400" },
    { label: "FX Deals", value: snapshot.fxDeals, href: "/fx/deals", tone: "text-slate-100" },
    { label: "Pending FX Approvals", value: snapshot.pendingFxApprovals, href: "/approvals", tone: snapshot.pendingFxApprovals > 0 ? "text-amber-300" : "text-emerald-400" },
    { label: "Open Invoice Value", value: money(snapshot.openInvoiceValue), href: "/finance/receivables", tone: "text-slate-100" },
  ];

  return (
    <main className="min-h-screen bg-[#060a12] text-white">
      <div className="mx-auto max-w-[1800px] px-5 py-6 md:px-8 md:py-8">
        <section className="overflow-hidden rounded-3xl border border-blue-500/20 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.24),transparent_36%),linear-gradient(135deg,#0d1729,#07101a)] p-6 md:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-400">VTC ONE · Executive Operations</p>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Live Data</span>
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Executive Command Center</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Welcome, {fullName}. Monitor commercial activity, shipment execution, finance exposure and actions requiring management attention from one workspace.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/quotations" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold transition hover:bg-blue-500">Create Quotation</Link>
                <Link href="/commercial/opportunities" className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-sm font-semibold transition hover:border-slate-500">Opportunities</Link>
                <Link href="/shipping/shipments" className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-sm font-semibold transition hover:border-slate-500">Shipments</Link>
                <Link href="/approvals" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/15">Approvals</Link>
              </div>
            </div>

            <div className="min-w-[260px] rounded-2xl border border-slate-700 bg-slate-950/50 px-5 py-4 shadow-2xl shadow-black/10">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Requires attention</p>
                <span className={`h-2.5 w-2.5 rounded-full ${attention > 0 ? "bg-amber-400" : "bg-emerald-400"}`} />
              </div>
              <p className="mt-2 text-3xl font-bold">{loading ? "…" : attention}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">Approvals, tasks and unread notifications</p>
              <button onClick={() => void load(true)} disabled={refreshing} className="mt-3 text-xs font-semibold text-blue-400 disabled:opacity-50">{refreshing ? "Refreshing…" : "Refresh live data"}</button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="mt-5 flex items-start justify-between gap-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            <div><p className="font-semibold">Live data could not be refreshed.</p><p className="mt-1 text-xs text-red-200/80">{error}</p></div>
            <button onClick={() => void load(true)} className="whitespace-nowrap text-xs font-semibold text-red-100">Retry</button>
          </div>
        ) : null}

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => <MetricCard key={card.title} {...card} loading={loading} />)}
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <article className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0c1424]">
            <div className="flex flex-col gap-2 border-b border-slate-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">Management Control Queue</h2>
                <p className="mt-1 text-xs text-slate-500">Items that may require operational or management action</p>
              </div>
              <span className="text-xs text-emerald-400">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Loading…"}</span>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {controlItems.map((item) => (
                <Link key={item.label} href={item.href} className="group rounded-xl border border-slate-800 bg-slate-950/40 p-4 transition hover:border-slate-600 hover:bg-slate-950/70">
                  <div className="flex items-start justify-between gap-3"><p className="text-xs leading-5 text-slate-500">{item.label}</p><span className="text-xs text-slate-700 group-hover:text-blue-400">↗</span></div>
                  <p className={`mt-2 text-xl font-bold ${item.tone}`}>{loading ? "…" : String(item.value)}</p>
                </Link>
              ))}
            </div>
          </article>

          <article className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0c1424]">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <h2 className="font-semibold">Recent Activity</h2>
                <p className="mt-1 text-xs text-slate-500">Latest tasks, notifications and audit events</p>
              </div>
              <Link href="/audit" className="text-xs font-semibold text-blue-400">Audit Log</Link>
            </div>
            <div className="max-h-[360px] divide-y divide-slate-800 overflow-y-auto">
              {!loading && activity.length === 0 ? <p className="p-5 text-sm text-slate-500">No recent activity yet.</p> : null}
              {activity.map((item) => (
                <Link key={item.id} href={item.href} className="block px-5 py-4 transition hover:bg-slate-900/40">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-200">{item.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.detail}</p>
                    </div>
                    <span className="whitespace-nowrap text-[11px] text-slate-500">{ago(item.createdAt)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
