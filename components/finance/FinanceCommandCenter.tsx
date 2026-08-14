"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getFinanceDashboardData } from "@/lib/finance-dashboard";

type Invoice = any;
type Payment = any;

const money = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value || 0);
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function tone(status: string) {
  const s = (status || "").toLowerCase();
  if (["overdue", "failed", "cancelled", "rejected"].includes(s)) return "border-red-500/30 bg-red-500/10 text-red-300";
  if (["pending", "issued", "partially_paid", "pending_approval"].includes(s)) return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  if (["paid", "completed", "approved"].includes(s)) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  return "border-blue-500/30 bg-blue-500/10 text-blue-300";
}

function statusText(value: string) {
  return (value || "").replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function FinanceCommandCenter() {
  const [data, setData] = useState<{ invoices: Invoice[]; payments: Payment[]; approvals: any[] }>({ invoices: [], payments: [], approvals: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState("AED");

  async function load() {
    try {
      setLoading(true);
      setError("");
      setData(await getFinanceDashboardData());
    } catch (e: any) {
      setError(e?.message || "Unable to load finance data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const model = useMemo(() => {
    const postedPaymentStatuses = new Set(["approved", "completed"]);
    const paidByInvoice = new Map<string, number>();
    for (const p of data.payments) {
      if (!p.invoice_id || !postedPaymentStatuses.has(String(p.status).toLowerCase())) continue;
      paidByInvoice.set(p.invoice_id, (paidByInvoice.get(p.invoice_id) || 0) + Number(p.amount || 0));
    }

    const invoices = data.invoices.map(inv => {
      const total = Number(inv.total_amount || inv.amount || 0);
      const paid = paidByInvoice.get(inv.id) || 0;
      const outstanding = Math.max(0, total - paid);
      const due = inv.due_date ? new Date(`${inv.due_date}T23:59:59`) : null;
      const overdue = !!due && due.getTime() < Date.now() && outstanding > 0 && !["paid", "cancelled"].includes(String(inv.status).toLowerCase());
      return { ...inv, total, paid, outstanding, overdue, dueDate: due };
    });

    const currencies = Array.from(new Set([...invoices.map(x => x.currency), ...data.payments.map(x => x.currency)].filter(Boolean))).sort();
    const activeCurrency = currencies.includes(currency) ? currency : currencies[0] || "AED";
    const scoped = invoices.filter(x => x.currency === activeCurrency);
    const receivables = scoped.filter(x => x.invoice_type === "receivable" && x.outstanding > 0 && x.status !== "cancelled");
    const payables = scoped.filter(x => x.invoice_type === "payable" && x.outstanding > 0 && x.status !== "cancelled");
    const sum = (arr: any[], key = "outstanding") => arr.reduce((n, x) => n + Number(x[key] || 0), 0);

    const now = Date.now();
    const horizon = (days: number) => now + days * 86400000;
    const dueWithin = (arr: any[], days: number) => arr.filter(x => x.dueDate && x.dueDate.getTime() >= now && x.dueDate.getTime() <= horizon(days));

    const forecast = [
      { label: "Today", days: 0.999 },
      { label: "7 Days", days: 7 },
      { label: "14 Days", days: 14 },
      { label: "30 Days", days: 30 },
    ].map(bucket => {
      const inflow = sum(dueWithin(receivables, bucket.days));
      const outflow = sum(dueWithin(payables, bucket.days));
      return { ...bucket, inflow, outflow, net: inflow - outflow };
    });

    const pendingPayments = data.payments.filter(p => ["pending", "approved"].includes(String(p.status).toLowerCase()));
    const failedPayments = data.payments.filter(p => ["failed", "cancelled"].includes(String(p.status).toLowerCase()));
    const unappliedPayments = data.payments.filter(p => !p.invoice_id && !["failed", "cancelled"].includes(String(p.status).toLowerCase()));
    const pendingApprovals = data.approvals.filter(a => a.status === "pending");

    return {
      invoices,
      currencies,
      activeCurrency,
      receivables,
      payables,
      totalReceivables: sum(receivables),
      totalPayables: sum(payables),
      overdueReceivables: sum(receivables.filter(x => x.overdue)),
      overduePayables: sum(payables.filter(x => x.overdue)),
      due7Receivables: sum(dueWithin(receivables, 7)),
      due7Payables: sum(dueWithin(payables, 7)),
      forecast,
      pendingPayments,
      failedPayments,
      unappliedPayments,
      pendingApprovals,
    };
  }, [data, currency]);

  useEffect(() => {
    if (model.activeCurrency !== currency) setCurrency(model.activeCurrency);
  }, [model.activeCurrency, currency]);

  const priorityReceivables = [...model.receivables].sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.dueDate?.getTime() || Infinity) - (b.dueDate?.getTime() || Infinity)).slice(0, 6);
  const priorityPayables = [...model.payables].sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.dueDate?.getTime() || Infinity) - (b.dueDate?.getTime() || Infinity)).slice(0, 6);

  return (
    <main className="min-h-screen bg-[#060a12] p-5 text-white md:p-8">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-7 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-400">VTC Finance Control</p>
            <h1 className="mt-2 text-3xl font-bold">Finance Command Center</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">Live receivables, payables, settlement exposure, approvals and near-term funding requirements from operational records.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {model.currencies.length > 1 && <select value={currency} onChange={e => setCurrency(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm">{model.currencies.map(c => <option key={c}>{c}</option>)}</select>}
            <button onClick={load} disabled={loading} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold hover:border-slate-500 disabled:opacity-50">{loading ? "Refreshing..." : "Refresh"}</button>
            <Link href="/finance/payments" className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500">Payment Workspace</Link>
          </div>
        </header>

        {error && <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {[
            ["Receivables", `${model.activeCurrency} ${money(model.totalReceivables)}`, `${model.receivables.length} open invoices`, "text-emerald-400"],
            ["Payables", `${model.activeCurrency} ${money(model.totalPayables)}`, `${model.payables.length} open invoices`, "text-red-400"],
            ["Net Exposure", `${model.totalReceivables - model.totalPayables >= 0 ? "+" : "-"}${model.activeCurrency} ${money(Math.abs(model.totalReceivables - model.totalPayables))}`, "Open invoices only", model.totalReceivables >= model.totalPayables ? "text-emerald-400" : "text-red-400"],
            ["Overdue AR", `${model.activeCurrency} ${money(model.overdueReceivables)}`, "Collection escalation", "text-amber-300"],
            ["Due in 7 Days", `${model.activeCurrency} ${money(model.due7Payables)}`, "Payables funding need", "text-blue-300"],
            ["Pending Approvals", String(model.pendingApprovals.length), `${model.pendingPayments.length} payment records in process`, "text-violet-300"],
          ].map(([label, value, detail, color]) => <article key={String(label)} className="rounded-2xl border border-slate-800 bg-[#0d1423] p-5"><p className="text-sm text-slate-400">{label}</p><p className={`mt-3 text-2xl font-bold ${color}`}>{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></article>)}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
          <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">30-Day Cash Requirement</h2><p className="mt-1 text-sm text-slate-500">Invoice due-date forecast in {model.activeCurrency}. This is exposure, not bank balance.</p></div><Link href="/cash-flow" className="text-sm font-semibold text-blue-400">Open Cash Flow →</Link></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{model.forecast.map(x => <div key={x.label} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><p className="text-xs text-slate-500">{x.label}</p><p className={`mt-2 text-lg font-bold ${x.net >= 0 ? "text-emerald-400" : "text-red-400"}`}>{x.net >= 0 ? "+" : "-"}{model.activeCurrency} {money(Math.abs(x.net))}</p><div className="mt-3 space-y-1 text-xs"><div className="flex justify-between text-slate-400"><span>Inflows</span><span>{money(x.inflow)}</span></div><div className="flex justify-between text-slate-400"><span>Outflows</span><span>{money(x.outflow)}</span></div></div></div>)}</div>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-6">
            <h2 className="text-xl font-semibold">Control Exceptions</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Overdue Payables", model.payables.filter(x => x.overdue).length, "/finance/payables", "Supplier exposure"],
                ["Failed / Cancelled Payments", model.failedPayments.length, "/finance/payments", "Bank or processing exceptions"],
                ["Unapplied Payments", model.unappliedPayments.length, "/finance/payments", "Need invoice allocation"],
                ["Pending Approvals", model.pendingApprovals.length, "/approvals", "Awaiting decision"],
              ].map(([label, value, href, desc]) => <Link key={String(label)} href={String(href)} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 hover:border-blue-500/50"><div className="flex items-start justify-between gap-4"><div><p className="font-semibold">{label}</p><p className="mt-1 text-xs text-slate-500">{desc}</p></div><span className="rounded-lg bg-slate-900 px-3 py-1 text-lg font-bold">{value}</span></div></Link>)}
            </div>
          </article>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <FinanceList title="Priority Receivables" href="/finance/receivables" rows={priorityReceivables} counterpartyKey="customer" currency={model.activeCurrency} />
          <FinanceList title="Priority Payables" href="/finance/payables" rows={priorityPayables} counterpartyKey="supplier" currency={model.activeCurrency} />
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-[#0d1423] p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><h2 className="text-xl font-semibold">Finance Workspaces</h2><p className="mt-1 text-sm text-slate-500">Every shortcut below opens an operational module. No decorative controls.</p></div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{[
            ["Receivables", "/finance/receivables", "Collections and customer balances"],
            ["Payables", "/finance/payables", "Supplier liabilities and due dates"],
            ["Payments", "/finance/payments", "Instructions and settlement status"],
            ["Banking", "/banking", "Accounts and transfer control"],
            ["Cash Flow", "/cash-flow", "Funding forecast"],
            ["FX Exposure", "/fx/positions", "Currency position management"],
          ].map(([label, href, desc]) => <Link key={href} href={href} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 transition hover:border-blue-500/50 hover:bg-blue-500/5"><p className="font-semibold">{label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{desc}</p></Link>)}</div>
        </section>
      </div>
    </main>
  );
}

function FinanceList({ title, href, rows, counterpartyKey, currency }: { title: string; href: string; rows: any[]; counterpartyKey: "customer" | "supplier"; currency: string }) {
  return <article className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1423]"><div className="flex items-center justify-between border-b border-slate-800 p-5"><h2 className="font-semibold">{title}</h2><Link href={href} className="text-sm text-blue-400">View all</Link></div>{rows.length ? <div className="divide-y divide-slate-800">{rows.map(row => { const party = row[counterpartyKey]; const name = Array.isArray(party) ? party[0]?.company_name : party?.company_name; return <div key={row.id} className="grid gap-3 p-5 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><p className="font-medium">{name || "Unassigned counterparty"}</p><p className="mt-1 text-xs text-slate-500">{row.invoice_no} · Due {dateLabel(row.due_date)}</p></div><p className="font-semibold">{currency} {money(row.outstanding)}</p><span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${row.overdue ? tone("overdue") : tone(row.status)}`}>{row.overdue ? "Overdue" : statusText(row.status)}</span></div>})}</div> : <div className="p-8 text-center text-sm text-slate-500">No open items in this currency.</div>}</article>;
}
