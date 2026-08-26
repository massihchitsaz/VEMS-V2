"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listQuotationWorkspace, saveQuotation, type QuoteLine } from "@/lib/quotations";
import { convertQuotationToDeal, decideQuotation, getCommercialFlowPermissions, submitQuotationForReview } from "@/lib/commercial-flow";

const field = "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60";
const btn = "rounded-xl border border-slate-700 bg-slate-950/30 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-blue-500 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-40";
const primary = "rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40";
const money = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const line = (description = ""): QuoteLine => ({ description, qty: 1, unit: "Unit", cost: 0, sell: 0 });
const empty = () => ({ id: "", quotation_no: "", quotation_type: "trading", customer_id: "", supplier_id: "", opportunity_id: "", title: "", contact_person: "", currency: "AED", valid_until: "", incoterm: "EXW", payment_terms: "As agreed", origin: "", destination: "", mode: "Sea", commodity: "", hs_code: "", packing_details: "", gross_weight: "", volume_details: "", notes: "", status: "draft", revision: 1, lines: [line()] });

const logisticsCharges = [
  "OCEAN FREIGHT", "AIR FREIGHT", "LAND TRANSPORT", "THC / TERMINAL HANDLING", "DELIVERY ORDER",
  "BILL OF LADING FEE", "CUSTOMS CLEARANCE", "CUSTOMS INSPECTION", "CUSTOMS DEPOSIT FEE", "DOCUMENTATION",
  "CROSS STUFFING", "STORAGE", "LIFT TRUCK / CRANE", "PACKING / PALLETIZING", "RE-PACKING", "TRANSIT",
  "VGM", "SEAL SERVICE", "GATE PASS", "REEFER PLUG-IN", "SERVICE CHARGES"
];

