"use client";

import Link from "next/link";
import { useMemo } from "react";
import { commercialStages } from "@/lib/commercial-data";
import { useCommercialStore } from "@/hooks/useCommercialStore";

const money = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function priorityClass(priority: string) {
  if (priority === "critical") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (priority === "high") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  if (priority === "medium") return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  return "border-slate-600 bg-slate-800 text-slate-300";
}

export function CommercialDashboard() {
  const { opportunities, tasks, quotations, suppliers } = useCommercialStore();

  const metrics = useMemo(() => {
    const open = opportunities.filter((item) => !["won", "lost"].includes(item.stage));
    const pipeline = open.reduce((total, item) => total + item.value, 0);
    const weighted = open.reduce((total, item) => total + item.value * (item.probability / 100), 0);
    const approvals = opportunities.filter((item) => item.stage === "approval").length;
    const urgent = tasks.filter((item) => item.status !== "completed" && ["critical", "high"].includes(item.priority)).length;
    return { open: open.length, pipeline, weighted, approvals, urgent };
  }, [opportunities, tasks]);

  return (
    <main className="p-5 text-white md:p-8">
      <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-400">VTC Commercial Operating System</p>
          <h2 className="mt-2 text-3xl font-bold">Commercial Command Center</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">Control opportunities, quotations, counterparties and commercial actions from one connected workspace.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/commercial/opportunities" className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500">Open Pipeline</Link>
          <Link href="/quotations" className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-200 hover:border-slate-500">Quotation Desk</Link>
        </div>
      </header>

      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Open Opportunities", String(metrics.open), "Active commercial cases", "text-blue-400"],
          ["Pipeline Value", `AED ${money.format(metrics.pipeline)}`, "Non-converted indicative value", "text-purple-400"],
          ["Weighted Pipeline", `AED ${money.format(metrics.weighted)}`, "Probability-adjusted value", "text-emerald-400"],
          ["Pending Approvals", String(metrics.approvals), "Management decisions required", "text-amber-300"],
          ["Urgent Actions", String(metrics.urgent), "High and critical open tasks", "text-red-400"],
        ].map(([label, value, detail, tone]) => (
          <article key={label} className="rounded-2xl border border-slate-800 bg-[#0d1423] p-5">
            <p className="text-sm text-slate-400">{label}</p>
            <p className={`mt-4 text-2xl font-bold ${tone}`}>{value}</p>
            <p className="mt-2 text-xs text-slate-500">{detail}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-5 2xl:grid-cols-[1.4fr_0.6fr]">
        <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-6">
          <div className="flex items-center justify-between">
            <div><h3 className="text-xl font-semibold">Pipeline by Stage</h3><p className="mt-1 text-sm text-slate-400">Live opportunity distribution.</p></div>
            <Link href="/commercial/opportunities" className="text-sm font-semibold text-blue-400">Manage pipeline →</Link>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-4 xl:grid-cols-7">
            {commercialStages.map((stage) => {
              const items = opportunities.filter((item) => item.stage === stage.id);
              const total = items.reduce((sum, item) => sum + item.value, 0);
              return (
                <div key={stage.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{stage.label}</p>
                  <p className="mt-3 text-2xl font-bold">{items.length}</p>
                  <p className="mt-2 text-xs text-slate-500">AED {money.format(total)}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-slate-800 text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Reference</th><th className="px-3 py-3">Opportunity</th><th className="px-3 py-3">Stage</th><th className="px-3 py-3">Value</th><th className="px-3 py-3">Probability</th><th className="px-3 py-3">Next Action</th></tr></thead>
              <tbody>{opportunities.slice(0, 5).map((item) => <tr key={item.id} className="border-b border-slate-800/80"><td className="px-3 py-4 font-semibold text-blue-300">{item.reference}</td><td className="px-3 py-4"><p className="font-semibold text-white">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.company}</p></td><td className="px-3 py-4 capitalize text-slate-300">{item.stage}</td><td className="px-3 py-4">{item.currency} {money.format(item.value)}</td><td className="px-3 py-4">{item.probability}%</td><td className="px-3 py-4 text-slate-400">{item.nextAction}</td></tr>)}</tbody>
            </table>
          </div>
        </article>

        <aside className="space-y-5">
          <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-6">
            <div className="flex items-center justify-between"><h3 className="text-xl font-semibold">Priority Actions</h3><Link href="/commercial/tasks" className="text-sm text-blue-400">All tasks</Link></div>
            <div className="mt-5 space-y-3">{tasks.filter((item) => item.status !== "completed").slice(0, 5).map((task) => <div key={task.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-white">{task.title}</p><p className="mt-1 text-xs text-slate-500">{task.relatedTo} · Due {task.dueDate}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${priorityClass(task.priority)}`}>{task.priority}</span></div></div>)}</div>
          </article>
          <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-6"><h3 className="text-xl font-semibold">Network Health</h3><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-950/40 p-4"><p className="text-xs text-slate-500">Suppliers</p><p className="mt-2 text-2xl font-bold">{suppliers.length}</p></div><div className="rounded-xl bg-slate-950/40 p-4"><p className="text-xs text-slate-500">Open Quotes</p><p className="mt-2 text-2xl font-bold">{quotations.filter((q) => q.status !== "awarded" && q.status !== "expired").length}</p></div></div></article>
        </aside>
      </section>
    </main>
  );
}
