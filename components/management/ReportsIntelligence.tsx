"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const monthly = [
  { month: "Mar", revenue: 4800000, profit: 410000, shipments: 21, deals: 17 },
  { month: "Apr", revenue: 5600000, profit: 495000, shipments: 24, deals: 19 },
  { month: "May", revenue: 6900000, profit: 620000, shipments: 28, deals: 23 },
  { month: "Jun", revenue: 7400000, profit: 685000, shipments: 31, deals: 26 },
  { month: "Jul", revenue: 8016555, profit: 731250, shipments: 34, deals: 29 },
  { month: "Aug", revenue: 8350000, profit: 768000, shipments: 36, deals: 31 },
];

const riskRows = [
  { area: "Treasury", issue: "IRR short position", exposure: "AED 760K equivalent", owner: "Treasury", status: "Critical" },
  { area: "Finance", issue: "MODAVA overdue receipt", exposure: "AED 540K", owner: "Commercial", status: "High" },
  { area: "Logistics", issue: "Kekule shipment delay", exposure: "AED 185K", owner: "Logistics", status: "High" },
  { area: "Commercial", issue: "Low-margin quotation", exposure: "AED 1.85M deal", owner: "Commercial", status: "Medium" },
];

function money(value: number) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value); }

export function ReportsIntelligence() {
  const [period, setPeriod] = useState("6M");
  const latest = monthly[monthly.length - 1];
  const previous = monthly[monthly.length - 2];
  const totals = useMemo(() => ({
    revenue: monthly.reduce((sum, row) => sum + row.revenue, 0),
    profit: monthly.reduce((sum, row) => sum + row.profit, 0),
    shipments: monthly.reduce((sum, row) => sum + row.shipments, 0),
    deals: monthly.reduce((sum, row) => sum + row.deals, 0),
  }), []);
  const maxRevenue = Math.max(...monthly.map((row) => row.revenue));

  return (
    <main className="min-h-screen bg-[#060a12] p-5 text-white md:p-8">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-8 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-400">VTC Management Intelligence</p><h1 className="mt-2 text-3xl font-bold">Reports & Analytics Center</h1><p className="mt-2 max-w-3xl text-sm text-slate-400">Executive reporting across commercial performance, treasury exposure, logistics operations and financial control.</p></div>
          <div className="flex flex-wrap gap-2">{["1M", "3M", "6M", "YTD"].map((item) => <button key={item} onClick={() => setPeriod(item)} className={`rounded-xl px-4 py-3 text-sm font-semibold ${period === item ? "bg-blue-600" : "border border-slate-700 bg-slate-900 text-slate-300"}`}>{item}</button>)}</div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[["Revenue", `AED ${money(totals.revenue)}`, `Latest: AED ${money(latest.revenue)}`, "text-blue-400"], ["Gross Profit", `AED ${money(totals.profit)}`, `${(((latest.profit - previous.profit) / previous.profit) * 100).toFixed(1)}% monthly growth`, "text-emerald-400"], ["Shipments", String(totals.shipments), `${latest.shipments} in latest month`, "text-amber-300"], ["Commercial Deals", String(totals.deals), `${latest.deals} in latest month`, "text-purple-400"]].map(([label, value, detail, color]) => <article key={label} className="rounded-2xl border border-slate-800 bg-[#0d1423] p-5"><p className="text-sm text-slate-400">{label}</p><p className={`mt-3 text-2xl font-bold ${color}`}>{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></article>)}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-6">
            <div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">Revenue & Profit Trend</h2><p className="mt-1 text-sm text-slate-500">Period: {period}</p></div><span className="text-xs text-slate-500">AED equivalent</span></div>
            <div className="mt-8 grid h-72 grid-cols-6 items-end gap-3">{monthly.map((row) => <div key={row.month} className="flex h-full flex-col justify-end gap-2"><div className="flex flex-1 items-end justify-center gap-1"><div title={`Revenue AED ${money(row.revenue)}`} className="w-5 rounded-t bg-blue-500" style={{ height: `${(row.revenue / maxRevenue) * 100}%` }} /><div title={`Profit AED ${money(row.profit)}`} className="w-5 rounded-t bg-emerald-500" style={{ height: `${Math.max(8, (row.profit / maxRevenue) * 100 * 5)}%` }} /></div><p className="text-center text-xs text-slate-500">{row.month}</p></div>)}</div>
            <div className="mt-5 flex gap-5 text-xs text-slate-400"><span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" />Revenue</span><span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />Profit</span></div>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-6">
            <h2 className="text-xl font-semibold">Report Library</h2><div className="mt-5 space-y-3">{[["Treasury Exposure Report", "/reports/treasury", "Positions, coverage and rate risk"], ["Commercial Performance", "/reports/commercial", "Pipeline, margin and conversion"], ["Logistics Operations", "/reports/logistics", "Shipments, delays and costs"], ["Finance Control", "/finance", "Receivables, payables and liquidity"]].map(([label, href, desc]) => <Link key={href} href={href} className="block rounded-xl border border-slate-800 bg-slate-950/40 p-4 transition hover:border-blue-500/50"><p className="font-semibold">{label}</p><p className="mt-1 text-xs text-slate-500">{desc}</p></Link>)}</div>
          </article>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1423]">
          <div className="border-b border-slate-800 p-5"><h2 className="text-xl font-semibold">Top Management Risks</h2></div>
          <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-950/40 text-left text-xs uppercase tracking-wider text-slate-500"><tr>{["Area", "Issue", "Exposure", "Owner", "Status"].map((header) => <th key={header} className="px-5 py-4">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{riskRows.map((row) => <tr key={row.issue}><td className="px-5 py-4 font-semibold">{row.area}</td><td className="px-5 py-4 text-slate-300">{row.issue}</td><td className="px-5 py-4">{row.exposure}</td><td className="px-5 py-4 text-slate-400">{row.owner}</td><td className="px-5 py-4"><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${row.status === "Critical" ? "border-red-500/30 bg-red-500/10 text-red-300" : row.status === "High" ? "border-orange-500/30 bg-orange-500/10 text-orange-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>{row.status}</span></td></tr>)}</tbody></table></div>
        </section>
      </div>
    </main>
  );
}
