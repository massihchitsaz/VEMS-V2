"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Deal, User } from "@/types";

const moduleCards = [
  {
    title: "Commercial",
    value: "AED 12.8M",
    detail: "Pipeline value",
    note: "7 opportunities require action",
    href: "/customers",
    accent: "#3b82f6",
  },
  {
    title: "Treasury",
    value: "AED 8.1M",
    detail: "Open FX exposure",
    note: "2 rates outside preferred band",
    href: "/fx/positions",
    accent: "#14b8a6",
  },
  {
    title: "Logistics",
    value: "18",
    detail: "Active shipments",
    note: "3 shipments near deadline",
    href: "/shipping",
    accent: "#f59e0b",
  },
  {
    title: "Finance",
    value: "AED 2.4M",
    detail: "Net cash requirement",
    note: "5 payments awaiting release",
    href: "/finance",
    accent: "#8b5cf6",
  },
];

const exposureData = [
  { currency: "USD", exposure: 7.5, limit: 8.4 },
  { currency: "IRR", exposure: 4.0, limit: 5.2 },
  { currency: "EUR", exposure: 3.2, limit: 4.0 },
  { currency: "CNY", exposure: 1.8, limit: 2.4 },
];

const trendData = [
  { day: "Mon", commercial: 62, treasury: 44, logistics: 55, finance: 39 },
  { day: "Tue", commercial: 68, treasury: 51, logistics: 58, finance: 47 },
  { day: "Wed", commercial: 74, treasury: 49, logistics: 66, finance: 52 },
  { day: "Thu", commercial: 71, treasury: 63, logistics: 69, finance: 58 },
  { day: "Fri", commercial: 83, treasury: 69, logistics: 73, finance: 65 },
  { day: "Sat", commercial: 79, treasury: 72, logistics: 77, finance: 68 },
  { day: "Sun", commercial: 91, treasury: 84, logistics: 82, finance: 76 },
];

const riskData = [
  { name: "Critical", value: 2, color: "#ef4444" },
  { name: "High", value: 4, color: "#f97316" },
  { name: "Medium", value: 7, color: "#f59e0b" },
  { name: "Low", value: 13, color: "#22c55e" },
];

const priorities = [
  {
    title: "Approve USD purchase outside Treasury band",
    owner: "Treasury",
    deadline: "Today, 17:30",
    status: "Critical",
    href: "/approvals",
  },
  {
    title: "Confirm Jebel Ali booking and cut-off",
    owner: "Logistics",
    deadline: "Today, 18:00",
    status: "High",
    href: "/shipping/shipments",
  },
  {
    title: "Release supplier advance payment",
    owner: "Finance",
    deadline: "Tomorrow, 10:00",
    status: "High",
    href: "/finance",
  },
  {
    title: "Submit revised quotation to Orange Group",
    owner: "Commercial",
    deadline: "Tomorrow, 12:00",
    status: "Medium",
    href: "/quotations",
  },
];

const activities = [
  ["FX deal VTC-1052 completed", "Treasury", "8 min ago"],
  ["Shipment 26-TAG-LO-01 updated", "Logistics", "22 min ago"],
  ["Quotation Q-2026-018 moved to review", "Commercial", "41 min ago"],
  ["Payment instruction added", "Finance", "1 hr ago"],
  ["KYC document uploaded", "Documents", "2 hrs ago"],
];

