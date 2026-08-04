"use client";

import { useEffect, useMemo, useState } from "react";
import { initialDocuments, type DocumentRecord, type DocumentStatus } from "@/lib/administration-data";

const storageKey = "vems-documents-v1";
const statuses: DocumentStatus[] = ["DRAFT", "UNDER_REVIEW", "APPROVED", "EXPIRED"];

function statusClass(status: DocumentStatus) {
  if (status === "APPROVED") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (status === "UNDER_REVIEW") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  if (status === "EXPIRED") return "border-red-500/30 bg-red-500/10 text-red-300";
  return "border-slate-600 bg-slate-800 text-slate-300";
}

export function DocumentCenter() {
  const [documents, setDocuments] = useState<DocumentRecord[]>(initialDocuments);
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("ALL");

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      try { setDocuments(JSON.parse(raw) as DocumentRecord[]); } catch { localStorage.removeItem(storageKey); }
    }
  }, []);

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(documents)); }, [documents]);

  const filtered = useMemo(() => documents.filter((document) => {
    const matchesQuery = `${document.title} ${document.reference} ${document.owner}`.toLowerCase().includes(query.toLowerCase());
    const matchesModule = moduleFilter === "ALL" || document.module === moduleFilter;
    return matchesQuery && matchesModule;
  }), [documents, moduleFilter, query]);

  const summary = useMemo(() => ({
    total: documents.length,
    approved: documents.filter((item) => item.status === "APPROVED").length,
    review: documents.filter((item) => item.status === "UNDER_REVIEW").length,
    expired: documents.filter((item) => item.status === "EXPIRED").length,
  }), [documents]);

  function cycleStatus(id: string) {
    setDocuments((current) => current.map((item) => {
      if (item.id !== id) return item;
      const nextIndex = (statuses.indexOf(item.status) + 1) % statuses.length;
      return { ...item, status: statuses[nextIndex], updatedAt: new Date().toISOString() };
    }));
  }

  return (
    <main className="min-h-screen bg-[#060a12] p-5 text-white md:p-8">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-400">VTC Group Information Control</p>
            <h1 className="mt-2 text-3xl font-bold">Document Center</h1>
            <p className="mt-2 text-sm text-slate-400">Control commercial, treasury, logistics and compliance documents from one register.</p>
          </div>
          <button type="button" className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500">+ Register Document</button>
        </header>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[["Total Documents", summary.total, "text-blue-400"], ["Approved", summary.approved, "text-emerald-400"], ["Under Review", summary.review, "text-amber-300"], ["Expired", summary.expired, "text-red-400"]].map(([label, value, color]) => (
            <article key={String(label)} className="rounded-2xl border border-slate-800 bg-[#0d1423] p-5">
              <p className="text-sm text-slate-400">{label}</p>
              <p className={`mt-3 text-3xl font-bold ${color}`}>{value}</p>
            </article>
          ))}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1423]">
          <div className="flex flex-col gap-3 border-b border-slate-800 p-5 md:flex-row">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, reference or owner..." className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
            <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500">
              {["ALL", "COMMERCIAL", "TREASURY", "LOGISTICS", "FINANCE", "ADMIN"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-4">Document</th><th className="px-5 py-4">Module</th><th className="px-5 py-4">Reference</th><th className="px-5 py-4">Owner</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Updated</th><th className="px-5 py-4">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map((document) => (
                  <tr key={document.id} className="hover:bg-slate-900/50">
                    <td className="px-5 py-4"><p className="font-semibold text-white">{document.title}</p><p className="mt-1 text-xs text-slate-500">{document.id} · {document.category}</p></td>
                    <td className="px-5 py-4 text-slate-300">{document.module}</td>
                    <td className="px-5 py-4 text-blue-300">{document.reference}</td>
                    <td className="px-5 py-4 text-slate-300">{document.owner}</td>
                    <td className="px-5 py-4"><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(document.status)}`}>{document.status.replace("_", " ")}</span></td>
                    <td className="px-5 py-4 text-slate-400">{new Date(document.updatedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-5 py-4"><button type="button" onClick={() => cycleStatus(document.id)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-blue-500 hover:text-white">Advance Status</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
