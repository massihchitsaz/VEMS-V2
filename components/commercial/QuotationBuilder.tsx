"use client";

import { useEffect, useMemo, useState } from "react";
import {
  deleteQuotation,
  listQuotationWorkspace,
  saveQuotation,
  updateQuotationStatus,
  type QuoteLine,
} from "@/lib/quotations";

type Kind = "trading" | "logistics";
type View = "builder" | "saved";

const money = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const input = "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500";
const blank = (description = ""): QuoteLine => ({ description, qty: 1, unit: "Unit", cost: 0, sell: 0 });

const chargeGroups = [
  { name: "Freight & Shipping", items: ["OCEAN FREIGHT","2ND FREIGHT","DELIVERY ORDER","D/P WORLD & THC CHARGES IMPORT","DP WORLD CHARGES EXP","TERMINAL HANDLING FEES EXPORT","BL","BILL OF LADING FEE 1ST","BILL OF LADING FEE IF ANY MORE","SWITCH BL","BILL SURRENDER"] },
  { name: "Customs", items: ["HS CODE","DOCUMENTS & TYPING","TRANSFER OWNERSHIP","BILL OF ENTRY IMPORT & EXPORT","FANAR CHARGES","CID CHARGES","MOFFA / MOFAIC","RCHARGES & DG STICKER","MISD COPY DOCUMENTS","CUSTOM INSPECTION","INSPECTION CHARGES","CUSTOMS DEPOSIT FEE","INSURANCE","EXIT SUBMISSION"] },
  { name: "Transportation Services", items: ["TRANSPORT CHARGES IMP","TRANSPORT CHARGES EXP","VGM","SEAL SERVICE","GATE PASS","PLUG IN CHARGES PER CNTR/DAY","REFER MONITORING CHARGES","TOKEN"] },
  { name: "Logistics Services", items: ["CROSS STUFFING CHARGE IMP","CROSS STUFFING CHARGE EXP","LIFT TRUCK & CRANE","STORAGE","PACKING PALLET","RE-PACKING","TRANSIT","SEGREGATION & INSPECTION","SERVICE CHARGES"] },
];

const empty = () => ({
  id: "",
  quotation_no: "",
  quotation_type: "trading" as Kind,
  customer_id: "",
  supplier_id: "",
  opportunity_id: "",
  title: "",
  contact_person: "",
  currency: "AED",
  valid_until: "",
  incoterm: "EXW",
  payment_terms: "As agreed",
  origin: "",
  destination: "",
  mode: "Sea",
  commodity: "",
  hs_code: "",
  packing_details: "",
  gross_weight: "",
  volume_details: "",
  notes: "",
  status: "draft",
  lines: [blank()],
});

