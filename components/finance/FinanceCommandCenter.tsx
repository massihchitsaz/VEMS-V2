"use client";

import Link from "next/link";
import { useMemo } from "react";

const receivables = [
  { customer: "MODAVA", amount: 1180000, currency: "AED", due: "04 Aug", status: "Due" },
  { customer: "Power & Sun", amount: 860000, currency: "AED", due: "07 Aug", status: "Expected" },
  { customer: "Chimi Daru", amount: 540000, currency: "AED", due: "Overdue", status: "Overdue" },
  { customer: "Orange Group", amount: 420000, currency: "AED", due: "12 Aug", status: "Expected" },
];

const payables = [
  { supplier: "Kekule", amount: 760000, currency: "AED", due: "Urgent", status: "Approval" },
  { supplier: "Shipping Line", amount: 410000, currency: "AED", due: "05 Aug", status: "Scheduled" },
  { supplier: "Warehouse", amount: 185000, currency: "AED", due: "09 Aug", status: "Scheduled" },
  { supplier: "Customs & Port", amount: 245000, currency: "AED", due: "Today", status: "Release" },
];

function money(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function tone(status: string) {
  if (["Overdue", "Release"].includes(status)) return "border-red-500/30 bg-red-500/10 text-red-300";
  if (["Approval", "Due"].includes(status)) return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  if (status === "Expected") return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
}

export function FinanceCommandCenter() {
  const summary = useMemo(() => ({
    receivables: receivables.reduce((sum, row) => sum + row.amount, 0),
    payables: payables.reduce((sum, row) => sum + row.amount, 0),
    overdue: receivables.filter((row) => row.status === "Overdue").reduce((sum, row) => sum + row.amount, 0),
    urgent: payables.filter((row) => ["Approval", "Release"].includes(row.status)).reduce((sum, row) => sum + row.amount, 0),
  }), []);

  const liquidity = summary.receivables - summary.payables;

  return (
    <main className="min-h-screen bg-[#060a12] p-5 text-white md:p-8">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-8 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-400">VTC Finance Control</p>
            <h1 className="mt-2 text-3xl font-bold">Finance Command Center</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">Control receivables, payables, banking, liquidity, settlement and payment approvals from one operating screen.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/finance/payments" className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500">+ New Payment</Link>
            <Link href="/banking" className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-200 hover:border-slate-500">Banking Workspace</Link>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Total Receivables", `AED ${money(summary.receivables)}`, "AED 540K overdue", "text-emerald-400"],
            ["Total Payables", `AED ${money(summary.payables)}`, "AED 1.0M urgent", "text-red-400"],
            ["Net Liquidity", `${liquidity >= 0 ? "+" : "-"}AED ${money(Math.abs(liquidity))}`, "Before FX settlements", liquidity >= 0 ? "text-emerald-400" : "text-red-400"],
            ["Overdue Receipts", `AED ${money(summary.overdue)}`, "Commercial escalation", "text-amber-300"],
            ["Urgent Payments", `AED ${money(summary.urgent)}`, "Approval or release", "text-blue-300"],
          ].map(([label, value, detail, color]) => (
            <article key={label} className="rounded-2xl border border-slate-800 bg-[#0d1423] p-5">
              <p className="text-sm text-slate-400">{label}</p>
              <p className={`mt-3 text-2xl font-bold ${color}`}>{value}</p>
              <p className="mt-1 text-xs text-slate-500">{detail}</p>
            </article>
          ))}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-6">
            <div className="flex items-center justify-between">
              <div><h2 className="text-xl font-semibold">Liquidity Forecast</h2><p className="mt-1 text-sm text-slate-500">Projected cash position in AED equivalent</p></div>
              <Link href="/cash-flow" className="text-sm font-semibold text-blue-400">Open forecast →</Link>
            </div>
            <div className="mt-7 grid grid-cols-4 gap-3">
              {[{p:"Today",v:420000},{p:"7 Days",v:-1300000},{p:"14 Days",v:-460000},{p:"30 Days",v:850000}].map((item) => (
                <div key={item.p} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  <p className="text-xs text-slate-500">{item.p}</p>
                  <p className={`mt-2 text-lg font-bold ${item.v >= 0 ? "text-emerald-400" : "text-red-400"}`}>{item.v >= 0 ? "+" : "-"}AED {money(Math.abs(item.v))}</p>
                  <div className="mt-4 h-20 rounded-lg bg-slate-900 p-2">
                    <div className={`mt-auto rounded-md ${item.v >= 0 ? "bg-emerald-500" : "bg-red-500"}`} style={{height: `${Math.max(18, Math.min(100, Math.abs(item.v)/14000))}%`}} />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-6">
            <h2 className="text-xl font-semibold">Finance Actions</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Receivables", "/finance/receivables", "Collect and reconcile customer balances"],
                ["Payables", "/finance/payables", "Plan and approve supplier payments"],
                ["Payments", "/finance/payments", "Create and control payment instructions"],
                ["Banking", "/banking", "Accounts, SWIFT and compliance"],
                ["Cash Flow", "/cash-flow", "Daily and forward liquidity"],
                ["FX Exposure", "/fx/positions", "Cover currency requirements"],
              ].map(([label, href, desc]) => (
                <Link key={href} href={href} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 transition hover:border-blue-500/50 hover:bg-blue-500/5">
                  <p className="font-semibold">{label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{desc}</p>
                </Link>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <article className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1423]">
            <div className="flex items-center justify-between border-b border-slate-800 p-5"><h2 className="font-semibold">Priority Receivables</h2><Link href="/finance/receivables" className="text-sm text-blue-400">View all</Link></div>
            <div className="divide-y divide-slate-800">{receivables.map((row) => <div key={row.customer} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 p-5"><div><p className="font-medium">{row.customer}</p><p className="mt-1 text-xs text-slate-500">Due: {row.due}</p></div><p className="font-semibold">{row.currency} {money(row.amount)}</p><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone(row.status)}`}>{row.status}</span></div>)}</div>
          </article>
          <article className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1423]">
            <div className="flex items-center justify-between border-b border-slate-800 p-5"><h2 className="font-semibold">Priority Payables</h2><Link href="/finance/payables" className="text-sm text-blue-400">View all</Link></div>
            <div className="divide-y divide-slate-800">{payables.map((row) => <div key={row.supplier} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 p-5"><div><p className="font-medium">{row.supplier}</p><p className="mt-1 text-xs text-slate-500">Due: {row.due}</p></div><p className="font-semibold">{row.currency} {money(row.amount)}</p><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone(row.status)}`}>{row.status}</span></div>)}</div>
          </article>
        </section>
      </div>
    </main>
  );
}
