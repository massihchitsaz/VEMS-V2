"use client";

import { useMemo, useState } from "react";
import { initialAuditRecords, type AuditRecord } from "@/lib/administration-data";

function resultClass(result: AuditRecord["result"]) {
  if (result === "SUCCESS") return "text-emerald-400";
  if (result === "FAILED") return "text-red-400";
  return "text-amber-300";
}

export function AuditLog() {
  const [query, setQuery] = useState("");
  const [module, setModule] = useState("ALL");
  const filtered = useMemo(() => initialAuditRecords.filter((item) => {
    const matches = `${item.actor} ${item.action} ${item.reference}`.toLowerCase().includes(query.toLowerCase());
    return matches && (module === "ALL" || item.module === module);
  }), [module, query]);

  return (
    <main className="min-h-screen bg-[#060a12] p-5 text-white md:p-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-7"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-400">Governance & Internal Control</p><h1 className="mt-2 text-3xl font-bold">Audit Log</h1><p className="mt-2 text-sm text-slate-400">Immutable operational history for decisions, transactions and control events.</p></header>
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1423]">
          <div className="flex flex-col gap-3 border-b border-slate-800 p-5 md:flex-row"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search actor, action or reference..." className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" /><select value={module} onChange={(event) => setModule(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500">{["ALL", "COMMERCIAL", "TREASURY", "LOGISTICS", "FINANCE", "ADMIN"].map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-4">Time</th><th className="px-5 py-4">Actor</th><th className="px-5 py-4">Action</th><th className="px-5 py-4">Module</th><th className="px-5 py-4">Reference</th><th className="px-5 py-4">Result</th></tr></thead><tbody className="divide-y divide-slate-800">{filtered.map((item) => <tr key={item.id} className="hover:bg-slate-900/50"><td className="px-5 py-4 text-slate-400">{new Date(item.timestamp).toLocaleString("en-GB")}</td><td className="px-5 py-4 font-semibold text-white">{item.actor}</td><td className="px-5 py-4 text-slate-300">{item.action}</td><td className="px-5 py-4 text-slate-400">{item.module}</td><td className="px-5 py-4 text-blue-300">{item.reference}</td><td className={`px-5 py-4 font-semibold ${resultClass(item.result)}`}>{item.result}</td></tr>)}</tbody></table></div>
        </section>
      </div>
    </main>
  );
}
