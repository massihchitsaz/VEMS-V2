"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { commercialStages } from "@/lib/commercial-data";
import { useCommercialStore } from "@/hooks/useCommercialStore";

const money = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

function priorityClass(priority: string) {
  if (priority === "critical") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (priority === "high") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  if (priority === "medium") return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  return "border-slate-600 bg-slate-800 text-slate-300";
}

function stageClass(stage: string) {
  if (stage === "won") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (stage === "lost") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (stage === "approval") return "border-purple-500/30 bg-purple-500/10 text-purple-300";
  if (stage === "negotiation") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-blue-500/30 bg-blue-500/10 text-blue-300";
}

function dueLabel(value: string) {
  if (!value) return "No due date";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function CommercialDashboard() {
  const { opportunities, tasks, quotations, suppliers, ready, error, refresh } = useCommercialStore();
  const [refreshing, setRefreshing] = useState(false);

  const metrics = useMemo(() => {
    const open = opportunities.filter((item) => !["won", "lost"].includes(item.stage));
    const won = opportunities.filter((item) => item.stage === "won");
    const closed = opportunities.filter((item) => ["won", "lost"].includes(item.stage));
    const pipeline = open.reduce((total, item) => total + item.value, 0);
    const weighted = open.reduce((total, item) => total + item.value * (item.probability / 100), 0);
    const urgent = tasks.filter((item) => item.status !== "completed" && ["critical", "high"].includes(item.priority)).length;
    const overdue = tasks.filter((item) => item.status !== "completed" && item.dueDate && new Date(item.dueDate).getTime() < Date.now()).length;
    const openQuotes = quotations.filter((q) => !["awarded", "expired"].includes(q.status));
    const approvals = quotations.filter((q) => q.status === "approval").length + opportunities.filter((o) => o.stage === "approval").length;
    const wonValue = won.reduce((sum, item) => sum + item.value, 0);
    const winRate = closed.length ? (won.length / closed.length) * 100 : 0;
    const avgMargin = open.length ? open.reduce((sum, item) => sum + Number(item.marginPercent || 0), 0) / open.length : 0;
    return { open: open.length, pipeline, weighted, urgent, overdue, openQuotes: openQuotes.length, approvals, wonValue, winRate, avgMargin };
  }, [opportunities, tasks, quotations]);

  const priorityOpportunities = useMemo(
    () => opportunities.filter((o) => !["won", "lost"].includes(o.stage)).sort((a, b) => {
      const rank = { critical: 4, high: 3, medium: 2, low: 1 } as const;
      return rank[b.priority] - rank[a.priority] || b.value - a.value;
    }).slice(0, 6),
    [opportunities],
  );

  const activeTasks = useMemo(
    () => tasks.filter((item) => item.status !== "completed").sort((a, b) => {
      const rank = { critical: 4, high: 3, medium: 2, low: 1 } as const;
      return rank[b.priority] - rank[a.priority];
    }).slice(0, 6),
    [tasks],
  );

  async function handleRefresh() {
    setRefreshing(true);
    try { await refresh(); } finally { setRefreshing(false); }
  }

  return (
    <main className="min-h-screen bg-[#060a12] text-white">
      <div className="mx-auto max-w-[1800px] p-5 md:p-8">
        <section className="overflow-hidden rounded-3xl border border-blue-500/20 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.22),transparent_34%),linear-gradient(135deg,#0c1729,#07101a)] p-6 md:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-400">VTC COMMERCIAL OPERATING SYSTEM</p>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">Live Supabase</span>
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Commercial Command Center</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">A single control layer for pipeline, pricing, customer actions, supplier readiness and management decisions.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/commercial/opportunities" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold hover:bg-blue-500">Open Pipeline</Link>
                <Link href="/quotations" className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-sm font-semibold hover:border-slate-500">New Quotation</Link>
                <Link href="/customers" className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-sm font-semibold hover:border-slate-500">Customers</Link>
                <Link href="/suppliers" className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-sm font-semibold hover:border-slate-500">Suppliers</Link>
              </div>
            </div>
            <div className="grid min-w-[290px] grid-cols-2 gap-3 rounded-2xl border border-slate-700 bg-slate-950/45 p-4">
              <div><p className="text-[11px] uppercase tracking-wider text-slate-500">Open Quotes</p><p className="mt-2 text-2xl font-bold">{ready ? metrics.openQuotes : "…"}</p></div>
              <div><p className="text-[11px] uppercase tracking-wider text-slate-500">Approvals</p><p className="mt-2 text-2xl font-bold text-amber-300">{ready ? metrics.approvals : "…"}</p></div>
              <div><p className="text-[11px] uppercase tracking-wider text-slate-500">Urgent</p><p className="mt-2 text-2xl font-bold text-red-300">{ready ? metrics.urgent : "…"}</p></div>
              <button onClick={() => void handleRefresh()} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-blue-300 hover:border-blue-500">{refreshing ? "Refreshing…" : "Refresh Live Data"}</button>
            </div>
          </div>
        </section>

        {error ? <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">Commercial data error: {error}</div> : null}

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {[
            ["Open Opportunities", metrics.open, "Active commercial cases", "text-blue-400"],
            ["Pipeline Value", `AED ${money.format(metrics.pipeline)}`, "Indicative open value", "text-purple-400"],
            ["Weighted Pipeline", `AED ${money.format(metrics.weighted)}`, "Probability adjusted", "text-emerald-400"],
            ["Won Value", `AED ${money.format(metrics.wonValue)}`, "Closed-won opportunity value", "text-emerald-300"],
            ["Win Rate", `${pct.format(metrics.winRate)}%`, "Won / closed opportunities", "text-cyan-300"],
            ["Avg. Margin", `${pct.format(metrics.avgMargin)}%`, "Current open opportunity margin", "text-amber-300"],
          ].map(([label, value, detail, tone]) => (
            <article key={String(label)} className="rounded-2xl border border-slate-800 bg-[#0c1424] p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
              <p className={`mt-3 text-2xl font-bold ${tone}`}>{ready ? String(value) : "…"}</p>
              <p className="mt-2 text-xs text-slate-500">{detail}</p>
            </article>
          ))}
        </section>

        <section className="mt-5 rounded-2xl border border-slate-800 bg-[#0c1424] p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div><h2 className="text-lg font-semibold">Pipeline Funnel</h2><p className="mt-1 text-xs text-slate-500">Live distribution by commercial stage</p></div>
            <Link href="/commercial/opportunities" className="text-sm font-semibold text-blue-400">Manage full pipeline →</Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
            {commercialStages.map((stage) => {
              const items = opportunities.filter((item) => item.stage === stage.id);
              const total = items.reduce((sum, item) => sum + item.value, 0);
              const probability = items.length ? items.reduce((sum, item) => sum + item.probability, 0) / items.length : 0;
              return <Link href="/commercial/opportunities" key={stage.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 transition hover:border-slate-600">
                <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{stage.label}</p><span className="text-xs text-slate-600">{items.length}</span></div>
                <p className="mt-3 text-xl font-bold">AED {money.format(total)}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, probability)}%` }} /></div>
                <p className="mt-2 text-[11px] text-slate-500">Avg probability {pct.format(probability)}%</p>
              </Link>;
            })}
          </div>
        </section>

        <section className="mt-5 grid gap-5 2xl:grid-cols-[1.35fr_0.65fr]">
          <article className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0c1424]">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div><h2 className="font-semibold">Priority Opportunities</h2><p className="mt-1 text-xs text-slate-500">Highest-priority active commercial cases</p></div>
              <Link href="/commercial/opportunities" className="text-xs font-semibold text-blue-400">View all</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Customer / Opportunity</th><th className="px-5 py-3">Stage</th><th className="px-5 py-3">Value</th><th className="px-5 py-3">Probability</th><th className="px-5 py-3">Margin</th><th className="px-5 py-3">Next Action</th></tr></thead>
                <tbody>
                  {priorityOpportunities.map((item) => <tr key={item.id} className="border-b border-slate-800/80 last:border-0 hover:bg-slate-900/35"><td className="px-5 py-4 font-semibold text-blue-300">{item.reference}</td><td className="px-5 py-4"><p className="font-semibold">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.company}</p></td><td className="px-5 py-4"><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${stageClass(item.stage)}`}>{item.stage}</span></td><td className="px-5 py-4">{item.currency} {money.format(item.value)}</td><td className="px-5 py-4">{item.probability}%</td><td className="px-5 py-4 text-emerald-300">{pct.format(item.marginPercent)}%</td><td className="max-w-[260px] px-5 py-4 text-slate-400">{item.nextAction}</td></tr>)}
                  {ready && priorityOpportunities.length === 0 ? <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">No active opportunities yet.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </article>

          <aside className="space-y-5">
            <article className="rounded-2xl border border-slate-800 bg-[#0c1424] p-5">
              <div className="flex items-center justify-between"><div><h2 className="font-semibold">Action Queue</h2><p className="mt-1 text-xs text-slate-500">Commercial work requiring attention</p></div><Link href="/commercial/tasks" className="text-xs font-semibold text-blue-400">All tasks</Link></div>
              <div className="mt-4 space-y-3">
                {activeTasks.map((task) => <div key={task.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{task.title}</p><p className="mt-1 text-xs text-slate-500">{task.relatedTo} · {dueLabel(task.dueDate)}</p><p className="mt-1 text-[11px] text-slate-600">Owner: {task.assignee}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${priorityClass(task.priority)}`}>{task.priority}</span></div></div>)}
                {ready && activeTasks.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No open commercial tasks.</p> : null}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-800 bg-[#0c1424] p-5">
              <h2 className="font-semibold">Commercial Health</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Link href="/suppliers" className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 hover:border-slate-600"><p className="text-xs text-slate-500">Suppliers</p><p className="mt-2 text-2xl font-bold">{ready ? suppliers.length : "…"}</p></Link>
                <Link href="/quotations" className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 hover:border-slate-600"><p className="text-xs text-slate-500">Open Quotes</p><p className="mt-2 text-2xl font-bold">{ready ? metrics.openQuotes : "…"}</p></Link>
                <Link href="/commercial/tasks" className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 hover:border-slate-600"><p className="text-xs text-slate-500">Overdue Tasks</p><p className={`mt-2 text-2xl font-bold ${metrics.overdue ? "text-red-300" : ""}`}>{ready ? metrics.overdue : "…"}</p></Link>
                <Link href="/approvals" className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 hover:border-slate-600"><p className="text-xs text-slate-500">Approvals</p><p className="mt-2 text-2xl font-bold text-amber-300">{ready ? metrics.approvals : "…"}</p></Link>
              </div>
            </article>
          </aside>
        </section>
      </div>
    </main>
  );
}
