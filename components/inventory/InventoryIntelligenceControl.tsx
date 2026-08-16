"use client";

import { useEffect, useMemo, useState } from "react";
import { getInventoryWorkspace, linkInventoryLot, reserveFefo } from "@/lib/inventory-workspace";

const panel = "rounded-2xl border border-slate-800 bg-[#0d1423]";
const input = "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50";
const btn = "rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-blue-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
const primary = "rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";
const num = (v: unknown) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const dayMs = 86400000;

type Workspace = any;

type FefoForm = {
  item_id: string; warehouse_id: string; quantity: string; customer_id: string; deal_id: string; shipment_id: string;
  reserved_by: string; expires_at: string; notes: string;
};
const blankFefo: FefoForm = { item_id: "", warehouse_id: "", quantity: "", customer_id: "", deal_id: "", shipment_id: "", reserved_by: "", expires_at: "", notes: "" };

type LinkForm = {
  lot_id: string; customer_id: string; deal_id: string; shipment_id: string; owner_type: string; owner_name: string; reference_no: string; reason: string;
};
const blankLink: LinkForm = { lot_id: "", customer_id: "", deal_id: "", shipment_id: "", owner_type: "company", owner_name: "", reference_no: "", reason: "Stock ownership / commercial linkage update" };

export function InventoryIntelligenceControl() {
  const [data, setData] = useState<Workspace>({ warehouses: [], locations: [], items: [], lots: [], reservations: [], customers: [], profiles: [], shipments: [], deals: [] });
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fefoOpen, setFefoOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [fefo, setFefo] = useState<FefoForm>(blankFefo);
  const [link, setLink] = useState<LinkForm>(blankLink);

  const load = async () => {
    setLoading(true); setError(null);
    try { setData(await getInventoryWorkspace()); }
    catch (e: any) { setError(e.message || "Unable to load inventory intelligence data."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const activeWarehouses = useMemo(() => data.warehouses.filter((w: any) => w.status === "active"), [data.warehouses]);
  const filteredLots = useMemo(() => data.lots.filter((l: any) => warehouseFilter === "all" || l.warehouse_id === warehouseFilter), [data.lots, warehouseFilter]);
  const liveLots = useMemo(() => filteredLots.filter((l: any) => Number(l.qty_on_hand || 0) > 0), [filteredLots]);

  const expiryRows = useMemo(() => liveLots.filter((l: any) => l.expiry_date).map((l: any) => {
    const days = Math.ceil((new Date(`${l.expiry_date}T23:59:59`).getTime() - Date.now()) / dayMs);
    return { ...l, days };
  }).sort((a: any, b: any) => a.days - b.days), [liveLots]);

  const itemStock = useMemo(() => data.items.map((item: any) => {
    const lots = liveLots.filter((l: any) => l.item_id === item.id);
    const onHand = lots.reduce((n: number, l: any) => n + Number(l.qty_on_hand || 0), 0);
    const reserved = lots.reduce((n: number, l: any) => n + Number(l.qty_reserved || 0), 0);
    return { ...item, onHand, reserved, available: onHand - reserved };
  }), [data.items, liveLots]);
  const reorderRows = useMemo(() => itemStock.filter((i: any) => Number(i.reorder_point || 0) > 0 && i.onHand <= Number(i.reorder_point || 0)).sort((a: any, b: any) => (a.onHand / Number(a.reorder_point || 1)) - (b.onHand / Number(b.reorder_point || 1))), [itemStock]);

  const capacityRows = useMemo(() => data.locations.filter((loc: any) => (warehouseFilter === "all" || loc.warehouse_id === warehouseFilter) && Number(loc.capacity_qty || 0) > 0).map((loc: any) => {
    const lots = data.lots.filter((l: any) => l.location_id === loc.id && Number(l.qty_on_hand || 0) > 0 && (!loc.capacity_unit || l.unit === loc.capacity_unit));
    const used = lots.reduce((n: number, l: any) => n + Number(l.qty_on_hand || 0), 0);
    const capacity = Number(loc.capacity_qty || 0);
    return { ...loc, used, capacity, utilization: capacity > 0 ? (used / capacity) * 100 : 0 };
  }).sort((a: any, b: any) => b.utilization - a.utilization), [data.locations, data.lots, warehouseFilter]);

  const linkedLots = liveLots.filter((l: any) => l.shipment_id || l.deal_id || l.customer_id || l.owner_name);
  const unlinkedLots = liveLots.filter((l: any) => !l.shipment_id && !l.deal_id && !l.customer_id && !l.owner_name);
  const coverage = liveLots.length ? Math.round((linkedLots.length / liveLots.length) * 100) : 100;
  const expiring30 = expiryRows.filter((l: any) => l.days >= 0 && l.days <= 30).length;
  const expired = expiryRows.filter((l: any) => l.days < 0).length;
  const capacityRisk = capacityRows.filter((l: any) => l.utilization >= 85).length;

  const startFefo = () => {
    setError(null); setMessage(null);
    setFefo({ ...blankFefo, warehouse_id: warehouseFilter === "all" ? "" : warehouseFilter });
    setFefoOpen(true);
  };
  const startLink = (lot: any) => {
    setError(null); setMessage(null);
    setLink({ lot_id: lot.id, customer_id: lot.customer_id || "", deal_id: lot.deal_id || "", shipment_id: lot.shipment_id || "", owner_type: lot.owner_type || "company", owner_name: lot.owner_name || "", reference_no: "", reason: "Stock ownership / commercial linkage update" });
    setLinkOpen(true);
  };

  const submitFefo = async () => {
    setError(null);
    const qty = Number(fefo.quantity || 0);
    if (!fefo.item_id) return setError("Item is required for FEFO reservation.");
    if (qty <= 0) return setError("Reservation quantity must be greater than zero.");
    setSaving(true);
    try {
      const item = data.items.find((i: any) => i.id === fefo.item_id);
      const result: any = await reserveFefo({ ...fefo, quantity: qty, unit: item?.base_unit || undefined, warehouse_id: fefo.warehouse_id || null, customer_id: fefo.customer_id || null, deal_id: fefo.deal_id || null, shipment_id: fefo.shipment_id || null, reserved_by: fefo.reserved_by || null, expires_at: fefo.expires_at || null });
      const count = Array.isArray(result?.allocations) ? result.allocations.length : 0;
      setMessage(`FEFO reservation posted successfully. ${num(result?.reserved || qty)} ${item?.base_unit || "units"} allocated across ${count} lot${count === 1 ? "" : "s"}.`);
      setFefoOpen(false); setFefo(blankFefo); await load();
    } catch (e: any) { setError(e.message || "Unable to create FEFO reservation."); }
    finally { setSaving(false); }
  };

  const submitLink = async () => {
    setError(null);
    if (!link.lot_id) return setError("Inventory lot is required.");
    if (![link.customer_id, link.deal_id, link.shipment_id, link.owner_name].some(Boolean)) return setError("Add at least one commercial, shipment or ownership reference.");
    if (!link.reason.trim()) return setError("Reason is required for an audited linkage update.");
    setSaving(true);
    try {
      await linkInventoryLot({ ...link, customer_id: link.customer_id || null, deal_id: link.deal_id || null, shipment_id: link.shipment_id || null });
      setMessage("Stock linkage updated and recorded in the lot activity trail.");
      setLinkOpen(false); setLink(blankLink); await load();
    } catch (e: any) { setError(e.message || "Unable to update stock linkage."); }
    finally { setSaving(false); }
  };

  return <section className="px-5 pt-5 text-white md:px-8">
    <div className={panel}>
      <div className="flex flex-col gap-4 border-b border-slate-800 bg-gradient-to-r from-indigo-950/40 via-slate-950/20 to-emerald-950/20 p-5 md:p-6 xl:flex-row xl:items-center xl:justify-between">
        <div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-indigo-900 bg-indigo-950/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.18em] text-indigo-300">Inventory Intelligence</span><span className="text-xs text-slate-500">FEFO · Reorder · Capacity · Ownership</span></div><h2 className="mt-2 text-xl font-bold">Stock Intelligence & Commercial Linkage</h2><p className="mt-1 max-w-4xl text-sm leading-6 text-slate-400">Prioritize expiring stock, identify replenishment exposure, monitor location capacity and keep every live lot connected to its commercial or shipment context.</p></div>
        <div className="flex flex-wrap gap-2"><select className={`${input} min-w-56`} value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)}><option value="all">All Warehouses</option>{activeWarehouses.map((w: any) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select><button className={btn} disabled={loading} onClick={() => void load()}>{loading ? "Refreshing..." : "Refresh Intelligence"}</button><button className={primary} disabled={!data.items.length || !liveLots.length} onClick={startFefo}>Create FEFO Reservation</button></div>
      </div>
      {error && <Alert kind="error" text={error} onClose={() => setError(null)} />}
      {message && <Alert kind="success" text={message} onClose={() => setMessage(null)} />}
      <div className="grid gap-px border-b border-slate-800 bg-slate-800 sm:grid-cols-2 xl:grid-cols-5"><Kpi label="Expiring ≤30 Days" value={expiring30} tone={expiring30 ? "amber" : "default"} /><Kpi label="Expired Lots" value={expired} tone={expired ? "red" : "default"} /><Kpi label="Reorder Alerts" value={reorderRows.length} tone={reorderRows.length ? "amber" : "default"} /><Kpi label="Capacity Risk ≥85%" value={capacityRisk} tone={capacityRisk ? "amber" : "default"} /><Kpi label="Stock Linkage" value={`${coverage}%`} /></div>

      <div className="grid gap-5 p-5 md:p-6 2xl:grid-cols-2">
        <IntelligencePanel title="FEFO / Expiry Priority" subtitle="Earliest expiry lots first. Expired stock is excluded from FEFO reservation.">
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="text-left text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="pb-3">Item / Lot</th><th>Warehouse</th><th>Expiry</th><th>Days</th><th>Available</th><th>Status</th></tr></thead><tbody>{expiryRows.slice(0, 12).map((l: any) => <tr key={l.id} className="border-t border-slate-800"><td className="py-3"><b>{l.item?.sku || "SKU"}</b><p className="text-xs text-slate-500">{l.lot_no || l.batch_no || "No lot reference"}</p></td><td>{l.warehouse?.code || "-"}</td><td>{l.expiry_date}</td><td className={l.days < 0 ? "text-red-300" : l.days <= 30 ? "text-amber-300" : "text-slate-300"}>{l.days}</td><td>{num(Number(l.qty_on_hand || 0) - Number(l.qty_reserved || 0))} {l.unit}</td><td>{l.stock_status}</td></tr>)}{!expiryRows.length && <tr><td colSpan={6} className="py-8 text-center text-slate-500">No expiry-controlled stock is currently recorded.</td></tr>}</tbody></table></div>
        </IntelligencePanel>

        <IntelligencePanel title="Reorder Intelligence" subtitle="Items at or below their configured reorder point for the selected warehouse scope.">
          <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead className="text-left text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="pb-3">SKU / Item</th><th>On Hand</th><th>Available</th><th>Reorder Point</th><th>Gap</th></tr></thead><tbody>{reorderRows.slice(0, 12).map((i: any) => <tr key={i.id} className="border-t border-slate-800"><td className="py-3"><b>{i.sku}</b><p className="text-xs text-slate-500">{i.item_name}</p></td><td>{num(i.onHand)}</td><td>{num(i.available)}</td><td>{num(i.reorder_point)}</td><td className="text-amber-300">{num(Math.max(0, Number(i.reorder_point || 0) - i.onHand))} {i.base_unit}</td></tr>)}{!reorderRows.length && <tr><td colSpan={5} className="py-8 text-center text-slate-500">No items are below their configured reorder point.</td></tr>}</tbody></table></div>
        </IntelligencePanel>

        <IntelligencePanel title="Location Capacity" subtitle="Capacity is enforced by the database when a compatible capacity unit is configured.">
          <div className="space-y-3">{capacityRows.slice(0, 12).map((loc: any) => <div key={loc.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"><div className="flex items-center justify-between gap-3"><div><b>{loc.warehouse?.code || "WH"} · {loc.code}</b><p className="mt-1 text-xs text-slate-500">{[loc.zone, loc.aisle, loc.rack, loc.bin].filter(Boolean).join(" / ") || loc.location_type || "Storage location"}</p></div><span className={loc.utilization >= 100 ? "text-red-300" : loc.utilization >= 85 ? "text-amber-300" : "text-emerald-300"}>{Math.round(loc.utilization)}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full ${loc.utilization >= 100 ? "bg-red-500" : loc.utilization >= 85 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, Math.max(0, loc.utilization))}%` }} /></div><p className="mt-2 text-xs text-slate-500">{num(loc.used)} / {num(loc.capacity)} {loc.capacity_unit || "units"}</p></div>)}{!capacityRows.length && <div className="py-8 text-center text-sm text-slate-500">No location capacities are configured for this warehouse scope.</div>}</div>
        </IntelligencePanel>

        <IntelligencePanel title="Ownership & Commercial Linkage" subtitle="Live lots without a customer, deal, shipment or ownership reference are surfaced for control.">
          <div className="space-y-2">{unlinkedLots.slice(0, 10).map((l: any) => <div key={l.id} className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:flex-row sm:items-center sm:justify-between"><div><b>{l.item?.sku || "SKU"} · {l.lot_no || l.batch_no || "Lot"}</b><p className="mt-1 text-xs text-slate-500">{l.warehouse?.name || "Warehouse"} · {num(l.qty_on_hand)} {l.unit} on hand</p></div><button className={btn} onClick={() => startLink(l)}>Link Stock</button></div>)}{!unlinkedLots.length && <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-5 text-sm text-emerald-300">All live lots in this scope have commercial, shipment or ownership linkage.</div>}</div>
        </IntelligencePanel>
      </div>
    </div>

    {fefoOpen && <Modal title="Create FEFO Reservation" subtitle="The database allocates earliest-expiry eligible stock first and can split one request across multiple lots."><div className="grid gap-4 md:grid-cols-2"><Field label="Item *"><select className={input} value={fefo.item_id} onChange={e => setFefo(v => ({ ...v, item_id: e.target.value }))}><option value="">Select item</option>{data.items.filter((i: any) => i.status === "active").map((i: any) => <option key={i.id} value={i.id}>{i.sku} · {i.item_name}</option>)}</select></Field><Field label="Warehouse Scope"><select className={input} value={fefo.warehouse_id} onChange={e => setFefo(v => ({ ...v, warehouse_id: e.target.value }))}><option value="">All active warehouses</option>{activeWarehouses.map((w: any) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></Field><Field label="Quantity *"><input className={input} type="number" min={0} value={fefo.quantity} onChange={e => setFefo(v => ({ ...v, quantity: e.target.value }))} /></Field><Field label="Reservation Expiry"><input className={input} type="datetime-local" value={fefo.expires_at} onChange={e => setFefo(v => ({ ...v, expires_at: e.target.value }))} /></Field><Field label="Customer"><select className={input} value={fefo.customer_id} onChange={e => setFefo(v => ({ ...v, customer_id: e.target.value }))}><option value="">No customer link</option>{data.customers.map((x: any) => <option key={x.id} value={x.id}>{x.company_name}</option>)}</select></Field><Field label="Deal"><select className={input} value={fefo.deal_id} onChange={e => setFefo(v => ({ ...v, deal_id: e.target.value }))}><option value="">No deal link</option>{data.deals.map((x: any) => <option key={x.id} value={x.id}>{x.deal_no}</option>)}</select></Field><Field label="Shipment"><select className={input} value={fefo.shipment_id} onChange={e => setFefo(v => ({ ...v, shipment_id: e.target.value }))}><option value="">No shipment link</option>{data.shipments.map((x: any) => <option key={x.id} value={x.id}>{x.shipment_no}</option>)}</select></Field><Field label="Reserved By"><select className={input} value={fefo.reserved_by} onChange={e => setFefo(v => ({ ...v, reserved_by: e.target.value }))}><option value="">Current signed-in user</option>{data.profiles.map((x: any) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</select></Field></div><Field label="Notes"><textarea className={`${input} mt-2 min-h-24`} value={fefo.notes} onChange={e => setFefo(v => ({ ...v, notes: e.target.value }))} /></Field><ModalActions saving={saving} close={() => setFefoOpen(false)} submit={() => void submitFefo()} label="Create FEFO Reservation" /></Modal>}

    {linkOpen && <Modal title="Link Inventory Stock" subtitle="Attach the lot to its commercial and operational context. Every update is written to the lot activity trail."><div className="grid gap-4 md:grid-cols-2"><Field label="Customer"><select className={input} value={link.customer_id} onChange={e => setLink(v => ({ ...v, customer_id: e.target.value }))}><option value="">No customer link</option>{data.customers.map((x: any) => <option key={x.id} value={x.id}>{x.company_name}</option>)}</select></Field><Field label="Deal"><select className={input} value={link.deal_id} onChange={e => setLink(v => ({ ...v, deal_id: e.target.value }))}><option value="">No deal link</option>{data.deals.map((x: any) => <option key={x.id} value={x.id}>{x.deal_no}</option>)}</select></Field><Field label="Shipment"><select className={input} value={link.shipment_id} onChange={e => setLink(v => ({ ...v, shipment_id: e.target.value }))}><option value="">No shipment link</option>{data.shipments.map((x: any) => <option key={x.id} value={x.id}>{x.shipment_no}</option>)}</select></Field><Field label="Owner Type"><select className={input} value={link.owner_type} onChange={e => setLink(v => ({ ...v, owner_type: e.target.value }))}>{["company", "customer", "supplier", "third_party"].map(x => <option key={x} value={x}>{x.replace("_", " ")}</option>)}</select></Field><Field label="Owner Name"><input className={input} value={link.owner_name} onChange={e => setLink(v => ({ ...v, owner_name: e.target.value }))} placeholder="Legal / commercial owner" /></Field><Field label="Reference No."><input className={input} value={link.reference_no} onChange={e => setLink(v => ({ ...v, reference_no: e.target.value }))} placeholder="Job, instruction or approval reference" /></Field></div><Field label="Reason *"><textarea className={`${input} mt-2 min-h-24`} value={link.reason} onChange={e => setLink(v => ({ ...v, reason: e.target.value }))} /></Field><ModalActions saving={saving} close={() => setLinkOpen(false)} submit={() => void submitLink()} label="Save Stock Linkage" /></Modal>}
  </section>;
}

function IntelligencePanel({ title, subtitle, children }: any) { return <div className="rounded-2xl border border-slate-800 bg-slate-950/20 p-5"><h3 className="font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p><div className="mt-4">{children}</div></div>; }
function Kpi({ label, value, tone = "default" }: any) { return <div className="bg-[#0d1423] p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-2 text-2xl font-bold ${tone === "red" ? "text-red-300" : tone === "amber" ? "text-amber-300" : "text-white"}`}>{value}</p></div>; }
function Field({ label, children }: any) { return <label className="block text-xs text-slate-400">{label}<div className="mt-2">{children}</div></label>; }
function Modal({ title, subtitle, children }: any) { return <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 p-4 backdrop-blur-sm md:p-8"><div className="mx-auto max-w-4xl rounded-3xl border border-slate-700 bg-[#0b1120] shadow-2xl"><div className="border-b border-slate-800 p-6"><p className="text-xs font-semibold uppercase tracking-[.2em] text-indigo-400">Inventory Intelligence</p><h2 className="mt-1 text-2xl font-bold">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{subtitle}</p></div><div className="space-y-4 p-6">{children}</div></div></div>; }
function ModalActions({ saving, close, submit, label }: any) { return <div className="flex justify-end gap-2 border-t border-slate-800 pt-5"><button className={btn} disabled={saving} onClick={close}>Cancel</button><button className={primary} disabled={saving} onClick={submit}>{saving ? "Processing..." : label}</button></div>; }
function Alert({ kind, text, onClose }: any) { const ok = kind === "success"; return <div className={`mx-5 mt-5 flex items-start justify-between gap-3 rounded-xl border p-4 text-sm md:mx-6 ${ok ? "border-emerald-900 bg-emerald-950/30 text-emerald-300" : "border-red-900 bg-red-950/30 text-red-300"}`}><span>{text}</span><button onClick={onClose}>×</button></div>; }
