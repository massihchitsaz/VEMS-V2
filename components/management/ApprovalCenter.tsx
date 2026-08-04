"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
type ApprovalRecord = {
  id: string;
  module: "Treasury" | "Commercial" | "Finance" | "Logistics";
  reference: string;
  title: string;
  requestedBy: string;
  amount: number;
  currency: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  submittedAt: string;
  reason: string;
  status: ApprovalStatus;
  decisionNote?: string;
};

const initialApprovals: ApprovalRecord[] = [
  { id: "APR-260803-001", module: "Treasury", reference: "FX-260803-014", title: "IRR purchase above treasury limit", requestedBy: "Dealer Desk", amount: 4000000000, currency: "IRR", priority: "CRITICAL", submittedAt: "03 Aug 2026, 15:12", reason: "Customer settlement is due today and the market moved beyond the approved limit.", status: "PENDING" },
  { id: "APR-260803-002", module: "Finance", reference: "PAY-260803-008", title: "Urgent supplier payment to Kekule", requestedBy: "Finance Team", amount: 760000, currency: "AED", priority: "HIGH", submittedAt: "03 Aug 2026, 14:38", reason: "Release of delayed shipment requires proof of payment today.", status: "PENDING" },
  { id: "APR-260802-011", module: "Commercial", reference: "QTN-260802-019", title: "Margin exception for Power & Sun quotation", requestedBy: "Commercial Desk", amount: 1850000, currency: "AED", priority: "MEDIUM", submittedAt: "02 Aug 2026, 18:05", reason: "Strategic customer request with forecasted repeat volume.", status: "PENDING" },
  { id: "APR-260802-009", module: "Logistics", reference: "SHP-260802-004", title: "Additional Jebel Ali storage charges", requestedBy: "Logistics Team", amount: 48500, currency: "AED", priority: "HIGH", submittedAt: "02 Aug 2026, 13:20", reason: "Cargo missed the planned sailing and requires immediate storage confirmation.", status: "PENDING" },
];

const storageKey = "vems-approval-center-v1";

function money(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function priorityClass(priority: ApprovalRecord["priority"]) {
  if (priority === "CRITICAL") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (priority === "HIGH") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  if (priority === "MEDIUM") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-slate-500/30 bg-slate-500/10 text-slate-300";
}

function statusClass(status: ApprovalStatus) {
  if (status === "APPROVED") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (status === "REJECTED") return "border-red-500/30 bg-red-500/10 text-red-300";
  return "border-amber-500/30 bg-amber-500/10 text-amber-300";
}

export function ApprovalCenter() {
  const [records, setRecords] = useState<ApprovalRecord[]>(initialApprovals);
  const [filter, setFilter] = useState<"ALL" | ApprovalStatus>("PENDING");
  const [selectedId, setSelectedId] = useState<string | null>(initialApprovals[0]?.id ?? null);
  const [note, setNote] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;
    try { setRecords(JSON.parse(saved) as ApprovalRecord[]); } catch { window.localStorage.removeItem(storageKey); }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(records));
  }, [records]);

  const selected = records.find((record) => record.id === selectedId) ?? null;
  const filtered = records.filter((record) => filter === "ALL" || record.status === filter);
  const summary = useMemo(() => ({
    pending: records.filter((record) => record.status === "PENDING").length,
    critical: records.filter((record) => record.status === "PENDING" && record.priority === "CRITICAL").length,
    approved: records.filter((record) => record.status === "APPROVED").length,
    rejected: records.filter((record) => record.status === "REJECTED").length,
  }), [records]);

  function decide(status: "APPROVED" | "REJECTED") {
    if (!selected) return;
    setRecords((current) => current.map((record) => record.id === selected.id ? { ...record, status, decisionNote: note.trim() || undefined } : record));
    setNote("");
  }

  return (
    <main className="min-h-screen bg-[#060a12] p-5 text-white md:p-8">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-8 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-400">VTC Group Control Workflow</p>
            <h1 className="mt-2 text-3xl font-bold">Approval Center</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">Review treasury exceptions, commercial margin requests, payment instructions and logistics cost escalations from one queue.</p>
          </div>
          <Link href="/" className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-200 hover:border-slate-500">Executive Dashboard</Link>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[["Pending", summary.pending, "Awaiting decision", "text-amber-300"], ["Critical", summary.critical, "Immediate attention", "text-red-400"], ["Approved", summary.approved, "Completed decisions", "text-emerald-400"], ["Rejected", summary.rejected, "Declined requests", "text-slate-300"]].map(([label, value, detail, color]) => (
            <article key={String(label)} className="rounded-2xl border border-slate-800 bg-[#0d1423] p-5">
              <p className="text-sm text-slate-400">{label}</p><p className={`mt-3 text-3xl font-bold ${color}`}>{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p>
            </article>
          ))}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1423]">
            <div className="flex flex-col gap-4 border-b border-slate-800 p-5 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold">Approval Queue</h2>
              <div className="flex flex-wrap gap-2">{(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${filter === item ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400"}`}>{item}</button>)}</div>
            </div>
            <div className="divide-y divide-slate-800">
              {filtered.map((record) => (
                <button key={record.id} type="button" onClick={() => setSelectedId(record.id)} className={`grid w-full gap-3 p-5 text-left transition sm:grid-cols-[1fr_auto_auto] sm:items-center ${selectedId === record.id ? "bg-blue-500/10" : "hover:bg-slate-900/60"}`}>
                  <div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{record.title}</p><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${priorityClass(record.priority)}`}>{record.priority}</span></div><p className="mt-1 text-xs text-slate-500">{record.reference} · {record.module} · {record.requestedBy}</p></div>
                  <p className="font-semibold">{record.currency} {money(record.amount)}</p>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(record.status)}`}>{record.status}</span>
                </button>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-6">
            {selected ? <>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.2em] text-blue-400">{selected.id}</p><h2 className="mt-2 text-2xl font-bold">{selected.title}</h2></div><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(selected.status)}`}>{selected.status}</span></div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">{[["Module", selected.module], ["Reference", selected.reference], ["Requested By", selected.requestedBy], ["Submitted", selected.submittedAt]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 font-semibold">{value}</p></div>)}</div>
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4"><p className="text-xs text-slate-500">Commercial Justification</p><p className="mt-2 text-sm leading-6 text-slate-300">{selected.reason}</p></div>
              <div className="mt-4 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4"><p className="text-xs text-blue-200/70">Requested Amount</p><p className="mt-2 text-2xl font-bold text-blue-300">{selected.currency} {money(selected.amount)}</p></div>
              {selected.status === "PENDING" ? <>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Decision note or conditions..." className="mt-5 min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
                <div className="mt-4 grid gap-3 sm:grid-cols-2"><button onClick={() => decide("REJECTED")} className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-3 font-semibold text-red-300 hover:bg-red-500/20">Reject</button><button onClick={() => decide("APPROVED")} className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-500">Approve</button></div>
              </> : <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4"><p className="text-xs text-slate-500">Decision Note</p><p className="mt-2 text-sm text-slate-300">{selected.decisionNote ?? "No note recorded."}</p></div>}
            </> : <p className="text-sm text-slate-500">Select an approval request.</p>}
          </article>
        </section>
      </div>
    </main>
  );
}