export function QuotationBuilder() {
  const [view, setView] = useState<View>("builder");
  const [data, setData] = useState<any>(null);
  const [f, setF] = useState<any>(empty());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"ok" | "error" | "info">("info");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);

  const notify = (message: string, tone: "ok" | "error" | "info" = "info") => {
    setMsg(message);
    setMsgTone(tone);
  };

  const load = async () => {
    try {
      setData(await listQuotationWorkspace());
    } catch (e: any) {
      notify(e?.message || "Unable to load quotation workspace", "error");
    }
  };

  useEffect(() => { void load(); }, []);

  const totals = useMemo(() => {
    const cost = f.lines.reduce((n: number, x: QuoteLine) => n + Number(x.qty || 0) * Number(x.cost || 0), 0);
    const sell = f.lines.reduce((n: number, x: QuoteLine) => n + Number(x.qty || 0) * Number(x.sell || 0), 0);
    return { cost, sell, profit: sell - cost, margin: sell ? ((sell - cost) / sell) * 100 : 0 };
  }, [f.lines]);

  const stats = useMemo(() => {
    const rows = data?.quotations ?? [];
    return {
      total: rows.length,
      draft: rows.filter((x: any) => x.status === "draft").length,
      active: rows.filter((x: any) => ["sent", "review"].includes(x.status)).length,
      awarded: rows.filter((x: any) => x.status === "awarded").length,
      value: rows.reduce((n: number, x: any) => n + Number(x.total_amount || 0), 0),
    };
  }, [data]);

  const patch = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const patchLine = (i: number, p: Partial<QuoteLine>) => setF((x: any) => ({ ...x, lines: x.lines.map((l: QuoteLine, j: number) => j === i ? { ...l, ...p } : l) }));
  const addCharge = (description: string) => {
    if (!f.lines.some((x: QuoteLine) => x.description === description)) patch("lines", [...f.lines, blank(description)]);
  };

  const customer = data?.customers?.find((x: any) => x.id === f.customer_id);
  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    const rows = data?.customers ?? [];
    if (!q) return rows.slice(0, 20);
    return rows
      .filter((x: any) =>
        [x.company_name, x.customer_code, x.contact_person]
          .filter(Boolean)
          .some((v: any) => String(v).toLowerCase().includes(q))
      )
      .slice(0, 20);
  }, [data?.customers, customerQuery]);

  const selectCustomer = (c: any) => {
    patch("customer_id", c.id);
    patch("contact_person", c.contact_person || "");
    setCustomerQuery(c.company_name || "");
    setCustomerOpen(false);
  };

  const save = async () => {
    if (busy) return;

    const isDraft = f.status === "draft";
    if (!isDraft) {
      if (!String(f.quotation_no || "").trim()) return notify("Quotation number is required before changing the quotation out of Draft.", "error");
      if (!String(f.title || "").trim()) return notify("Quotation subject/title is required before issuing the quotation.", "error");
      if (!f.customer_id) return notify("Please select a customer before issuing the quotation.", "error");
      if (!f.lines.some((x: QuoteLine) => String(x.description || "").trim())) return notify("Add at least one quotation line before issuing the quotation.", "error");
    }

    setBusy(true);
    notify("Saving quotation...", "info");
    try {
      const q = await saveQuotation({
        ...f,
        quotation_no: String(f.quotation_no || "").trim() || null,
        customer_id: f.customer_id || null,
        supplier_id: f.supplier_id || null,
        opportunity_id: f.opportunity_id || null,
        title: String(f.title || "").trim() || "Untitled quotation",
        lines: (f.lines?.length ? f.lines : [blank()]),
      });
      setF((x: any) => ({ ...x, id: q.id, quotation_no: q.quotation_no || "", title: q.title || x.title || "Untitled quotation" }));
      await load();
      notify(q.quotation_no ? `Quotation ${q.quotation_no} saved successfully.` : "Draft quotation saved successfully.", "ok");
    } catch (e: any) {
      notify(e?.message || "Unable to save quotation", "error");
    } finally {
      setBusy(false);
    }
  };

  const open = (q: any) => {
    setF({
      ...empty(),
      id: q.id,
      quotation_no: q.quotation_no || "",
      quotation_type: q.quotation_type || "trading",
      customer_id: q.customer_id || "",
      supplier_id: q.supplier_id || "",
      opportunity_id: q.opportunity_id || "",
      title: q.title || "",
      contact_person: q.contact_person || "",
      currency: q.currency || "AED",
      valid_until: q.valid_until || "",
      incoterm: q.incoterm || "EXW",
      payment_terms: q.payment_terms || "As agreed",
      origin: q.origin || "",
      destination: q.destination || "",
      mode: q.mode || "Sea",
      commodity: q.commodity || "",
      hs_code: q.hs_code || "",
      packing_details: q.packing_details || "",
      gross_weight: q.gross_weight || "",
      volume_details: q.volume_details || "",
      notes: q.notes || "",
      status: q.status || "draft",
      lines: (q.quotation_items?.length ? q.quotation_items : []).sort((a: any, b: any) => a.line_no - b.line_no).map((x: any) => ({ description: x.description, qty: Number(x.quantity), unit: x.unit || "Unit", cost: Number(x.unit_cost), sell: Number(x.unit_sell) })) || [blank()],
    });
    setCustomerQuery(data?.customers?.find((x:any)=>x.id===q.customer_id)?.company_name || "");
    setCustomerOpen(false);
    setView("builder");
    notify(`Editing ${q.quotation_no || "unnumbered draft"} · Revision ${q.revision || 1}`, "info");
  };

  const changeStatus = async (id: string, status: string) => {
    try { await updateQuotationStatus(id, status); await load(); notify("Quotation status updated.", "ok"); }
    catch (e: any) { notify(e?.message || "Unable to update quotation status", "error"); }
  };

  const remove = async (q: any) => {
    if (!confirm(`Delete ${q.quotation_no || "this unnumbered draft"}? This cannot be undone.`)) return;
    try { await deleteQuotation(q.id); await load(); notify("Quotation deleted.", "ok"); }
    catch (e: any) { notify(e?.message || "Unable to delete quotation.", "error"); }
  };

  const saved = (data?.quotations ?? []).filter((q: any) =>
    (statusFilter === "all" || q.status === statusFilter) &&
    `${q.quotation_no || ""} ${q.title || ""} ${q.customers?.company_name || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="p-5 text-white md:p-8 print:bg-white print:p-0 print:text-black">
      <div className="print:hidden">
        <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.24em] text-blue-400">VTC Commercial</p>
            <h2 className="mt-2 text-3xl font-bold">Quotation Workspace</h2>
            <p className="mt-2 text-sm text-slate-400">Build, save, revise, control and export trading and logistics quotations.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setF(empty()); setCustomerQuery(""); setCustomerOpen(false); setView("builder"); setMsg(""); }} className="rounded-xl border border-slate-700 px-4 py-3 text-sm">+ New Quotation</button>
            <button onClick={() => window.print()} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold">Export / Print PDF</button>
          </div>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[["Total",stats.total],["Draft",stats.draft],["Active",stats.active],["Awarded",stats.awarded],["Portfolio Value",money.format(stats.value)]].map(([l,v]) => (
            <div key={String(l)} className="rounded-2xl border border-slate-800 bg-[#0d1423] p-4"><p className="text-xs uppercase tracking-wider text-slate-500">{l}</p><p className="mt-2 text-2xl font-bold">{v}</p></div>
          ))}
        </section>

        <div className="mt-6 flex gap-2">
          <button onClick={() => setView("builder")} className={`rounded-xl px-4 py-2 text-sm ${view === "builder" ? "bg-blue-600" : "bg-slate-900"}`}>Builder</button>
          <button onClick={() => setView("saved")} className={`rounded-xl px-4 py-2 text-sm ${view === "saved" ? "bg-blue-600" : "bg-slate-900"}`}>Saved Quotations ({data?.quotations?.length ?? 0})</button>
        </div>

        {view === "saved" ? (
          <section className="mt-5 rounded-2xl border border-slate-800 bg-[#0d1423]">
            <div className="grid gap-3 border-b border-slate-800 p-4 md:grid-cols-[1fr_180px]">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quotation, subject or customer..." className={input}/>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={input}><option value="all">All statuses</option>{["draft","sent","review","accepted","rejected","expired","awarded"].map(x => <option key={x}>{x}</option>)}</select>
            </div>
            <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm"><thead className="text-left text-xs uppercase text-slate-500"><tr><th className="p-4">Quotation</th><th>Customer</th><th>Type</th><th>Value</th><th>Margin</th><th>Status</th><th>Revision</th><th className="p-4 text-right">Actions</th></tr></thead><tbody>
              {saved.map((q: any) => <tr key={q.id} className="border-t border-slate-800"><td className="p-4"><b>{q.quotation_no || "UNNUMBERED DRAFT"}</b><p className="mt-1 text-xs text-slate-500">{q.title}</p></td><td>{q.customers?.company_name || "-"}</td><td className="capitalize">{q.quotation_type || "trading"}</td><td>{q.currency} {money.format(Number(q.total_amount || 0))}</td><td className="text-emerald-400">{Number(q.margin_percent || 0).toFixed(2)}%</td><td><select value={q.status} onChange={e => void changeStatus(q.id,e.target.value)} className={input}>{["draft","sent","review","accepted","rejected","expired","awarded"].map(x => <option key={x}>{x}</option>)}</select></td><td>Rev {q.revision || 1}</td><td className="p-4 text-right"><button onClick={() => open(q)} className="mr-2 rounded-lg border border-slate-700 px-3 py-2">Edit</button><button onClick={() => void remove(q)} className="rounded-lg border border-red-900 px-3 py-2 text-red-300">Delete</button></td></tr>)}
              {saved.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-slate-500">No quotations found.</td></tr>}
            </tbody></table></div>
          </section>
        ) : (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(["trading","logistics"] as Kind[]).map(k => <button key={k} onClick={() => patch("quotation_type",k)} className={`rounded-2xl border p-5 text-left ${f.quotation_type === k ? "border-blue-500 bg-blue-500/10" : "border-slate-800 bg-[#0d1423]"}`}><b>{k === "trading" ? "Trading Quotation" : "Logistics Quotation"}</b><p className="mt-1 text-xs text-slate-400">{k === "trading" ? "Purchase & sale of goods" : "Freight, customs, transport and logistics services"}</p></button>)}
            </div>

            <section className="mt-5 rounded-2xl border border-slate-800 bg-[#0d1423] p-5">
              <div className="flex flex-col gap-3 border-b border-slate-800 pb-5 md:flex-row md:items-end md:justify-between">
                <div><h3 className="font-semibold">Quotation Control</h3><p className="mt-1 text-xs text-slate-500">Quotation number is manual. Drafts can be saved incomplete and without a number.</p></div>
                <label className="w-full md:max-w-sm"><span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-blue-400">Quotation No. · Manual</span><input value={f.quotation_no} onChange={e => patch("quotation_no",e.target.value.toUpperCase())} placeholder="Enter your own quotation reference" className={`${input} font-mono`}/></label>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="relative">
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Customer</label>
                  <input
                    value={customerOpen ? customerQuery : (customer?.company_name || customerQuery)}
                    onFocus={() => { setCustomerQuery(customer?.company_name || customerQuery); setCustomerOpen(true); }}
                    onChange={e => { setCustomerQuery(e.target.value); if (f.customer_id) patch("customer_id", ""); setCustomerOpen(true); }}
                    onKeyDown={e => {
                      if (e.key === "Escape") setCustomerOpen(false);
                      if (e.key === "Enter" && filteredCustomers.length === 1) {
                        e.preventDefault();
                        selectCustomer(filteredCustomers[0]);
                      }
                    }}
                    placeholder="Search and select customer..."
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={customerOpen}
                    aria-controls="quotation-customer-options"
                    className={input}
                  />
                  {customerOpen && (
                    <div id="quotation-customer-options" role="listbox" className="absolute z-40 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-700 bg-[#0a1020] p-1 shadow-2xl shadow-black/50">
                      {filteredCustomers.map((c:any) => (
                        <button
                          key={c.id}
                          type="button"
                          role="option"
                          aria-selected={f.customer_id === c.id}
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => selectCustomer(c)}
                          className={`w-full rounded-lg px-3 py-2.5 text-left transition hover:bg-blue-600/20 ${f.customer_id === c.id ? "bg-blue-600/15" : ""}`}
                        >
                          <span className="block text-sm font-semibold text-white">{c.company_name}</span>
                          <span className="mt-0.5 block text-[11px] text-slate-500">
                            {[c.customer_code, c.contact_person].filter(Boolean).join(" · ") || "Customer record"}
                          </span>
                        </button>
                      ))}
                      {filteredCustomers.length === 0 && <div className="px-3 py-4 text-center text-sm text-slate-500">No customer found. Add the customer in Customers first.</div>}
                    </div>
                  )}
                  {f.customer_id && <p className="mt-1.5 text-[11px] text-emerald-400">✓ Linked to customer master record</p>}
                </div>
                <input value={f.contact_person} onChange={e=>patch("contact_person",e.target.value)} placeholder="Attention / Contact person" className={input}/>
                <select value={f.supplier_id} onChange={e=>patch("supplier_id",e.target.value)} className={input}><option value="">Supplier / Agent (optional)</option>{data?.suppliers?.map((x:any)=><option key={x.id} value={x.id}>{x.company_name}</option>)}</select>
                <select value={f.opportunity_id} onChange={e=>patch("opportunity_id",e.target.value)} className={input}><option value="">Linked Opportunity (optional)</option>{data?.opportunities?.map((x:any)=><option key={x.id} value={x.id}>{x.opportunity_no} · {x.title}</option>)}</select>
                <input value={f.title} onChange={e=>patch("title",e.target.value)} placeholder="Quotation subject / title (optional in Draft)" className={input}/>
                <select value={f.currency} onChange={e=>patch("currency",e.target.value)} className={input}>{["AED","USD","EUR","GBP","CNY","INR"].map(x=><option key={x}>{x}</option>)}</select>
                <input type="date" value={f.valid_until} onChange={e=>patch("valid_until",e.target.value)} className={input}/>
                <select value={f.status} onChange={e=>patch("status",e.target.value)} className={input}>{["draft","sent","review","accepted","rejected","expired","awarded"].map(x=><option key={x}>{x}</option>)}</select>
                <input value={f.incoterm} onChange={e=>patch("incoterm",e.target.value)} placeholder="Incoterm" className={input}/>
                <input value={f.payment_terms} onChange={e=>patch("payment_terms",e.target.value)} placeholder="Payment terms" className={input}/>
                <input value={f.origin} onChange={e=>patch("origin",e.target.value)} placeholder="Origin" className={input}/>
                <input value={f.destination} onChange={e=>patch("destination",e.target.value)} placeholder="Destination" className={input}/>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                {f.quotation_type === "logistics" && <select value={f.mode} onChange={e=>patch("mode",e.target.value)} className={input}>{["Sea","Air","Road","Rail","Multimodal"].map(x=><option key={x}>{x}</option>)}</select>}
                <input value={f.commodity} onChange={e=>patch("commodity",e.target.value)} placeholder="Product / Commodity" className={input}/>
                <input value={f.hs_code} onChange={e=>patch("hs_code",e.target.value)} placeholder="HS Code" className={input}/>
                <input value={f.gross_weight} onChange={e=>patch("gross_weight",e.target.value)} placeholder="Gross Weight" className={input}/>
                <input value={f.volume_details} onChange={e=>patch("volume_details",e.target.value)} placeholder="CBM / Container / Package details" className={input}/>
                <input value={f.packing_details} onChange={e=>patch("packing_details",e.target.value)} placeholder="Packing / Brand / Origin details" className={input}/>
              </div>
            </section>

            {f.quotation_type === "logistics" && <section className="mt-5 rounded-2xl border border-slate-800 bg-[#0d1423] p-5"><h3 className="font-semibold">Optional Logistics Charge Library</h3><p className="mt-1 text-xs text-slate-400">Select only applicable charges. Every selected line remains editable.</p><div className="mt-4 grid gap-4 xl:grid-cols-2">{chargeGroups.map(g=><div key={g.name} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-blue-400">{g.name}</p><div className="flex flex-wrap gap-2">{g.items.map(i=>{const on=f.lines.some((x:QuoteLine)=>x.description===i);return <button key={i} onClick={()=>addCharge(i)} disabled={on} className={`rounded-lg border px-3 py-2 text-xs ${on?"border-emerald-900 bg-emerald-950/40 text-emerald-400":"border-slate-700 text-slate-300 hover:border-blue-500"}`}>{on?"✓ ":"+ "}{i}</button>})}</div></div>)}</div></section>}

            <section className="mt-5 rounded-2xl border border-slate-800 bg-[#0d1423] p-5">
              <div className="flex justify-between"><h3 className="font-semibold">{f.quotation_type === "trading" ? "Products" : "Selected Charges & Services"}</h3><button onClick={()=>patch("lines",[...f.lines,blank()])} className="text-sm text-blue-400">+ Custom Line</button></div>
              <div className="mt-4 space-y-3">{f.lines.map((x:QuoteLine,i:number)=><div key={i} className="grid gap-2 lg:grid-cols-[2fr_.6fr_.7fr_1fr_1fr_auto]"><input value={x.description} onChange={e=>patchLine(i,{description:e.target.value})} placeholder="Description" className={input}/><input type="number" min="0" value={x.qty} onChange={e=>patchLine(i,{qty:Number(e.target.value)})} className={input}/><input value={x.unit} onChange={e=>patchLine(i,{unit:e.target.value})} className={input}/><input type="number" min="0" value={x.cost} onChange={e=>patchLine(i,{cost:Number(e.target.value)})} className={input}/><input type="number" min="0" value={x.sell} onChange={e=>patchLine(i,{sell:Number(e.target.value)})} className={input}/><button onClick={()=>patch("lines",f.lines.filter((_:QuoteLine,j:number)=>j!==i))} className="px-3 text-red-400">×</button></div>)}</div>
              <div className="mt-5 grid gap-3 sm:grid-cols-4">{[["Internal Cost",totals.cost],["Selling Total",totals.sell],["Gross Profit",totals.profit]].map(([l,v])=><div key={String(l)} className="rounded-xl bg-slate-950 p-4"><p className="text-xs text-slate-500">{l}</p><b>{f.currency} {money.format(Number(v))}</b></div>)}<div className="rounded-xl bg-slate-950 p-4"><p className="text-xs text-slate-500">Margin</p><b className="text-emerald-400">{totals.margin.toFixed(2)}%</b></div></div>
              <textarea value={f.notes} onChange={e=>patch("notes",e.target.value)} placeholder="Terms, exclusions and commercial notes" className={`${input} mt-4 min-h-28`}/>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-slate-500">Draft can be saved at any stage. Customer, title and quotation number become mandatory only when issuing it.</p><button type="button" disabled={busy} onClick={()=>void save()} className="rounded-xl bg-blue-600 px-7 py-3 font-semibold shadow-lg shadow-blue-950/30 hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">{busy?"Saving...":f.id?"Save New Revision":"Save Quotation"}</button></div>
            </section>
          </>
        )}

        {msg && <div className={`fixed bottom-5 right-5 z-[100] max-w-md rounded-2xl border px-5 py-4 text-sm shadow-2xl ${msgTone === "ok" ? "border-emerald-700 bg-emerald-950 text-emerald-200" : msgTone === "error" ? "border-red-700 bg-red-950 text-red-200" : "border-blue-700 bg-slate-950 text-blue-200"}`}><div className="flex items-start gap-4"><span className="flex-1">{msg}</span><button onClick={()=>setMsg("")} className="text-lg leading-none">×</button></div></div>}
      </div>

      <section className="hidden print:block">
        <div className="flex items-start justify-between border-b pb-5"><div><img src="/vtc-group-logo.svg" alt="VTC Group" className="h-16 w-auto"/><p className="mt-2 text-sm font-semibold">VTC GROUP</p></div><div className="text-right"><h1 className="text-2xl font-bold">QUOTATION</h1><p>{f.quotation_no || "DRAFT"}</p><p className="mt-1 capitalize">{f.quotation_type === "trading" ? "Trading / Goods" : "Shipping & Logistics"}</p></div></div>
        <div className="mt-6 grid grid-cols-2 gap-6 text-sm"><div><b>Customer:</b> {customer?.company_name || ""}<br/><b>Attention:</b> {f.contact_person}<br/><b>Payment:</b> {f.payment_terms}<br/><b>Currency:</b> {f.currency}</div><div><b>Origin:</b> {f.origin}<br/><b>Destination:</b> {f.destination}<br/><b>Incoterm:</b> {f.incoterm}<br/>{f.quotation_type === "logistics" && <><b>Mode:</b> {f.mode}</>}</div></div>
        <h2 className="mt-6 text-lg font-semibold">{f.title || "Quotation"}</h2>
        <table className="mt-5 w-full border-collapse text-sm"><thead><tr className="border-y"><th className="py-3 text-left">Description</th><th>Qty</th><th>Unit</th><th className="text-right">Unit Price</th><th className="text-right">Total</th></tr></thead><tbody>{f.lines.filter((x:QuoteLine)=>x.description||x.sell).map((x:QuoteLine,i:number)=><tr key={i} className="border-b"><td className="py-3">{x.description}</td><td className="text-center">{x.qty}</td><td className="text-center">{x.unit}</td><td className="text-right">{money.format(x.sell)}</td><td className="text-right">{money.format(x.qty*x.sell)}</td></tr>)}</tbody></table>
        <div className="mt-5 text-right text-lg font-bold">Grand Total: {f.currency} {money.format(totals.sell)}</div>
        <div className="mt-7 whitespace-pre-wrap text-sm"><b>Terms & Notes</b><br/>{f.notes}</div>
        <div className="mt-16 flex justify-end"><div className="w-72 border-t pt-3 text-center"><b>Commercial Manager</b><br/>VTC Group<br/><span className="text-xs">Authorized Signature</span></div></div>
      </section>
    </main>
  );
}
