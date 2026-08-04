"use client";

import { useMemo, useState } from "react";

type RegisterKind = "receivable" | "payable";
type RecordRow = { id: string; party: string; reference: string; amount: number; currency: string; dueDate: string; status: string; owner: string };

const initialReceivables: RecordRow[] = [
  { id:"AR-26041", party:"MODAVA", reference:"PI KPL/EXP/016", amount:1180000, currency:"AED", dueDate:"2026-08-04", status:"Due", owner:"Massih" },
  { id:"AR-26040", party:"Chimi Daru", reference:"Chemical Supply", amount:540000, currency:"AED", dueDate:"2026-07-28", status:"Overdue", owner:"Finance" },
  { id:"AR-26039", party:"Power & Sun", reference:"Logistics Services", amount:860000, currency:"AED", dueDate:"2026-08-07", status:"Expected", owner:"Commercial" },
];
const initialPayables: RecordRow[] = [
  { id:"AP-26055", party:"Kekule", reference:"Supplier Payment", amount:760000, currency:"AED", dueDate:"2026-08-03", status:"Approval", owner:"Treasury" },
  { id:"AP-26054", party:"Shipping Line", reference:"Freight & Local Charges", amount:410000, currency:"AED", dueDate:"2026-08-05", status:"Scheduled", owner:"Logistics" },
  { id:"AP-26053", party:"JEA Port", reference:"Port & Customs", amount:245000, currency:"AED", dueDate:"2026-08-03", status:"Release", owner:"Operations" },
];

function money(value:number){ return new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(value); }

export function FinanceRegister({ kind }: { kind: RegisterKind }) {
  const key = kind === "receivable" ? "vtc-finance-receivables" : "vtc-finance-payables";
  const defaults = kind === "receivable" ? initialReceivables : initialPayables;
  const [rows,setRows] = useState<RecordRow[]>(() => {
    if (typeof window === "undefined") return defaults;
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) as RecordRow[] : defaults;
  });
  const [query,setQuery] = useState("");
  const [formOpen,setFormOpen] = useState(false);
  const [form,setForm] = useState({party:"",reference:"",amount:"",currency:"AED",dueDate:"",owner:"Finance"});
  const title = kind === "receivable" ? "Accounts Receivable" : "Accounts Payable";
  const total = useMemo(()=>rows.reduce((s,r)=>s+r.amount,0),[rows]);
  const filtered = rows.filter(r => `${r.party} ${r.reference} ${r.status}`.toLowerCase().includes(query.toLowerCase()));

  function save(next:RecordRow[]){ setRows(next); window.localStorage.setItem(key,JSON.stringify(next)); }
  function add(){
    if(!form.party || !form.amount || !form.dueDate) return;
    const row:RecordRow={id:`${kind==="receivable"?"AR":"AP"}-${Date.now().toString().slice(-5)}`,party:form.party,reference:form.reference||"Manual Entry",amount:Number(form.amount),currency:form.currency,dueDate:form.dueDate,status:kind==="receivable"?"Expected":"Draft",owner:form.owner};
    save([row,...rows]); setFormOpen(false); setForm({party:"",reference:"",amount:"",currency:"AED",dueDate:"",owner:"Finance"});
  }
  function cycle(id:string){
    const states = kind === "receivable" ? ["Expected","Due","Overdue","Collected"] : ["Draft","Approval","Scheduled","Paid"];
    save(rows.map(r=>r.id===id?{...r,status:states[(states.indexOf(r.status)+1)%states.length]}:r));
  }

  return <main className="min-h-screen bg-[#060a12] p-5 text-white md:p-8"><div className="mx-auto max-w-[1500px]">
    <header className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-xs uppercase tracking-[.24em] text-blue-400">Finance Operations</p><h1 className="mt-2 text-3xl font-bold">{title}</h1><p className="mt-2 text-sm text-slate-400">Live register with due dates, ownership, status progression and local persistence.</p></div><button onClick={()=>setFormOpen(v=>!v)} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500">+ Add Record</button></header>
    <section className="grid gap-4 md:grid-cols-4">{[["Total Balance",`AED ${money(total)}`],["Open Records",String(rows.filter(r=>!["Collected","Paid"].includes(r.status)).length)],["Critical",String(rows.filter(r=>["Overdue","Approval","Release"].includes(r.status)).length)],["Settled",String(rows.filter(r=>["Collected","Paid"].includes(r.status)).length)]].map(([l,v])=><div key={l} className="rounded-2xl border border-slate-800 bg-[#0d1423] p-5"><p className="text-sm text-slate-400">{l}</p><p className="mt-3 text-2xl font-bold">{v}</p></div>)}</section>
    {formOpen && <section className="mt-5 grid gap-3 rounded-2xl border border-blue-500/30 bg-blue-500/5 p-5 md:grid-cols-6"><input placeholder="Party" value={form.party} onChange={e=>setForm({...form,party:e.target.value})} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 outline-none"/><input placeholder="Reference" value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 outline-none"/><input type="number" placeholder="Amount" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 outline-none"/><select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3"><option>AED</option><option>USD</option><option>EUR</option><option>IRR</option></select><input type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 outline-none"/><button onClick={add} className="rounded-xl bg-emerald-600 px-4 py-3 font-semibold">Save</button></section>}
    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1423]"><div className="border-b border-slate-800 p-5"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search register..." className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none md:max-w-md"/></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-950/70 text-xs uppercase text-slate-500"><tr>{["ID","Party","Reference","Amount","Due Date","Owner","Status"].map(h=><th key={h} className="px-5 py-4">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{filtered.map(r=><tr key={r.id} className="hover:bg-slate-900/60"><td className="px-5 py-4 font-mono text-xs text-blue-300">{r.id}</td><td className="px-5 py-4 font-semibold">{r.party}</td><td className="px-5 py-4 text-slate-400">{r.reference}</td><td className="px-5 py-4">{r.currency} {money(r.amount)}</td><td className="px-5 py-4">{r.dueDate}</td><td className="px-5 py-4 text-slate-400">{r.owner}</td><td className="px-5 py-4"><button onClick={()=>cycle(r.id)} className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold hover:border-blue-500">{r.status}</button></td></tr>)}</tbody></table></div></section>
  </div></main>;
}
