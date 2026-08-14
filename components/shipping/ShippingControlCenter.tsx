"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getShippingDashboard, type ShippingDashboardData, type ShipmentOverview } from "@/lib/shipping";

const empty: ShippingDashboardData = {
  shipments: [], activeCount: 0, inTransitCount: 0, customsCount: 0, exceptionCount: 0,
  arrivingSevenDays: 0, staleTrackingCount: 0, overdueMilestones: 0, openCriticalEvents: 0,
};

function daysTo(date?: string | null) {
  if (!date) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(`${date}T00:00:00`);
  return Math.ceil((target.getTime()-today.getTime())/86400000);
}

function tone(value: string) {
  if (["critical","escalated","blocked","cancelled"].includes(value)) return "text-red-300 border-red-900/70 bg-red-950/30";
  if (["high","watch","customs","delayed"].includes(value)) return "text-amber-300 border-amber-900/70 bg-amber-950/30";
  if (["delivered","cleared","released"].includes(value)) return "text-emerald-300 border-emerald-900/70 bg-emerald-950/30";
  return "text-blue-300 border-blue-900/60 bg-blue-950/20";
}

export function ShippingControlCenter() {
  const [data,setData]=useState<ShippingDashboardData>(empty);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState("all");

  const load=useCallback(async()=>{setLoading(true);setError(null);try{setData(await getShippingDashboard())}catch(e){setError(e instanceof Error?e.message:"Unable to load shipping data") }finally{setLoading(false)}},[]);
  useEffect(()=>{void load()},[load]);

  const attention=useMemo(()=>data.shipments.filter(s=>{
    const hay=[s.shipment_no,s.origin,s.destination,s.carrier,s.container_no,s.bl_no,s.awb_no,s.cargo_description,s.customer?.company_name].filter(Boolean).join(" ").toLowerCase();
    const q=!query||hay.includes(query.toLowerCase());
    const f=filter==="all" || (filter==="exceptions"&&(["watch","blocked","escalated"].includes(s.exception_status??"")||["high","critical"].includes(s.risk_level??""))) || (filter==="customs"&&(s.status==="customs"||(s.customs_status&&s.customs_status!=="not_started"))) || (filter==="transit"&&["picked_up","in_transit"].includes(s.status));
    return q&&f;
  }).slice(0,12),[data.shipments,query,filter]);

  const metrics=[
    ["Active Shipments",data.activeCount,"Open execution records"],
    ["In Transit",data.inTransitCount,"Picked up / moving"],
    ["Customs Attention",data.customsCount,"Clearance workflow"],
    ["Exceptions",data.exceptionCount,"Watch / blocked / escalated"],
    ["Arriving ≤ 7 Days",data.arrivingSevenDays,"Destination readiness"],
    ["Tracking Stale >48h",data.staleTrackingCount,"Carrier update required"],
    ["Overdue Milestones",data.overdueMilestones,"Planned event missed"],
    ["Critical Events",data.openCriticalEvents,"Immediate escalation"],
  ];

  return <main className="p-5 text-white md:p-8">
    <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[.24em] text-blue-400">VTC Logistics Control</p><h1 className="mt-2 text-3xl font-bold">Shipping Operations Control Center</h1><p className="mt-2 max-w-3xl text-sm text-slate-400">Operational visibility across booking, pickup, customs, transit, arrival, delivery, milestones, units, exceptions and shipment cost control.</p></div>
      <div className="flex flex-wrap gap-2"><button onClick={()=>void load()} disabled={loading} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm disabled:opacity-50">{loading?"Refreshing...":"Refresh"}</button><Link href="/shipping/shipments" className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold hover:bg-blue-500">Open Shipments</Link></div>
    </header>

    {error&&<div className="mt-5 rounded-xl border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</div>}

    <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label,value,detail])=><article key={String(label)} className="rounded-2xl border border-slate-800 bg-[#0d1423] p-5"><p className="text-xs uppercase tracking-wider text-slate-500">{label}</p><p className="mt-3 text-3xl font-bold">{value}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></article>)}</section>

    <section className="mt-6 grid gap-4 xl:grid-cols-[1.5fr_.7fr]">
      <article className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1423]">
        <div className="border-b border-slate-800 p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-lg font-semibold">Operations Queue</h2><p className="mt-1 text-xs text-slate-500">Live shipment records from Supabase, prioritized for execution follow-up.</p></div><div className="flex flex-col gap-2 sm:flex-row"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search shipment / BL / container / route" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"/><select value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="all">All</option><option value="exceptions">Exceptions</option><option value="customs">Customs</option><option value="transit">In Transit</option></select></div></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Shipment</th><th className="px-5 py-3">Customer / Cargo</th><th className="px-5 py-3">Route</th><th className="px-5 py-3">Mode / Carrier</th><th className="px-5 py-3">ETA</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Risk</th></tr></thead><tbody>{attention.map((s:ShipmentOverview)=>{const d=daysTo(s.eta);return <tr key={s.id} className="border-b border-slate-800/80 last:border-0"><td className="px-5 py-4"><div className="font-semibold text-blue-300">{s.shipment_no}</div><div className="mt-1 text-xs text-slate-500">{s.container_no||s.bl_no||s.awb_no||s.booking_no||"No transport reference"}</div></td><td className="px-5 py-4"><div>{s.customer?.company_name||"Unassigned customer"}</div><div className="mt-1 max-w-[230px] truncate text-xs text-slate-500">{s.cargo_description||"Cargo not specified"}</div></td><td className="px-5 py-4"><div>{s.origin||"?"} → {s.destination||"?"}</div></td><td className="px-5 py-4"><div className="capitalize">{s.mode}</div><div className="text-xs text-slate-500">{s.carrier||"Carrier TBD"}</div></td><td className="px-5 py-4"><div>{s.eta||"TBD"}</div>{d!==null&&<div className={`text-xs ${d<0?"text-red-400":d<=3?"text-amber-400":"text-slate-500"}`}>{d<0?`${Math.abs(d)}d overdue`:d===0?"Today":`${d}d`}</div>}</td><td className="px-5 py-4"><span className={`rounded-lg border px-2.5 py-1 text-xs capitalize ${tone(s.status)}`}>{s.status.replaceAll("_"," ")}</span></td><td className="px-5 py-4"><div className={`inline-flex rounded-lg border px-2.5 py-1 text-xs capitalize ${tone(s.exception_status||s.risk_level||"normal")}`}>{(s.exception_status&&s.exception_status!=="clear")?s.exception_status:s.risk_level||"normal"}</div></td></tr>})}{!loading&&attention.length===0&&<tr><td colSpan={7} className="px-5 py-10 text-center text-slate-500">No shipments match the current filter.</td></tr>}</tbody></table></div>
      </article>

      <aside className="space-y-4">
        <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-5"><h2 className="font-semibold">Execution Workspaces</h2><div className="mt-4 space-y-2"><Link href="/shipping/shipments" className="block rounded-xl border border-slate-800 bg-slate-950/50 p-4 hover:border-blue-700"><b>Shipment Register</b><p className="mt-1 text-xs text-slate-500">Create, edit and execute shipment records.</p></Link><Link href="/shipping/tracking" className="block rounded-xl border border-slate-800 bg-slate-950/50 p-4 hover:border-blue-700"><b>Tracking & Visibility</b><p className="mt-1 text-xs text-slate-500">Container, vessel, AWB and transport events.</p></Link><Link href="/documents" className="block rounded-xl border border-slate-800 bg-slate-950/50 p-4 hover:border-blue-700"><b>Documents</b><p className="mt-1 text-xs text-slate-500">Operational shipping documents and records.</p></Link><Link href="/reports/logistics" className="block rounded-xl border border-slate-800 bg-slate-950/50 p-4 hover:border-blue-700"><b>Logistics Reports</b><p className="mt-1 text-xs text-slate-500">Performance, delay and cost analysis.</p></Link></div></article>
        <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-5"><h2 className="font-semibold">Control Logic</h2><div className="mt-4 space-y-3 text-xs text-slate-400"><p><span className="font-semibold text-white">Stale Tracking:</span> no update for more than 48 hours.</p><p><span className="font-semibold text-white">Exception:</span> watch, blocked or escalated shipment, or high/critical risk.</p><p><span className="font-semibold text-white">Overdue Milestone:</span> planned operational event not completed by its due time.</p></div></article>
      </aside>
    </section>
  </main>;
}
