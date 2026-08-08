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

export function LiveDashboardPage({ userId, fullName }: { userId: string; fullName: string }) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(emptySnapshot);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
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
    { title: "Customers", value: snapshot.customers, detail: "Registered counterparties", href: "/customers" },
    { title: "Suppliers", value: snapshot.suppliers, detail: "Approved / active vendors", href: "/suppliers" },
    { title: "Quotations", value: snapshot.quotations, detail: "Commercial quotations", href: "/quotations" },
    { title: "Opportunities", value: snapshot.opportunities, detail: "Active commercial pipeline", href: "/commercial/opportunities" },
    { title: "Commercial Deals", value: snapshot.deals, detail: "Registered deals", href: "/commercial/deals" },
    { title: "Active Shipments", value: snapshot.activeShipments, detail: "Not delivered / cancelled", href: "/shipping/shipments" },
    { title: "Open Invoices", value: snapshot.openInvoices, detail: money(snapshot.openInvoiceValue), href: "/finance" },
    { title: "Completed Payments", value: snapshot.completedPayments, detail: money(snapshot.completedPaymentValue), href: "/finance" },
  ];

  return (
    <main className="min-h-screen bg-[#060a12] text-white">
      <div className="mx-auto max-w-[1800px] px-5 py-6 md:px-8 md:py-8">
        <section className="overflow-hidden rounded-3xl border border-blue-500/20 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.24),transparent_36%),linear-gradient(135deg,#0d1729,#07101a)] p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-400">VTC ONE · LIVE OPERATIONS</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Executive Command Center</h1>
              <p className="mt-3 text-sm text-slate-400">Welcome, {fullName}. Dashboard values now come from the shared Supabase production database.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/quotations" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold hover:bg-blue-500">New Quotation</Link>
                <Link href="/commercial/opportunities" className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-sm font-semibold">Opportunities</Link>
                <Link href="/shipping/shipments" className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-sm font-semibold">Shipments</Link>
                <Link href="/approvals" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300">Approvals</Link>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Requires attention</p>
              <p className="mt-2 text-3xl font-bold">{attention}</p>
              <p className="mt-1 text-xs text-slate-400">Approvals, tasks and unread notifications</p>
              <button onClick={() => void load()} className="mt-3 text-xs font-semibold text-blue-400">Refresh live data</button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
        ) : null}

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <Link key={card.title} href={card.href} className="rounded-2xl border border-slate-800 bg-[#0c1424] p-5 transition hover:-translate-y-0.5 hover:border-slate-600">
              <p className="text-sm text-slate-400">{card.title}</p>
              <p className="mt-3 text-3xl font-bold">{loading ? "…" : card.value}</p>
              <p className="mt-2 text-xs text-slate-500">{card.detail}</p>
            </Link>
          ))}
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-2xl border border-slate-800 bg-[#0c1424]">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <h2 className="font-semibold">Operational Control</h2>
                <p className="mt-1 text-xs text-slate-500">Live workload across operational modules</p>
              </div>
              <span className="text-xs text-emerald-400">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Loading…"}</span>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Open Tasks", snapshot.openTasks, "/tasks"],
                ["Unread Notifications", snapshot.unreadNotifications, "/notifications"],
                ["Pending Approvals", snapshot.pendingApprovals, "/approvals"],
                ["FX Deals", snapshot.fxDeals, "/fx/deals"],
                ["Pending FX Approvals", snapshot.pendingFxApprovals, "/fx/approvals"],
                ["Open Invoice Value", money(snapshot.openInvoiceValue), "/finance"],
              ].map(([label, value, href]) => (
                <Link key={String(label)} href={String(href)} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 hover:border-slate-600">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-2 text-xl font-bold">{loading ? "…" : String(value)}</p>
                </Link>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-[#0c1424]">
            <div className="border-b border-slate-800 px-5 py-4">
              <h2 className="font-semibold">Recent Activity</h2>
              <p className="mt-1 text-xs text-slate-500">Notifications, tasks and audit events</p>
            </div>
            <div className="divide-y divide-slate-800">
              {!loading && activity.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">No recent activity yet.</p>
              ) : null}
              {activity.map((item) => (
                <Link key={item.id} href={item.href} className="block px-5 py-4 hover:bg-slate-900/40">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-200">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
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