function formatAED(value: number) {
  return `AED ${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function getDealValueAED(deal: Deal) {
  const baseCurrency = deal.pair.split("/")[0]?.toUpperCase();
  return baseCurrency === "AED" || deal.currency.toUpperCase() === "AED"
    ? deal.amount
    : deal.amount * deal.rate;
}

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0c1424] shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
      <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
        <div>
          <h3 className="font-semibold text-white">{title}</h3>
          {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes =
    status === "Critical"
      ? "border-red-500/30 bg-red-500/10 text-red-300"
      : status === "High"
        ? "border-orange-500/30 bg-orange-500/10 text-orange-300"
        : "border-amber-500/30 bg-amber-500/10 text-amber-300";

  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}>{status}</span>;
}

export function DashboardPage({ deals, users }: { deals: Deal[]; users: User[] }) {
  const metrics = useMemo(() => {
    const totalVolume = deals.reduce((sum, deal) => sum + getDealValueAED(deal), 0);
    const totalProfit = deals.reduce((sum, deal) => sum + deal.profit, 0);
    const pending = deals.filter((deal) => deal.status !== "Completed").length;
    const activeUsers = users.filter((user) => user.active).length;

    return { totalVolume, totalProfit, pending, activeUsers };
  }, [deals, users]);

  return (
    <main className="min-h-screen bg-[#060a12] text-white">
      <div className="mx-auto max-w-[1800px] px-1 pb-10">
        <section className="relative overflow-hidden rounded-3xl border border-blue-500/20 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.22),transparent_35%),linear-gradient(135deg,#0d1729_0%,#08101e_52%,#07101a_100%)] p-6 md:p-8">
          <div className="absolute right-8 top-8 hidden rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300 lg:block">
            Command Center Live
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-400">VTC Group Operations Control Tower</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Executive Command Center</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Unified operational view across Commercial, Treasury, Logistics and Finance. Every card below links directly to the working module, because apparently software is more useful when its pages actually talk to one another.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/fx/deals/new" className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold transition hover:bg-blue-500">Create FX Deal</Link>
            <Link href="/quotations" className="rounded-xl border border-slate-700 bg-slate-900/70 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500">New Quotation</Link>
            <Link href="/shipping/shipments" className="rounded-xl border border-slate-700 bg-slate-900/70 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500">Shipment Board</Link>
            <Link href="/approvals" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/15">Review Approvals</Link>
          </div>
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {moduleCards.map((card) => (
            <Link key={card.title} href={card.href} className="group rounded-2xl border border-slate-800 bg-[#0c1424] p-5 transition hover:-translate-y-0.5 hover:border-slate-600">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-400">{card.title}</p>
                  <p className="mt-3 text-2xl font-bold text-white">{card.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{card.detail}</p>
                </div>
                <span className="h-3 w-3 rounded-full shadow-[0_0_20px_currentColor]" style={{ backgroundColor: card.accent, color: card.accent }} />
              </div>
              <div className="mt-5 border-t border-slate-800 pt-4 text-xs font-medium" style={{ color: card.accent }}>{card.note}</div>
            </Link>
          ))}
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Registered Deal Volume", formatAED(metrics.totalVolume), `${deals.length} transactions`],
            ["Realized Profit", formatAED(metrics.totalProfit), "Across completed deals"],
            ["Pending Actions", String(metrics.pending + 8), "Across all modules"],
            ["Active Platform Users", String(metrics.activeUsers), "Authenticated accounts"],
          ].map(([label, value, detail]) => (
            <article key={label} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
              <p className="mt-3 text-2xl font-bold">{value}</p>
              <p className="mt-2 text-xs text-emerald-400">{detail}</p>
            </article>
          ))}
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_0.85fr]">
          <Panel title="Executive Performance" subtitle="Cross-functional operating index for the current week" action={<Link href="/reports" className="text-xs font-semibold text-blue-400">Open reports →</Link>}>
            <div className="h-[330px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="commercialGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.38}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                    <linearGradient id="treasuryGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#14b8a6" stopOpacity={0.34}/><stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" stroke="#64748b" tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 12 }} />
                  <Area type="monotone" dataKey="commercial" stroke="#3b82f6" fill="url(#commercialGradient)" strokeWidth={2.5} />
                  <Area type="monotone" dataKey="treasury" stroke="#14b8a6" fill="url(#treasuryGradient)" strokeWidth={2.5} />
                  <Area type="monotone" dataKey="logistics" stroke="#f59e0b" fill="transparent" strokeWidth={2} />
                  <Area type="monotone" dataKey="finance" stroke="#8b5cf6" fill="transparent" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Management Risk Register" subtitle="Open operational risks by severity" action={<Link href="/approvals" className="text-xs font-semibold text-amber-300">Review risks →</Link>}>
            <div className="grid items-center gap-4 sm:grid-cols-[180px_1fr] xl:grid-cols-1 2xl:grid-cols-[180px_1fr]">
              <div className="h-[190px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={riskData} dataKey="value" innerRadius={55} outerRadius={78} paddingAngle={4}>
                      {riskData.map((item) => <Cell key={item.name} fill={item.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {riskData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                    <div className="flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} /><span className="text-sm text-slate-300">{item.name}</span></div>
                    <span className="font-bold">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
          <Panel title="FX Exposure vs Treasury Limit" subtitle="Exposure shown in AED millions" action={<Link href="/fx/positions" className="text-xs font-semibold text-cyan-300">Open positions →</Link>}>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={exposureData}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="currency" stroke="#64748b" axisLine={false} tickLine={false} />
                  <YAxis stroke="#64748b" axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 12 }} />
                  <Bar dataKey="limit" fill="#334155" radius={[7, 7, 0, 0]} />
                  <Bar dataKey="exposure" fill="#06b6d4" radius={[7, 7, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Priority Actions" subtitle="Items requiring management intervention" action={<Link href="/notifications" className="text-xs font-semibold text-blue-400">All alerts →</Link>}>
            <div className="space-y-3">
              {priorities.map((item) => (
                <Link key={item.title} href={item.href} className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/35 p-4 transition hover:border-slate-600">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-100">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.owner} · {item.deadline}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </Link>
              ))}
            </div>
          </Panel>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel title="Recent Operational Activity" subtitle="Latest events across VEMS">
            <div className="divide-y divide-slate-800">
              {activities.map(([title, module, time]) => (
                <div key={title} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div><p className="text-sm font-medium text-slate-200">{title}</p><p className="mt-1 text-xs text-slate-500">{module}</p></div>
                  <span className="text-xs text-slate-500">{time}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="AI Executive Brief" subtitle="Current operating recommendation" action={<Link href="/ai" className="text-xs font-semibold text-purple-300">Open AI assistant →</Link>}>
            <div className="rounded-2xl border border-purple-500/25 bg-purple-500/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-300">Recommended action</p>
              <h4 className="mt-3 text-lg font-bold">Protect USD liquidity before releasing non-critical payments.</h4>
              <p className="mt-3 text-sm leading-6 text-slate-300">Current USD exposure and settlement obligations indicate a short-term liquidity gap. Prioritize customer collections, lock the approved USD purchase, and defer two lower-priority supplier payments until tomorrow morning.</p>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {[["Confidence", "91%"], ["Impact", "High"], ["Horizon", "24h"]].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-purple-500/20 bg-slate-950/30 p-3 text-center"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-bold text-purple-200">{value}</p></div>
                ))}
              </div>
            </div>
          </Panel>
        </section>

        <div className="mt-5 flex items-center justify-between rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-4 text-sm">
          <div><span className="font-bold text-emerald-300">Dashboard V3 Active</span><span className="ml-3 text-slate-400">Integrated Executive Command Center loaded successfully.</span></div>
          <span className="hidden text-xs text-emerald-300 md:block">VTC ONE · 2026</span>
        </div>
      </div>
    </main>
  );
}
