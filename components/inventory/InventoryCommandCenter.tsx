"use client";

import { useEffect, useMemo, useState } from "react";
import { getInventoryWorkspace } from "@/lib/inventory-workspace";

const input = "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500";

function daysSince(v?: string | null) {
  if (!v) return null;
  return Math.floor((Date.now() - new Date(v).getTime()) / 86400000);
}
function daysUntil(v?: string | null) {
  if (!v) return null;
  return Math.ceil((new Date(v).getTime() - Date.now()) / 86400000);
}
function tone(v?: string | null) {
  const x = (v || "").toLowerCase();
  if (["damaged", "quarantine", "rejected", "expired", "blocked", "critical"].includes(x)) return "border-red-900 bg-red-950/30 text-red-300";
  if (["hold", "reserved", "inactive", "warning"].includes(x)) return "border-amber-900 bg-amber-950/30 text-amber-300";
  if (["available", "active", "good", "fulfilled"].includes(x)) return "border-emerald-900 bg-emerald-950/30 text-emerald-300";
  return "border-slate-700 bg-slate-900 text-slate-300";
}

export function InventoryCommandCenter() {
  const [data, setData] = useState<any>({warehouses:[],locations:[],items:[],lots:[],movements:[],reservations:[],customers:[],profiles:[],shipments:[],deals:[],suppliers:[]});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [warehouse, setWarehouse] = useState("all");
  const [health, setHealth] = useState("all");
  const [tab, setTab] = useState<"stock"|"warehouse"|"movement"|"reservation">("stock");

  const load = async () => {
    setLoading(true); setError(null);
    try { setData(await getInventoryWorkspace()); }
    catch (e:any) { setError(e.message || "Unable to load inventory workspace"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const enriched = useMemo(() => data.lots.map((l:any) => {
    const on = Number(l.qty_on_hand || 0), reserved = Number(l.qty_reserved || 0), available = on - reserved;
    const aging = daysSince(l.received_date), expiry = daysUntil(l.expiry_date);
    let risk = "healthy";
    if (l.condition_status !== "good" || ["hold","damaged","quarantine"].includes(l.stock_status)) risk = "exception";
    else if (expiry !== null && expiry < 0) risk = "expired";
    else if (expiry !== null && expiry <= 90) risk = "expiring";
    else if (aging !== null && aging > 180) risk = "aged";
    return {...l,on,reserved,available,aging,expiry,risk};
  }), [data.lots]);

  const metrics = useMemo(() => {
    const on = enriched.reduce((n:number,x:any)=>n+x.on,0);
    const reserved = enriched.reduce((n:number,x:any)=>n+x.reserved,0);
    const available = enriched.reduce((n:number,x:any)=>n+x.available,0);
    const exceptions = enriched.filter((x:any)=>["exception","expired"].includes(x.risk)).length;
    const expiring = enriched.filter((x:any)=>x.risk==="expiring").length;
    const aged = enriched.filter((x:any)=>x.risk==="aged").length;
    const low = data.items.filter((i:any)=>{
      const qty=enriched.filter((l:any)=>l.item_id===i.id).reduce((n:number,l:any)=>n+l.available,0);
      return Number(i.reorder_point||0)>0 && qty<=Number(i.reorder_point||0);
    }).length;
    const activeReservations=data.reservations.filter((r:any)=>r.status==="active").length;
    return {on,reserved,available,exceptions,expiring,aged,low,activeReservations};
  }, [enriched,data.items,data.reservations]);

  const filtered = useMemo(() => enriched.filter((l:any)=>{
    const hay=[l.item?.item_name,l.item?.sku,l.lot_no,l.batch_no,l.serial_no,l.container_no,l.warehouse?.name,l.location?.code,l.shipment?.shipment_no,l.owner_name].filter(Boolean).join(" ").toLowerCase();
    return (!search || hay.includes(search.toLowerCase())) && (warehouse==="all" || l.warehouse_id===warehouse) && (health==="all" || l.risk===health);
  }), [enriched,search,warehouse,health]);

  const warehouseStats = useMemo(() => data.warehouses.map((w:any)=>{
    const lots=enriched.filter((l:any)=>l.warehouse_id===w.id);
    const locations=data.locations.filter((l:any)=>l.warehouse_id===w.id);
    const occupied=new Set(lots.filter((l:any)=>l.on>0 && l.location_id).map((l:any)=>l.location_id)).size;
    return {...w,lots:lots.length,on:lots.reduce((n:number,l:any)=>n+l.on,0),available:lots.reduce((n:number,l:any)=>n+l.available,0),exceptions:lots.filter((l:any)=>l.risk!=="healthy").length,locations:locations.length,occupied,utilization:locations.length?Math.round((occupied/locations.length)*100):0};
  }), [data.warehouses,data.locations,enriched]);

  const attention = useMemo(() => enriched.filter((x:any)=>x.risk!=="healthy").sort((a:any,b:any)=>{
    const rank:any={expired:0,exception:1,expiring:2,aged:3}; return (rank[a.risk]??9)-(rank[b.risk]??9);
  }).slice(0,10), [enriched]);

  return <main className="p-5 text-white md:p-8">
    <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[.24em] text-blue-400">VTC Supply Chain Control</p><h1 className="mt-2 text-3xl font-bold">Inventory & Warehouse Command Center</h1><p className="mt-2 max-w-3xl text-sm text-slate-400">Live stock control across warehouse, location, SKU, lot, shipment linkage, reservations, aging, expiry exposure and movement history.</p></div>
      <button onClick={()=>void load()} disabled={loading} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold disabled:opacity-50">{loading?"Refreshing...":"Refresh Inventory"}</button>
    </header>
    {error&&<div className="mt-5 rounded-xl border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">{error}</div>}

    <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
      {[["On Hand",metrics.on],["Reserved",metrics.reserved],["Available",metrics.available],["Exceptions",metrics.exceptions],["Low Stock",metrics.low],["Expiry ≤90d",metrics.expiring],["Aged >180d",metrics.aged],["Reservations",metrics.activeReservations]].map(([l,v])=><article key={String(l)} className="rounded-2xl border border-slate-800 bg-[#0d1423] p-4"><p className="text-[11px] uppercase tracking-wider text-slate-500">{l}</p><p className="mt-2 text-2xl font-bold">{Number(v).toLocaleString()}</p></article>)}
    </section>

    <section className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_.8fr]">
      <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><h2 className="text-lg font-semibold">Stock Health</h2><p className="mt-1 text-xs text-slate-500">Inventory requiring operational attention before allocation or dispatch.</p></div><span className={`rounded-lg border px-3 py-1.5 text-xs ${metrics.exceptions||metrics.expiring?'border-amber-900 bg-amber-950/30 text-amber-300':'border-emerald-900 bg-emerald-950/30 text-emerald-300'}`}>{metrics.exceptions+metrics.expiring} attention item(s)</span></div>
        <div className="mt-4 space-y-2">{attention.length===0?<div className="rounded-xl border border-slate-800 p-5 text-sm text-slate-500">No inventory exceptions detected.</div>:attention.map((l:any)=><div key={l.id} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4 md:grid-cols-[1.2fr_.8fr_.7fr_auto]"><div><b>{l.item?.item_name||"Unnamed item"}</b><p className="text-xs text-slate-500">{l.item?.sku||"—"} · {l.lot_no||l.batch_no||"No lot"}</p></div><div className="text-sm">{l.warehouse?.name||"—"}<p className="text-xs text-slate-500">{l.location?.code||"Unassigned"}</p></div><div className="text-sm">Avail. {l.available.toLocaleString()} {l.unit}<p className="text-xs text-slate-500">Age {l.aging??"—"}d</p></div><span className={`h-fit rounded-lg border px-2.5 py-1 text-xs capitalize ${tone(l.risk)}`}>{l.risk}</span></div>)}</div>
      </article>
      <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-5"><h2 className="text-lg font-semibold">Warehouse Utilization</h2><p className="mt-1 text-xs text-slate-500">Location occupancy based on lots currently assigned to storage locations.</p><div className="mt-4 space-y-4">{warehouseStats.map((w:any)=><div key={w.id}><div className="flex items-center justify-between text-sm"><span>{w.name}</span><b>{w.utilization}%</b></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-blue-500" style={{width:`${Math.min(100,w.utilization)}%`}}/></div><div className="mt-1 flex justify-between text-[11px] text-slate-500"><span>{w.occupied}/{w.locations} locations occupied</span><span>{w.exceptions} exceptions</span></div></div>)}{warehouseStats.length===0&&<p className="text-sm text-slate-500">No warehouses configured.</p>}</div></article>
    </section>

    <div className="mt-6 flex flex-wrap gap-2">{[["stock","Stock Register"],["warehouse","Warehouses"],["movement","Movements"],["reservation","Reservations"]].map(([k,l])=><button key={k} onClick={()=>setTab(k as any)} className={`rounded-xl px-4 py-2 text-sm ${tab===k?'bg-blue-600':'border border-slate-700'}`}>{l}</button>)}</div>

    {tab==="stock"&&<><section className="mt-5 rounded-2xl border border-slate-800 bg-[#0d1423] p-4"><div className="grid gap-3 md:grid-cols-3"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search SKU, lot, batch, container, shipment..." className={input}/><select value={warehouse} onChange={e=>setWarehouse(e.target.value)} className={input}><option value="all">All Warehouses</option>{data.warehouses.map((w:any)=><option key={w.id} value={w.id}>{w.name}</option>)}</select><select value={health} onChange={e=>setHealth(e.target.value)} className={input}><option value="all">All Stock Health</option><option value="healthy">Healthy</option><option value="exception">Exception</option><option value="expired">Expired</option><option value="expiring">Expiring ≤90d</option><option value="aged">Aged &gt;180d</option></select></div></section><section className="mt-5 overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1423]"><div className="overflow-x-auto"><table className="w-full min-w-[1500px] text-left text-sm"><thead className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500"><tr>{["Item / SKU","Lot / Batch","Warehouse / Location","Shipment / Container","Received / Age","Expiry","On Hand","Reserved","Available","Condition","Status","Health"].map(h=><th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody>{loading?<tr><td colSpan={12} className="p-10 text-center text-slate-500">Loading inventory...</td></tr>:filtered.length===0?<tr><td colSpan={12} className="p-10 text-center text-slate-500">No stock matches the current filters.</td></tr>:filtered.map((l:any)=><tr key={l.id} className="border-b border-slate-800/80"><td className="px-4 py-4"><b>{l.item?.item_name||"Unnamed item"}</b><div className="text-xs text-slate-500">{l.item?.sku||"—"}</div></td><td className="px-4 py-4">{l.lot_no||"—"}<div className="text-xs text-slate-500">{l.batch_no||l.serial_no||""}</div></td><td className="px-4 py-4">{l.warehouse?.name||"—"}<div className="text-xs text-slate-500">{l.location?.code||"Unassigned"}</div></td><td className="px-4 py-4">{l.shipment?.shipment_no||"—"}<div className="text-xs text-slate-500">{l.container_no||""}</div></td><td className="px-4 py-4">{l.received_date||"—"}<div className="text-xs text-slate-500">{l.aging===null?"—":`${l.aging}d`}</div></td><td className="px-4 py-4">{l.expiry_date||"—"}<div className={`text-xs ${l.expiry!==null&&l.expiry<0?'text-red-400':l.expiry!==null&&l.expiry<=90?'text-amber-400':'text-slate-500'}`}>{l.expiry===null?'':l.expiry<0?`${Math.abs(l.expiry)}d expired`:`${l.expiry}d`}</div></td><td className="px-4 py-4">{l.on.toLocaleString()} {l.unit}</td><td className="px-4 py-4">{l.reserved.toLocaleString()}</td><td className="px-4 py-4 font-semibold text-emerald-400">{l.available.toLocaleString()}</td><td className="px-4 py-4"><span className={`rounded-lg border px-2 py-1 text-xs capitalize ${tone(l.condition_status)}`}>{l.condition_status}</span></td><td className="px-4 py-4"><span className={`rounded-lg border px-2 py-1 text-xs capitalize ${tone(l.stock_status)}`}>{String(l.stock_status).replaceAll('_',' ')}</span></td><td className="px-4 py-4"><span className={`rounded-lg border px-2 py-1 text-xs capitalize ${tone(l.risk)}`}>{l.risk}</span></td></tr>)}</tbody></table></div></section></>}

    {tab==="warehouse"&&<section className="mt-5 grid gap-4 xl:grid-cols-3">{warehouseStats.map((w:any)=><article key={w.id} className="rounded-2xl border border-slate-800 bg-[#0d1423] p-5"><div className="flex justify-between"><div><p className="text-xs uppercase tracking-wider text-blue-400">{w.code}</p><h3 className="mt-1 text-lg font-semibold">{w.name}</h3><p className="text-xs text-slate-500">{[w.city,w.country].filter(Boolean).join(', ')||'Location not set'}</p></div><span className={`h-fit rounded-lg border px-2 py-1 text-xs capitalize ${tone(w.status)}`}>{w.status}</span></div><div className="mt-5 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-slate-500">Locations</p><b>{w.locations}</b></div><div><p className="text-xs text-slate-500">Utilization</p><b>{w.utilization}%</b></div><div><p className="text-xs text-slate-500">On Hand</p><b>{w.on.toLocaleString()}</b></div><div><p className="text-xs text-slate-500">Available</p><b>{w.available.toLocaleString()}</b></div></div></article>)}</section>}

    {tab==="movement"&&<section className="mt-5 overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1423]"><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="border-b border-slate-800 text-xs uppercase text-slate-500"><tr><th className="p-4">Movement</th><th>Type</th><th>Item</th><th>Quantity</th><th>From</th><th>To</th><th>Reference</th><th>Performed By</th><th>Date</th></tr></thead><tbody>{data.movements.map((m:any)=><tr key={m.id} className="border-t border-slate-800"><td className="p-4 font-mono text-xs">{m.movement_no}</td><td className="capitalize">{m.movement_type}</td><td>{m.lot?.item?.item_name||"—"}<div className="text-xs text-slate-500">{m.lot?.item?.sku||""}</div></td><td>{m.quantity} {m.unit}</td><td>{m.from_location?.code||"—"}</td><td>{m.to_location?.code||"—"}</td><td>{m.reference_no||"—"}</td><td>{m.performed_by_profile?.full_name||"—"}</td><td>{m.created_at?new Date(m.created_at).toLocaleString():"—"}</td></tr>)}</tbody></table></div></section>}

    {tab==="reservation"&&<section className="mt-5 overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1423]"><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="border-b border-slate-800 text-xs uppercase text-slate-500"><tr><th className="p-4">Reservation</th><th>Item / Lot</th><th>Quantity</th><th>Customer</th><th>Deal</th><th>Shipment</th><th>Expires</th><th>Status</th></tr></thead><tbody>{data.reservations.map((r:any)=><tr key={r.id} className="border-t border-slate-800"><td className="p-4 font-mono text-xs">{r.reservation_no}</td><td>{r.lot?.item?.item_name||"—"}<div className="text-xs text-slate-500">{r.lot?.lot_no||""}</div></td><td>{r.quantity} {r.unit}</td><td>{r.customer?.company_name||"—"}</td><td>{r.deal?.deal_no||"—"}</td><td>{r.shipment?.shipment_no||"—"}</td><td>{r.expires_at?new Date(r.expires_at).toLocaleDateString():"—"}</td><td><span className={`rounded-lg border px-2 py-1 text-xs capitalize ${tone(r.status)}`}>{r.status}</span></td></tr>)}</tbody></table></div></section>}
  </main>;
}