export function QuotationWorkspaceV4() {
  const [data, setData] = useState<any>({ quotations: [], customers: [], suppliers: [], opportunities: [] });
  const [f, setF] = useState<any>(empty());
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"builder" | "saved">("builder");
  const [search, setSearch] = useState("");
  const [permissions, setPermissions] = useState({ role: "unknown", canControl: false, canWrite: false });

  const load = async () => {
    setBusy("load");
    try {
      const [d, p] = await Promise.all([listQuotationWorkspace(), getCommercialFlowPermissions()]);
      setData(d);
      setPermissions(p);
    } catch (e: any) {
      setNotice(e?.message || "Unable to load quotations.");
    } finally {
      setBusy("");
    }
  };
  useEffect(() => { void load(); }, []);

  const patch = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const patchLine = (i: number, p: Partial<QuoteLine>) => setF((x: any) => ({ ...x, lines: x.lines.map((r: QuoteLine, n: number) => n === i ? { ...r, ...p } : r) }));
  const totals = useMemo(() => {
    const cost = f.lines.reduce((n: number, r: QuoteLine) => n + Number(r.qty || 0) * Number(r.cost || 0), 0);
    const sell = f.lines.reduce((n: number, r: QuoteLine) => n + Number(r.qty || 0) * Number(r.sell || 0), 0);
    return { cost, sell, profit: sell - cost, margin: sell ? ((sell - cost) / sell) * 100 : 0 };
  }, [f.lines]);

  const editable = ["draft", "rejected"].includes(f.status);
  const isLogistics = f.quotation_type === "logistics";
  const approvedDeal = data.quotations.find((q: any) => q.id === f.id)?.deals?.[0];
  const validSuppliers = data.suppliers.filter((x: any) => x.status === "active" && x.kyc_status === "approved" && (!x.kyc_expiry_date || x.kyc_expiry_date >= new Date().toISOString().slice(0, 10)));
  const typeLabel = isLogistics ? "LOGISTICS QUOTATION" : "COMMERCIAL QUOTATION";

  async function save() {
    if (!editable) return setNotice("This quotation is workflow-controlled and cannot be edited in its current status.");
    setBusy("save");
    try {
      const q: any = await saveQuotation({ ...f, quotation_no: f.quotation_no || null, customer_id: f.customer_id || null, supplier_id: f.supplier_id || null, opportunity_id: f.opportunity_id || null, valid_until: f.valid_until || null });
      setF((x: any) => ({ ...x, id: q.id, status: q.status, revision: q.revision, quotation_no: q.quotation_no || "" }));
      setNotice(q.quotation_no ? `${typeLabel} ${q.quotation_no} saved · Rev ${q.revision}.` : `${typeLabel} draft saved.`);
      await load();
    } catch (e: any) {
      setNotice(e?.message || "Could not save quotation.");
    } finally {
      setBusy("");
    }
  }

  async function action(key: string, fn: () => Promise<any>, ok: string) {
    setBusy(key);
    try {
      const q: any = await fn();
      if (q?.id && q?.status) setF((x: any) => ({ ...x, status: q.status, revision: q.revision ?? x.revision }));
      setNotice(ok);
      await load();
    } catch (e: any) {
      setNotice(e?.message || "Action failed.");
    } finally {
      setBusy("");
    }
  }

  function open(q: any) {
    setF({ id: q.id, quotation_no: q.quotation_no || "", quotation_type: q.quotation_type || "trading", customer_id: q.customer_id || "", supplier_id: q.supplier_id || "", opportunity_id: q.opportunity_id || "", title: q.title || "", contact_person: q.contact_person || "", currency: q.currency || "AED", valid_until: q.valid_until || "", incoterm: q.incoterm || "EXW", payment_terms: q.payment_terms || "As agreed", origin: q.origin || "", destination: q.destination || "", mode: q.mode || "Sea", commodity: q.commodity || "", hs_code: q.hs_code || "", packing_details: q.packing_details || "", gross_weight: q.gross_weight || "", volume_details: q.volume_details || "", notes: q.notes || "", status: q.status || "draft", revision: q.revision || 1, lines: q.quotation_items?.length ? q.quotation_items.sort((a: any, b: any) => a.line_no - b.line_no).map((r: any) => ({ description: r.description, qty: Number(r.quantity), unit: r.unit || "Unit", cost: Number(r.unit_cost), sell: Number(r.unit_sell) })) : [line()] });
    setTab("builder");
    setNotice(`Opened ${q.quotation_no || "draft"} · Rev ${q.revision || 1}`);
  }

  const saved = data.quotations.filter((q: any) => `${q.quotation_no || ""} ${q.title || ""} ${q.customers?.company_name || ""} ${q.quotation_type || ""}`.toLowerCase().includes(search.toLowerCase()));
  const addLogisticsCharge = (charge: string) => {
    if (!editable || f.lines.some((r: QuoteLine) => r.description === charge)) return;
    patch("lines", [...f.lines, line(charge)]);
  };

  return <main className="min-h-screen bg-[#070b14] p-5 text-white md:p-8 print:bg-white print:p-0 print:text-black">
    <div className="print:hidden">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.24em] text-blue-400">VTC ONE · Quotation Control</p>
          <h1 className="mt-2 text-3xl font-bold">Quotation Management</h1>
          <p className="mt-2 max-w-4xl text-sm text-slate-400">Two controlled quotation formats: Commercial Quotation for trading and product sales, and Logistics Quotation for freight, customs, transport and operational services.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/commercial" className={btn}>Commercial Flow</Link>
          <button onClick={() => { setF(empty()); setTab("builder"); setNotice(""); }} className={btn}>+ New Quotation</button>
          <button onClick={() => window.print()} className={btn}>Print / PDF</button>
          <button onClick={() => void load()} disabled={busy === "load"} className={btn}>{busy === "load" ? "Refreshing..." : "Refresh"}</button>
        </div>
      </header>

      {notice && <div className="mt-5 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-100">{notice}</div>}

      <div className="mt-5 flex gap-2">
        <button onClick={() => setTab("builder")} className={tab === "builder" ? primary : btn}>Builder</button>
        <button onClick={() => setTab("saved")} className={tab === "saved" ? primary : btn}>Saved ({data.quotations.length})</button>
      </div>

      {tab === "saved" ? <section className="mt-5 overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1423]">
        <div className="p-4"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quotation, customer, title or type" className={field} /></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm"><thead className="bg-slate-950/50 text-left text-xs uppercase text-slate-500"><tr><th className="p-4">Quotation</th><th>Type</th><th>Customer</th><th>Supplier</th><th>Value</th><th>Margin</th><th>Status</th><th>Revision</th><th className="p-4 text-right">Action</th></tr></thead><tbody>{saved.map((q: any) => <tr key={q.id} className="border-t border-slate-800"><td className="p-4"><b>{q.quotation_no || "Unnumbered Draft"}</b><div className="text-xs text-slate-500">{q.title}</div></td><td><span className={`rounded-lg border px-2 py-1 text-xs ${q.quotation_type === "logistics" ? "border-cyan-900 bg-cyan-950/30 text-cyan-300" : "border-blue-900 bg-blue-950/30 text-blue-300"}`}>{q.quotation_type === "logistics" ? "Logistics" : "Commercial"}</span></td><td>{q.customers?.company_name || "—"}</td><td>{q.suppliers?.company_name || "—"}</td><td>{q.currency} {money.format(Number(q.total_amount || 0))}</td><td>{Number(q.margin_percent || 0).toFixed(1)}%</td><td><Badge v={q.status} /></td><td>Rev {q.revision || 1}</td><td className="p-4 text-right"><button onClick={() => open(q)} className={btn}>Open</button></td></tr>)}{!saved.length && <tr><td colSpan={9} className="p-10 text-center text-slate-500">No quotations found.</td></tr>}</tbody></table></div>
      </section> : <>
        <section className="mt-5 grid gap-4 lg:grid-cols-2">
          <button disabled={!editable} onClick={() => patch("quotation_type", "trading")} className={`rounded-2xl border p-6 text-left transition ${!isLogistics ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-950/20" : "border-slate-800 bg-[#0d1423] hover:border-slate-600"}`}>
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-400">Format 01</p><h2 className="mt-2 text-xl font-bold">COMMERCIAL QUOTATION</h2></div>{!isLogistics && <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold">Selected</span>}</div>
            <p className="mt-3 text-sm leading-6 text-slate-400">For sale of goods, products and commercial supply. Includes supplier, product/commodity, HS code, Incoterm, cost, selling price and commercial margin.</p>
          </button>
          <button disabled={!editable} onClick={() => patch("quotation_type", "logistics")} className={`rounded-2xl border p-6 text-left transition ${isLogistics ? "border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-950/20" : "border-slate-800 bg-[#0d1423] hover:border-slate-600"}`}>
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-400">Format 02</p><h2 className="mt-2 text-xl font-bold">LOGISTICS QUOTATION</h2></div>{isLogistics && <span className="rounded-full bg-cyan-600 px-3 py-1 text-xs font-semibold">Selected</span>}</div>
            <p className="mt-3 text-sm leading-6 text-slate-400">For sea, air, road, rail and multimodal services. Includes route, mode, cargo details and selectable freight, customs, handling, storage and transport charges.</p>
          </button>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-800 bg-[#0d1423] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs uppercase tracking-wider text-slate-500">Workflow Status</p><div className="mt-2 flex flex-wrap items-center gap-3"><Badge v={f.status} /><span className="text-xs text-slate-500">{typeLabel} · Rev {f.revision || 1} · Role {permissions.role}</span></div></div><div className="flex flex-wrap gap-2"><button disabled={!editable || busy === "save" || !permissions.canWrite} onClick={() => void save()} className={primary}>{busy === "save" ? "Saving..." : f.id ? "Save Revision" : "Save Draft"}</button>{f.id && editable && <button disabled={!!busy} onClick={() => void action("submit", () => submitQuotationForReview(f.id, "Commercial review"), "Submitted for commercial review.")} className={btn}>Submit Review</button>}{f.id && f.status === "review" && permissions.canControl && <><button disabled={!!busy} onClick={() => void action("approve", () => decideQuotation(f.id, "approved", "Commercial approval"), "Quotation approved.")} className={btn}>Approve</button><button disabled={!!busy} onClick={() => { const r = window.prompt("Rejection reason"); if (r) void action("reject", () => decideQuotation(f.id, "rejected", r), "Quotation rejected for revision."); }} className={btn}>Reject</button></>}{f.id && f.status === "approved" && !approvedDeal && <button disabled={!!busy} onClick={() => void action("deal", () => convertQuotationToDeal(f.id), "Draft Deal created from approved quotation.")} className={btn}>Convert to Deal</button>}{approvedDeal && <Link href="/deals" className={btn}>Open Deal</Link>}</div></div>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-800 bg-[#0d1423] p-5">
          <div className="mb-4"><p className={`text-xs font-bold uppercase tracking-[.18em] ${isLogistics ? "text-cyan-400" : "text-blue-400"}`}>{typeLabel}</p><h2 className="mt-1 text-lg font-semibold">Quotation Header & Commercial Terms</h2></div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input disabled={!editable} value={f.quotation_no} onChange={e => patch("quotation_no", e.target.value.toUpperCase())} placeholder="Quotation No. * before review" className={`${field} font-mono`} />
            <select disabled={!editable} value={f.customer_id} onChange={e => { patch("customer_id", e.target.value); const c = data.customers.find((x: any) => x.id === e.target.value); if (c) patch("contact_person", c.contact_person || ""); }} className={field}><option value="">Customer</option>{data.customers.filter((x: any) => x.status === "active").map((x: any) => <option key={x.id} value={x.id}>{x.company_name}</option>)}</select>
            <input disabled={!editable} value={f.contact_person} onChange={e => patch("contact_person", e.target.value)} placeholder="Attention / Contact" className={field} />
            <input disabled={!editable} value={f.title} onChange={e => patch("title", e.target.value)} placeholder="Quotation title / subject" className={field} />
            {!isLogistics && <select disabled={!editable} value={f.supplier_id} onChange={e => patch("supplier_id", e.target.value)} className={field}><option value="">Approved Supplier optional</option>{validSuppliers.map((x: any) => <option key={x.id} value={x.id}>{x.company_name}</option>)}</select>}
            <select disabled={!editable} value={f.currency} onChange={e => patch("currency", e.target.value)} className={field}>{["AED", "USD", "EUR", "GBP", "CNY", "INR"].map(x => <option key={x}>{x}</option>)}</select>
            <input disabled={!editable} type="date" value={f.valid_until} onChange={e => patch("valid_until", e.target.value)} className={field} />
            <input disabled={!editable} value={f.payment_terms} onChange={e => patch("payment_terms", e.target.value)} placeholder="Payment terms" className={field} />
            <input disabled={!editable} value={f.origin} onChange={e => patch("origin", e.target.value)} placeholder={isLogistics ? "POL / Origin" : "Country / Place of Origin"} className={field} />
            <input disabled={!editable} value={f.destination} onChange={e => patch("destination", e.target.value)} placeholder={isLogistics ? "POD / Destination" : "Delivery Destination"} className={field} />
            <input disabled={!editable} value={f.incoterm} onChange={e => patch("incoterm", e.target.value)} placeholder="Incoterm" className={field} />
            <input disabled={!editable} value={f.commodity} onChange={e => patch("commodity", e.target.value)} placeholder={isLogistics ? "Commodity / Cargo Description" : "Product / Commodity"} className={field} />
            {isLogistics ? <select disabled={!editable} value={f.mode} onChange={e => patch("mode", e.target.value)} className={field}>{["Sea", "Air", "Road", "Rail", "Multimodal", "Courier"].map(x => <option key={x}>{x}</option>)}</select> : <input disabled={!editable} value={f.hs_code} onChange={e => patch("hs_code", e.target.value)} placeholder="HS Code" className={field} />}
            <input disabled={!editable} value={f.gross_weight} onChange={e => patch("gross_weight", e.target.value)} placeholder="Gross Weight" className={field} />
            <input disabled={!editable} value={f.volume_details} onChange={e => patch("volume_details", e.target.value)} placeholder={isLogistics ? "CBM / Containers / Packages" : "Quantity / Packing / Volume"} className={field} />
            <input disabled={!editable} value={f.packing_details} onChange={e => patch("packing_details", e.target.value)} placeholder="Packing details" className={field} />
          </div>
        </section>

        {isLogistics && <section className="mt-5 rounded-2xl border border-cyan-900/60 bg-cyan-950/10 p-5"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-400">Logistics Rate Library</p><h2 className="mt-1 font-semibold">Optional Logistics Charges</h2><p className="mt-1 text-xs text-slate-500">Click any charge to add it as a real quotation line. Added charges remain editable and are saved with the quotation.</p></div><div className="mt-4 flex flex-wrap gap-2">{logisticsCharges.map(charge => { const on = f.lines.some((r: QuoteLine) => r.description === charge); return <button key={charge} disabled={!editable || on} onClick={() => addLogisticsCharge(charge)} className={`rounded-lg border px-3 py-2 text-xs transition ${on ? "border-emerald-900 bg-emerald-950/30 text-emerald-400" : "border-slate-700 text-slate-300 hover:border-cyan-500 hover:text-cyan-300"}`}>{on ? "✓ " : "+ "}{charge}</button>; })}</div></section>}

        <section className="mt-5 rounded-2xl border border-slate-800 bg-[#0d1423] p-5">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-slate-500">{isLogistics ? "Service & Charge Lines" : "Commercial Product Lines"}</p><h2 className="mt-1 font-semibold">Quotation Lines</h2></div>{editable && <button onClick={() => patch("lines", [...f.lines, line()])} className={btn}>+ Custom Line</button>}</div>
          <div className="mt-4 space-y-3">{f.lines.map((r: QuoteLine, i: number) => <div key={i} className="grid gap-2 rounded-xl border border-slate-800 p-3 md:grid-cols-[2fr_.55fr_.7fr_.8fr_.8fr_auto]"><input disabled={!editable} value={r.description} onChange={e => patchLine(i, { description: e.target.value })} placeholder={isLogistics ? "Service / Charge Description" : "Product / Item Description"} className={field} /><input disabled={!editable} type="number" min="0" step="any" value={r.qty} onChange={e => patchLine(i, { qty: Number(e.target.value) })} className={field} /><input disabled={!editable} value={r.unit} onChange={e => patchLine(i, { unit: e.target.value })} className={field} /><input disabled={!editable} type="number" min="0" step="any" value={r.cost} onChange={e => patchLine(i, { cost: Number(e.target.value) })} placeholder="Internal Cost" className={field} /><input disabled={!editable} type="number" min="0" step="any" value={r.sell} onChange={e => patchLine(i, { sell: Number(e.target.value) })} placeholder="Selling Rate" className={field} />{editable && <button disabled={f.lines.length === 1} onClick={() => patch("lines", f.lines.filter((_: any, n: number) => n !== i))} className={btn}>Remove</button>}</div>)}</div>
          <div className="mt-5 grid gap-3 sm:grid-cols-4"><K l="Internal Cost" v={`${f.currency} ${money.format(totals.cost)}`} /><K l="Selling Total" v={`${f.currency} ${money.format(totals.sell)}`} /><K l="Gross Profit" v={`${f.currency} ${money.format(totals.profit)}`} /><K l="Margin" v={`${totals.margin.toFixed(2)}%`} /></div>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-800 bg-[#0d1423] p-5"><textarea disabled={!editable} value={f.notes} onChange={e => patch("notes", e.target.value)} placeholder={isLogistics ? "Validity, free time, exclusions, customs assumptions, transit time, carrier conditions and operational notes" : "Commercial notes, warranty, exclusions, delivery conditions, payment terms and assumptions"} className={`${field} min-h-28`} /></section>
      </>}
    </div>

    <section className="hidden print:block bg-white p-10 text-black">
      <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5"><img src="/vtc-group-logo.svg" alt="VTC Group" className="h-16" /><div className="text-right"><p className="text-xs font-semibold tracking-[.18em] text-slate-500">VTC GROUP</p><h1 className="mt-1 text-2xl font-bold">{typeLabel}</h1><p className="mt-1 font-mono text-sm">{f.quotation_no || "DRAFT"} · Rev {f.revision || 1}</p></div></div>
      <div className="mt-6 grid grid-cols-2 gap-x-10 gap-y-2 text-sm"><DocRow l="Customer" v={data.customers.find((x: any) => x.id === f.customer_id)?.company_name || "—"} /><DocRow l="Attention" v={f.contact_person || "—"} /><DocRow l="Subject" v={f.title || "—"} /><DocRow l="Valid Until" v={f.valid_until || "—"} /><DocRow l="Origin" v={f.origin || "—"} /><DocRow l="Destination" v={f.destination || "—"} />{isLogistics ? <DocRow l="Mode" v={f.mode || "—"} /> : <DocRow l="HS Code" v={f.hs_code || "—"} />}<DocRow l="Incoterm" v={f.incoterm || "—"} /><DocRow l="Commodity" v={f.commodity || "—"} /><DocRow l="Payment Terms" v={f.payment_terms || "—"} /></div>
      <table className="mt-7 w-full text-sm"><thead><tr className="border-y-2 border-slate-900"><th className="py-3 text-left">Description</th><th className="text-center">Qty</th><th className="text-center">Unit</th><th className="text-right">Rate</th><th className="text-right">Total</th></tr></thead><tbody>{f.lines.filter((r: QuoteLine) => r.description.trim()).map((r: QuoteLine, i: number) => <tr key={i} className="border-b border-slate-300"><td className="py-3">{r.description}</td><td className="text-center">{r.qty}</td><td className="text-center">{r.unit}</td><td className="text-right">{f.currency} {money.format(r.sell)}</td><td className="text-right">{f.currency} {money.format(r.qty * r.sell)}</td></tr>)}</tbody></table>
      <div className="mt-5 flex justify-end"><div className="w-80 rounded-lg border border-slate-300 p-4"><div className="flex justify-between text-sm"><span>Grand Total</span><b>{f.currency} {money.format(totals.sell)}</b></div></div></div>
      {f.notes && <div className="mt-8"><h3 className="font-semibold">Terms, Notes & Exclusions</h3><div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{f.notes}</div></div>}
      <div className="mt-16 flex justify-end"><div className="w-72 border-t border-slate-900 pt-3 text-center text-sm"><b>Commercial Manager</b><br />VTC Group</div></div>
    </section>
  </main>;
}

function Badge({ v }: { v: string }) { return <span className={`rounded-full border px-2.5 py-1 text-xs capitalize ${v === "approved" || v === "accepted" || v === "awarded" ? "border-emerald-800 bg-emerald-950/30 text-emerald-300" : v === "rejected" || v === "expired" ? "border-red-800 bg-red-950/30 text-red-300" : v === "review" ? "border-amber-800 bg-amber-950/30 text-amber-300" : "border-slate-700 bg-slate-900 text-slate-300"}`}>{v}</span>; }
function K({ l, v }: { l: string; v: string }) { return <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><p className="text-xs text-slate-500">{l}</p><b className="mt-1 block">{v}</b></div>; }
function DocRow({ l, v }: { l: string; v: string }) { return <div className="flex border-b border-slate-200 py-2"><span className="w-32 text-slate-500">{l}</span><b className="flex-1">{v}</b></div>; }
