"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addMovement,
  addReservation,
  getInventoryWorkspace,
  releaseReservation,
  saveItem,
  saveLocation,
  saveLot,
  saveWarehouse,
} from "@/lib/inventory-workspace";

const input = "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60";
const btn = "rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-blue-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
const primary = "rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";
const danger = "rounded-xl border border-red-900 bg-red-950/30 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-950/60 disabled:cursor-not-allowed disabled:opacity-50";
const panel = "rounded-2xl border border-slate-800 bg-[#0d1423]";
const num = (v: any) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const daysSince = (v?: string | null) => v ? Math.floor((Date.now() - new Date(v).getTime()) / 86400000) : null;
const daysUntil = (v?: string | null) => v ? Math.ceil((new Date(v).getTime() - Date.now()) / 86400000) : null;

function tone(v?: string | null) {
  const x = (v || "").toLowerCase();
  if (["damaged", "quarantine", "rejected", "expired", "blocked", "critical", "exception"].includes(x)) return "border-red-900 bg-red-950/30 text-red-300";
  if (["hold", "reserved", "inactive", "warning", "expiring", "aged"].includes(x)) return "border-amber-900 bg-amber-950/30 text-amber-300";
  if (["available", "active", "good", "fulfilled", "healthy", "receipt", "released"].includes(x)) return "border-emerald-900 bg-emerald-950/30 text-emerald-300";
  if (["issue", "transfer", "adjustment"].includes(x)) return "border-blue-900 bg-blue-950/30 text-blue-300";
  return "border-slate-700 bg-slate-900 text-slate-300";
}

type Tab = "stock" | "warehouses" | "items" | "movements" | "reservations";
type ModalType = "warehouse" | "location" | "item" | "receive" | "lot" | "movement" | "reservation" | null;

type Workspace = {
  warehouses: any[];
  locations: any[];
  items: any[];
  lots: any[];
  movements: any[];
  reservations: any[];
  customers: any[];
  profiles: any[];
  shipments: any[];
  deals: any[];
  suppliers: any[];
};

const blank: Record<string, any> = {
  warehouse: { code: "", name: "", warehouse_type: "general", country: "UAE", city: "Dubai", address: "", operator_name: "", contact_person: "", phone: "", status: "active", temperature_controlled: false, notes: "" },
  location: { warehouse_id: "", code: "", zone: "", aisle: "", rack: "", bin: "", location_type: "storage", capacity_qty: "", capacity_unit: "KG", temperature_min_c: "", temperature_max_c: "", status: "available", notes: "" },
  item: { sku: "", item_name: "", description: "", category: "", hs_code: "", base_unit: "KG", min_stock: 0, reorder_point: 0, lot_controlled: true, serial_controlled: false, expiry_controlled: false, temperature_controlled: false, customer_id: "", supplier_id: "", status: "active", notes: "" },
  receive: { item_id: "", warehouse_id: "", location_id: "", shipment_id: "", lot_no: "", batch_no: "", serial_no: "", container_no: "", package_ref: "", received_date: today(), production_date: "", expiry_date: "", condition_status: "good", stock_status: "available", qty_on_hand: "", qty_reserved: 0, unit: "KG", gross_weight_kg: "", net_weight_kg: "", volume_cbm: "", owner_type: "vtc", owner_name: "", customs_status: "", notes: "" },
  lot: {},
  movement: { movement_type: "issue", lot_id: "", quantity: "", unit: "KG", from_location_id: "", to_location_id: "", reference_no: "", reason: "", performed_by: "" },
  reservation: { lot_id: "", quantity: "", unit: "KG", customer_id: "", deal_id: "", shipment_id: "", reserved_by: "", expires_at: "", notes: "" },
};

export function InventoryCommandCenter() {
  const [data, setData] = useState<Workspace>({ warehouses: [], locations: [], items: [], lots: [], movements: [], reservations: [], customers: [], profiles: [], shipments: [], deals: [], suppliers: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("stock");
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [health, setHealth] = useState("all");
  const [modal, setModal] = useState<ModalType>(null);
  const [form, setForm] = useState<any>(null);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getInventoryWorkspace());
    } catch (e: any) {
      setError(e.message || "Unable to load inventory workspace");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const lots = useMemo(() => data.lots.map((l: any) => {
    const on = Number(l.qty_on_hand || 0);
    const reserved = Number(l.qty_reserved || 0);
    const available = on - reserved;
    const aging = daysSince(l.received_date);
    const expiry = daysUntil(l.expiry_date);
    let risk = "healthy";
    if (l.condition_status !== "good" || ["hold", "damaged", "quarantine"].includes(l.stock_status)) risk = "exception";
    else if (expiry !== null && expiry < 0) risk = "expired";
    else if (expiry !== null && expiry <= 90) risk = "expiring";
    else if (aging !== null && aging > 180) risk = "aged";
    return { ...l, on, reserved, available, aging, expiry, risk };
  }), [data.lots]);

  const selectedLot = useMemo(() => lots.find((l: any) => l.id === selectedLotId) || null, [lots, selectedLotId]);

  const metrics = useMemo(() => {
    const on = lots.reduce((n: number, x: any) => n + x.on, 0);
    const reserved = lots.reduce((n: number, x: any) => n + x.reserved, 0);
    const available = lots.reduce((n: number, x: any) => n + x.available, 0);
    const exceptions = lots.filter((x: any) => ["exception", "expired"].includes(x.risk)).length;
    const expiring = lots.filter((x: any) => x.risk === "expiring").length;
    const aged = lots.filter((x: any) => x.risk === "aged").length;
    const low = data.items.filter((i: any) => {
      const q = lots.filter((l: any) => l.item_id === i.id).reduce((n: number, l: any) => n + l.available, 0);
      return Number(i.reorder_point || 0) > 0 && q <= Number(i.reorder_point || 0);
    }).length;
    return { on, reserved, available, exceptions, expiring, aged, low, reservations: data.reservations.filter((r: any) => r.status === "active").length };
  }, [lots, data.items, data.reservations]);

  const warehouseStats = useMemo(() => data.warehouses.map((w: any) => {
    const wl = lots.filter((l: any) => l.warehouse_id === w.id);
    const loc = data.locations.filter((x: any) => x.warehouse_id === w.id);
    const occupied = new Set(wl.filter((l: any) => l.on > 0 && l.location_id).map((l: any) => l.location_id)).size;
    return {
      ...w,
      lots: wl.length,
      on: wl.reduce((n: number, l: any) => n + l.on, 0),
      available: wl.reduce((n: number, l: any) => n + l.available, 0),
      exceptions: wl.filter((l: any) => l.risk !== "healthy").length,
      locations: loc.length,
      occupied,
      utilization: loc.length ? Math.round((occupied / loc.length) * 100) : 0,
    };
  }), [data.warehouses, data.locations, lots]);

  const filteredLots = useMemo(() => lots.filter((l: any) => {
    const hay = [l.item?.item_name, l.item?.sku, l.lot_no, l.batch_no, l.serial_no, l.container_no, l.warehouse?.name, l.location?.code, l.shipment?.shipment_no, l.owner_name].filter(Boolean).join(" ").toLowerCase();
    return (!search || hay.includes(search.toLowerCase())) && (warehouseFilter === "all" || l.warehouse_id === warehouseFilter) && (health === "all" || l.risk === health);
  }), [lots, search, warehouseFilter, health]);

  const attention = useMemo(() => lots.filter((x: any) => x.risk !== "healthy").sort((a: any, b: any) => riskScore(b.risk) - riskScore(a.risk)).slice(0, 8), [lots]);

  const open = (t: ModalType, row?: any) => {
    setError(null);
    setMsg(null);
    setModal(t);
    if (t === "receive") setForm({ ...blank.receive, ...(row || {}) });
    else if (t === "lot") setForm({ ...(row || {}) });
    else setForm({ ...(blank[t || ""] || {}), ...(row || {}) });
  };

  const patch = (k: string, v: any) => setForm((x: any) => ({ ...x, [k]: v }));

  const openMovement = (lot: any, type: string) => {
    const q = type === "quarantine" ? lot.on : "";
    open("movement", {
      movement_type: type,
      lot_id: lot.id,
      quantity: q,
      unit: lot.unit,
      from_location_id: lot.location_id || "",
      to_location_id: "",
      reference_no: "",
      reason: "",
      performed_by: "",
    });
  };

  const openReservation = (lot: any) => open("reservation", { ...blank.reservation, lot_id: lot.id, unit: lot.unit });

  const save = async () => {
    if (!modal || !form) return;
    setSaving(true);
    setError(null);
    try {
      if (modal === "warehouse") {
        if (!form.code?.trim() || !form.name?.trim()) throw new Error("Warehouse code and name are required.");
        await saveWarehouse(form);
      }
      if (modal === "location") {
        if (!form.warehouse_id || !form.code?.trim()) throw new Error("Warehouse and location code are required.");
        await saveLocation(form);
      }
      if (modal === "item") {
        if (!form.sku?.trim() || !form.item_name?.trim()) throw new Error("SKU and item name are required.");
        await saveItem(form);
      }
      if (modal === "receive") {
        if (!form.item_id || !form.warehouse_id) throw new Error("Item and warehouse are required.");
        if (Number(form.qty_on_hand || 0) <= 0) throw new Error("Received quantity must be greater than zero.");
        const location = form.location_id ? data.locations.find((x: any) => x.id === form.location_id) : null;
        if (location && ["hold", "blocked"].includes(location.status)) throw new Error("Selected location is not available for receiving stock.");
        const item = data.items.find((x: any) => x.id === form.item_id);
        if (item?.expiry_controlled && !form.expiry_date) throw new Error("Expiry date is required for this expiry-controlled item.");
        if (item?.serial_controlled && !form.serial_no?.trim()) throw new Error("Serial number is required for this serial-controlled item.");
        await saveLot(form);
      }
      if (modal === "lot") {
        if (!form.id) throw new Error("Lot record is missing.");
        if (!form.item_id || !form.warehouse_id) throw new Error("Item and warehouse are required.");
        await saveLot(form);
      }
      if (modal === "movement") {
        if (!form.lot_id || !form.quantity) throw new Error("Lot and quantity are required.");
        const lot = lots.find((x: any) => x.id === form.lot_id);
        const q = Number(form.quantity || 0);
        if (!lot || q <= 0) throw new Error("Enter a valid movement quantity.");
        if (["issue", "damage"].includes(form.movement_type) && q > lot.available) throw new Error(`Maximum available quantity is ${num(lot.available)} ${lot.unit}.`);
        if (form.movement_type === "transfer" && !form.to_location_id) throw new Error("Destination location is required for transfer.");
        if (form.movement_type === "transfer" && form.to_location_id === lot.location_id) throw new Error("Choose a different destination location.");
        if (form.movement_type === "quarantine" && q !== lot.on) throw new Error("Quarantine currently applies to the complete lot balance.");
        if (!form.reason?.trim() && ["adjustment", "damage", "quarantine"].includes(form.movement_type)) throw new Error("Reason is required for this movement type.");
        await addMovement(form);
      }
      if (modal === "reservation") {
        if (!form.lot_id || !form.quantity) throw new Error("Lot and quantity are required.");
        const lot = lots.find((x: any) => x.id === form.lot_id);
        if (!lot) throw new Error("Selected lot no longer exists.");
        const q = Number(form.quantity || 0);
        if (q <= 0 || q > lot.available) throw new Error(`Reservation must be between 0 and ${num(lot.available)} ${lot.unit}.`);
        await addReservation(form);
      }
      const success = modal === "receive" ? "Stock receipt posted and movement audit created." : modal === "movement" ? "Stock movement posted successfully." : modal === "reservation" ? "Stock reservation created successfully." : "Inventory record saved successfully.";
      setMsg(success);
      setModal(null);
      await load();
    } catch (e: any) {
      setError(e.message || "Unable to save inventory record");
    } finally {
      setSaving(false);
    }
  };

  const resetFilters = () => { setSearch(""); setWarehouseFilter("all"); setHealth("all"); };
  const hasFilters = !!search || warehouseFilter !== "all" || health !== "all";

  return <main className="p-5 text-white md:p-8">
    <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[.24em] text-blue-400">VTC Supply Chain Control</p>
          <span className="rounded-full border border-emerald-900 bg-emerald-950/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">Live Operations</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Inventory & Warehouse Command Center</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Control physical stock, warehouse locations, lot traceability, reservations and audited inventory movements from one operational workspace.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={btn} onClick={() => void load()} disabled={loading}>{loading ? "Refreshing..." : "Refresh Data"}</button>
        <button className={primary} onClick={() => open("receive")}>+ Receive Stock</button>
      </div>
    </header>

    {error && <div className="mt-5 flex items-start justify-between gap-3 rounded-xl border border-red-900 bg-red-950/30 p-4 text-sm text-red-300"><span>{error}</span><button className="text-red-200" onClick={() => setError(null)}>×</button></div>}
    {msg && <div className="mt-5 flex items-start justify-between gap-3 rounded-xl border border-emerald-900 bg-emerald-950/30 p-4 text-sm text-emerald-300"><span>{msg}</span><button className="text-emerald-200" onClick={() => setMsg(null)}>×</button></div>}

    <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
      <Metric label="On Hand" value={metrics.on} helper="Physical balance" />
      <Metric label="Reserved" value={metrics.reserved} helper="Committed stock" />
      <Metric label="Available" value={metrics.available} helper="Free to allocate" accent="emerald" />
      <Metric label="Exceptions" value={metrics.exceptions} helper="Needs action" accent={metrics.exceptions ? "red" : "default"} />
      <Metric label="Low Stock" value={metrics.low} helper="At reorder point" accent={metrics.low ? "amber" : "default"} />
      <Metric label="Expiry ≤90d" value={metrics.expiring} helper="Near expiry" accent={metrics.expiring ? "amber" : "default"} />
      <Metric label="Aged >180d" value={metrics.aged} helper="Slow-moving" />
      <Metric label="Reservations" value={metrics.reservations} helper="Active holds" />
    </section>

    <section className="mt-6 grid gap-4 xl:grid-cols-[1.35fr_.85fr]">
      <article className={`${panel} p-5`}>
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="font-semibold">Inventory Attention Queue</h2><p className="mt-1 text-xs leading-5 text-slate-500">Expired, damaged, quarantined, near-expiry and aged stock requiring operational review.</p></div>
          <span className={`h-fit rounded-lg border px-3 py-1 text-xs ${tone(attention.length ? "warning" : "healthy")}`}>{attention.length} flagged</span>
        </div>
        <div className="mt-4 space-y-2">
          {attention.length === 0 ? <EmptyMini text="No inventory exceptions detected." /> : attention.map((l: any) => <button type="button" key={l.id} onClick={() => setSelectedLotId(l.id)} className="grid w-full gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-left transition hover:border-slate-600 md:grid-cols-[1.2fr_.8fr_.7fr_auto]">
            <div><b>{l.item?.item_name || "Unnamed item"}</b><p className="mt-1 text-xs text-slate-500">{l.item?.sku || "—"} · {l.lot_no || l.batch_no || "No lot"}</p></div>
            <div className="text-sm">{l.warehouse?.name || "—"}<p className="mt-1 text-xs text-slate-500">{l.location?.code || "Unassigned"}</p></div>
            <div className="text-sm">Avail. {num(l.available)} {l.unit}<p className="mt-1 text-xs text-slate-500">Age {l.aging ?? "—"}d</p></div>
            <Badge v={l.risk} />
          </button>)}
        </div>
      </article>

      <article className={`${panel} p-5`}>
        <h2 className="font-semibold">Warehouse Utilization</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">Occupied storage locations against configured locations. Capacity-based utilization can be added once dimensional capacity is maintained consistently.</p>
        <div className="mt-4 space-y-4">
          {warehouseStats.length === 0 ? <EmptyMini text="No warehouses configured." /> : warehouseStats.map((w: any) => <div key={w.id}>
            <div className="flex justify-between gap-3 text-sm"><span className="truncate">{w.name}</span><b>{w.utilization}%</b></div>
            <div className="mt-2 h-2 rounded-full bg-slate-800"><div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.min(100, w.utilization)}%` }} /></div>
            <div className="mt-1 flex justify-between text-[11px] text-slate-500"><span>{w.occupied}/{w.locations} occupied</span><span>{w.exceptions} exceptions</span></div>
          </div>)}
        </div>
      </article>
    </section>

    <nav className="mt-6 flex flex-wrap gap-2" aria-label="Inventory workspace sections">
      {[["stock", "Stock Register"], ["warehouses", "Warehouses"], ["items", "Item Master"], ["movements", "Movements"], ["reservations", "Reservations"]].map(([k, l]) => <button key={k} onClick={() => setTab(k as Tab)} className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${tab === k ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30" : "border border-slate-700 bg-slate-950/30 text-slate-300 hover:border-slate-600 hover:text-white"}`}>{l}</button>)}
    </nav>

    {tab === "stock" && <>
      <section className={`${panel} mt-5 p-4`}>
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px_auto_auto]">
          <input className={input} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search SKU, lot, batch, serial, container, shipment or owner..." />
          <select className={input} value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)}><option value="all">All Warehouses</option>{data.warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
          <select className={input} value={health} onChange={e => setHealth(e.target.value)}><option value="all">All Stock Health</option><option value="healthy">Healthy</option><option value="exception">Exception</option><option value="expired">Expired</option><option value="expiring">Expiring ≤90d</option><option value="aged">Aged &gt;180d</option></select>
          <button className={btn} onClick={resetFilters} disabled={!hasFilters}>Clear Filters</button>
          <button className={primary} onClick={() => open("receive")}>+ Receive Stock</button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>Showing {filteredLots.length} of {lots.length} lots</span><span>Inventory balance changes are posted through audited movements only.</span></div>
      </section>
      <Table headers={["Item / SKU", "Lot / Batch", "Warehouse / Location", "Shipment / Container", "Received / Age", "Expiry", "On Hand", "Reserved", "Available", "Condition", "Health", "Actions"]} empty="No stock matches the current filters.">
        {filteredLots.map((l: any) => <tr key={l.id} className="border-b border-slate-800/80 align-top hover:bg-slate-900/30">
          <td className="px-4 py-4"><button className="text-left" onClick={() => setSelectedLotId(l.id)}><b className="hover:text-blue-300">{l.item?.item_name || "Unnamed"}</b><div className="mt-1 text-xs text-slate-500">{l.item?.sku || "—"}</div></button></td>
          <td className="px-4 py-4">{l.lot_no || "—"}<div className="mt-1 text-xs text-slate-500">{l.batch_no || l.serial_no || ""}</div></td>
          <td className="px-4 py-4">{l.warehouse?.name || "—"}<div className="mt-1 text-xs text-slate-500">{l.location?.code || "Unassigned"}</div></td>
          <td className="px-4 py-4">{l.shipment?.shipment_no || "—"}<div className="mt-1 text-xs text-slate-500">{l.container_no || ""}</div></td>
          <td className="px-4 py-4">{l.received_date || "—"}<div className="mt-1 text-xs text-slate-500">{l.aging === null ? "—" : `${l.aging}d`}</div></td>
          <td className="px-4 py-4">{l.expiry_date || "—"}<div className="mt-1 text-xs text-slate-500">{l.expiry === null ? "" : l.expiry < 0 ? `${Math.abs(l.expiry)}d expired` : `${l.expiry}d`}</div></td>
          <td className="px-4 py-4 font-medium">{num(l.on)} {l.unit}</td>
          <td className="px-4 py-4">{num(l.reserved)}</td>
          <td className="px-4 py-4 font-semibold text-emerald-400">{num(l.available)}</td>
          <td className="px-4 py-4"><Badge v={l.condition_status} /></td>
          <td className="px-4 py-4"><Badge v={l.risk} /></td>
          <td className="px-4 py-4"><div className="flex flex-wrap gap-2"><button className={btn} onClick={() => setSelectedLotId(l.id)}>Open</button>{l.available > 0 && <button className={btn} onClick={() => openReservation(l)}>Reserve</button>}</div></td>
        </tr>)}
      </Table>
    </>}

    {tab === "warehouses" && <>
      <div className="mt-5 flex flex-wrap justify-end gap-2"><button className={btn} onClick={() => open("location")}>+ New Location</button><button className={primary} onClick={() => open("warehouse")}>+ New Warehouse</button></div>
      <section className="mt-4 grid gap-4 xl:grid-cols-3">
        {warehouseStats.length === 0 ? <div className={`${panel} col-span-full p-8 text-center text-sm text-slate-500`}>No warehouses configured.</div> : warehouseStats.map((w: any) => <article key={w.id} className={`${panel} p-5`}>
          <div className="flex justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-400">{w.code}</p><h3 className="mt-1 text-lg font-semibold">{w.name}</h3><p className="mt-1 text-xs text-slate-500">{[w.city, w.country].filter(Boolean).join(", ") || "Location not set"}</p></div><Badge v={w.status} /></div>
          <div className="mt-5 grid grid-cols-2 gap-3"><Stat l="Locations" v={w.locations} /><Stat l="Utilization" v={`${w.utilization}%`} /><Stat l="Lots" v={w.lots} /><Stat l="Available" v={num(w.available)} /></div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>{w.temperature_controlled ? "Temperature controlled" : "Ambient / standard"}</span><button className={btn} onClick={() => open("warehouse", w)}>Edit</button></div>
        </article>)}
      </section>
      <Table headers={["Warehouse", "Location", "Zone", "Aisle / Rack / Bin", "Type", "Capacity", "Temperature", "Status", "Action"]} empty="No warehouse locations configured.">
        {data.locations.map((l: any) => <tr key={l.id} className="border-b border-slate-800 hover:bg-slate-900/30"><td className="px-4 py-4">{l.warehouse?.name || "—"}</td><td className="px-4 py-4 font-semibold">{l.code}</td><td className="px-4 py-4">{l.zone || "—"}</td><td className="px-4 py-4">{[l.aisle, l.rack, l.bin].filter(Boolean).join(" / ") || "—"}</td><td className="px-4 py-4">{formatLabel(l.location_type || "storage")}</td><td className="px-4 py-4">{l.capacity_qty ? `${num(l.capacity_qty)} ${l.capacity_unit || ""}` : "—"}</td><td className="px-4 py-4">{l.temperature_min_c != null || l.temperature_max_c != null ? `${l.temperature_min_c ?? "—"}° / ${l.temperature_max_c ?? "—"}°C` : "—"}</td><td className="px-4 py-4"><Badge v={l.status} /></td><td className="px-4 py-4"><button className={btn} onClick={() => open("location", l)}>Edit</button></td></tr>)}
      </Table>
    </>}

    {tab === "items" && <>
      <div className="mt-5 flex justify-end"><button className={primary} onClick={() => open("item")}>+ New Item</button></div>
      <Table headers={["SKU", "Item", "Category / HS", "Unit", "Customer", "Supplier", "Reorder Point", "Controls", "Status", "Action"]} empty="No inventory items configured.">
        {data.items.map((i: any) => {
          const av = lots.filter((l: any) => l.item_id === i.id).reduce((n: number, l: any) => n + l.available, 0);
          const isLow = Number(i.reorder_point || 0) > 0 && av <= Number(i.reorder_point || 0);
          return <tr key={i.id} className="border-b border-slate-800 hover:bg-slate-900/30"><td className="px-4 py-4 font-mono text-blue-300">{i.sku}</td><td className="px-4 py-4"><b>{i.item_name}</b><div className={`mt-1 text-xs ${isLow ? "text-amber-300" : "text-slate-500"}`}>Avail. {num(av)} {i.base_unit}{isLow ? " · Reorder action" : ""}</div></td><td className="px-4 py-4">{i.category || "—"}<div className="mt-1 text-xs text-slate-500">HS {i.hs_code || "—"}</div></td><td className="px-4 py-4">{i.base_unit}</td><td className="px-4 py-4">{i.customer?.company_name || "—"}</td><td className="px-4 py-4">{i.supplier?.company_name || "—"}</td><td className="px-4 py-4">{num(i.reorder_point)}</td><td className="px-4 py-4 text-xs text-slate-400">{[i.lot_controlled && "LOT", i.serial_controlled && "SERIAL", i.expiry_controlled && "EXPIRY", i.temperature_controlled && "TEMP"].filter(Boolean).join(" · ") || "Standard"}</td><td className="px-4 py-4"><Badge v={i.status} /></td><td className="px-4 py-4"><button className={btn} onClick={() => open("item", i)}>Edit</button></td></tr>;
        })}
      </Table>
    </>}

    {tab === "movements" && <>
      <div className="mt-5 flex items-center justify-between gap-3"><p className="text-xs text-slate-500">Every inventory balance change is recorded here as an auditable transaction.</p><button className={primary} onClick={() => open("movement")}>+ Post Movement</button></div>
      <Table headers={["Movement", "Date", "Type", "Item / Lot", "Quantity", "From", "To", "Reference", "Performed By"]} empty="No stock movements recorded.">
        {data.movements.map((m: any) => <tr key={m.id} className="border-b border-slate-800 hover:bg-slate-900/30"><td className="px-4 py-4 font-mono text-blue-300">{m.movement_no}</td><td className="px-4 py-4">{new Date(m.created_at).toLocaleString()}</td><td className="px-4 py-4"><Badge v={m.movement_type} /></td><td className="px-4 py-4">{m.lot?.item?.item_name || "—"}<div className="mt-1 text-xs text-slate-500">{m.lot?.lot_no || ""}</div></td><td className="px-4 py-4">{num(m.quantity)} {m.unit}</td><td className="px-4 py-4">{m.from_location?.code || "—"}</td><td className="px-4 py-4">{m.to_location?.code || "—"}</td><td className="px-4 py-4">{m.reference_no || "—"}</td><td className="px-4 py-4">{m.performed_by_profile?.full_name || "System user"}</td></tr>)}
      </Table>
    </>}

    {tab === "reservations" && <>
      <div className="mt-5 flex items-center justify-between gap-3"><p className="text-xs text-slate-500">Reservations reduce available stock without changing physical on-hand quantity.</p><button className={primary} onClick={() => open("reservation")}>+ Reserve Stock</button></div>
      <Table headers={["Reservation", "Item / Lot", "Qty", "Customer", "Deal", "Shipment", "Expires", "Status", "Action"]} empty="No inventory reservations recorded.">
        {data.reservations.map((r: any) => <tr key={r.id} className="border-b border-slate-800 hover:bg-slate-900/30"><td className="px-4 py-4 font-mono text-blue-300">{r.reservation_no}</td><td className="px-4 py-4">{r.lot?.item?.item_name || "—"}<div className="mt-1 text-xs text-slate-500">{r.lot?.lot_no || ""}</div></td><td className="px-4 py-4">{num(r.quantity)} {r.unit}</td><td className="px-4 py-4">{r.customer?.company_name || "—"}</td><td className="px-4 py-4">{r.deal?.deal_no || "—"}</td><td className="px-4 py-4">{r.shipment?.shipment_no || "—"}</td><td className="px-4 py-4">{r.expires_at ? new Date(r.expires_at).toLocaleString() : "—"}</td><td className="px-4 py-4"><Badge v={r.status} /></td><td className="px-4 py-4">{r.status === "active" ? <button className={danger} disabled={saving} onClick={async () => { setSaving(true); setError(null); try { await releaseReservation(r.id); setMsg("Reservation released successfully."); await load(); } catch (e: any) { setError(e.message || "Unable to release reservation"); } finally { setSaving(false); } }}>Release</button> : <span className="text-xs text-slate-600">No action</span>}</td></tr>)}
      </Table>
    </>}

    {selectedLot && <LotDrawer lot={selectedLot} onClose={() => setSelectedLotId(null)} onEdit={() => open("lot", selectedLot)} onReceive={() => openMovement(selectedLot, "receipt")} onIssue={() => openMovement(selectedLot, "issue")} onTransfer={() => openMovement(selectedLot, "transfer")} onReserve={() => openReservation(selectedLot)} onQuarantine={() => openMovement(selectedLot, "quarantine")} />}

    {modal && form && <Modal title={modalTitle(modal, form)} subtitle={modalSubtitle(modal)} saving={saving} onClose={() => !saving && setModal(null)} onSave={() => void save()} saveLabel={modal === "receive" ? "Post Receipt" : modal === "movement" ? "Post Movement" : modal === "reservation" ? "Create Reservation" : "Save Changes"}>
      <Fields type={modal} f={form} patch={patch} data={data} lots={lots} />
    </Modal>}
  </main>;
}

function riskScore(v: string) { return v === "expired" ? 5 : v === "exception" ? 4 : v === "expiring" ? 3 : v === "aged" ? 2 : 1; }
function formatLabel(v: any) { return String(v || "—").replaceAll("_", " "); }
function Badge({ v }: { v: any }) { return <span className={`inline-flex h-fit rounded-lg border px-2.5 py-1 text-xs capitalize ${tone(String(v || ""))}`}>{formatLabel(v)}</span>; }
function Stat({ l, v }: { l: string, v: any }) { return <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">{l}</p><b className="mt-1 block">{v}</b></div>; }
function EmptyMini({ text }: { text: string }) { return <p className="rounded-xl border border-dashed border-slate-800 p-5 text-sm text-slate-500">{text}</p>; }
function Metric({ label, value, helper, accent = "default" }: { label: string, value: any, helper: string, accent?: string }) {
  const cls = accent === "red" ? "text-red-300" : accent === "amber" ? "text-amber-300" : accent === "emerald" ? "text-emerald-300" : "text-white";
  return <article className={`${panel} p-4`}><p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-2 text-2xl font-bold ${cls}`}>{num(value)}</p><p className="mt-1 text-[11px] text-slate-600">{helper}</p></article>;
}

function Table({ headers, children, empty }: { headers: string[], children: any, empty: string }) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : children;
  const has = Array.isArray(rows) ? rows.length > 0 : !!rows;
  return <section className={`${panel} mt-5 overflow-hidden`}><div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-left text-sm"><thead className="border-b border-slate-800 bg-slate-950/30 text-[10px] uppercase tracking-wider text-slate-500"><tr>{headers.map(h => <th key={h} className="whitespace-nowrap px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{has ? rows : <tr><td colSpan={headers.length} className="p-10 text-center text-slate-500">{empty}</td></tr>}</tbody></table></div></section>;
}

function Modal({ title, subtitle, saving, onClose, onSave, saveLabel, children }: { title: string, subtitle: string, saving: boolean, onClose: () => void, onSave: () => void, saveLabel: string, children: any }) {
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm md:p-8"><div className="mx-auto max-w-6xl rounded-3xl border border-slate-700 bg-[#0b1120] shadow-2xl shadow-black/50"><div className="flex items-start justify-between gap-4 border-b border-slate-800 p-6"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-blue-400">Inventory Control</p><h2 className="mt-1 text-2xl font-bold">{title}</h2><p className="mt-2 max-w-2xl text-sm text-slate-500">{subtitle}</p></div><button disabled={saving} onClick={onClose} className="rounded-xl border border-slate-800 px-3 py-2 text-xl text-slate-400 transition hover:text-white disabled:opacity-50">×</button></div><div className="p-6">{children}</div><div className="flex flex-col-reverse gap-2 border-t border-slate-800 p-6 sm:flex-row sm:justify-end"><button className={btn} onClick={onClose} disabled={saving}>Cancel</button><button className={primary} onClick={onSave} disabled={saving}>{saving ? "Processing..." : saveLabel}</button></div></div></div>;
}

function LotDrawer({ lot, onClose, onEdit, onReceive, onIssue, onTransfer, onReserve, onQuarantine }: any) {
  const canUse = lot.condition_status === "good" && !["hold", "damaged", "quarantine"].includes(lot.stock_status);
  return <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-slate-700 bg-[#0b1120] p-6 shadow-2xl">
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-blue-400">Lot Control</p><h2 className="mt-1 text-2xl font-bold">{lot.item?.item_name || "Inventory Lot"}</h2><p className="mt-1 text-sm text-slate-500">{lot.item?.sku || "—"} · {lot.lot_no || lot.batch_no || "No lot reference"}</p></div><button className={btn} onClick={onClose}>Close</button></div>
    <div className="mt-6 grid grid-cols-3 gap-3"><Stat l="On Hand" v={`${num(lot.on)} ${lot.unit}`} /><Stat l="Reserved" v={num(lot.reserved)} /><Stat l="Available" v={num(lot.available)} /></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2"><Info l="Warehouse" v={lot.warehouse?.name} /><Info l="Location" v={lot.location?.code} /><Info l="Shipment" v={lot.shipment?.shipment_no} /><Info l="Container" v={lot.container_no} /><Info l="Received" v={lot.received_date} /><Info l="Expiry" v={lot.expiry_date} /><Info l="Condition" v={<Badge v={lot.condition_status} />} /><Info l="Stock Status" v={<Badge v={lot.stock_status} />} /><Info l="Owner" v={lot.owner_name || lot.owner_type} /><Info l="Customs" v={lot.customs_status} /></div>
    <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/50 p-4"><h3 className="font-semibold">Operational Actions</h3><p className="mt-1 text-xs leading-5 text-slate-500">All quantity-changing actions create audited inventory movements. Direct balance editing is disabled.</p><div className="mt-4 grid gap-2 sm:grid-cols-2"><button className={btn} onClick={onReceive}>Receive More</button><button className={btn} onClick={onEdit}>Edit Lot Details</button><button className={primary} disabled={!canUse || lot.available <= 0} onClick={onIssue}>Issue Stock</button><button className={btn} disabled={lot.on <= 0} onClick={onTransfer}>Transfer Location</button><button className={btn} disabled={!canUse || lot.available <= 0} onClick={onReserve}>Reserve Stock</button><button className={danger} disabled={lot.on <= 0 || lot.stock_status === "quarantine"} onClick={onQuarantine}>Quarantine Lot</button></div></div>
  </aside></div>;
}

function Info({ l, v }: { l: string, v: any }) { return <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">{l}</p><div className="mt-1 text-sm text-slate-200">{v || "—"}</div></div>; }
function modalTitle(type: ModalType, form: any) { if (type === "receive") return "Receive Stock"; if (type === "lot") return `Edit Lot ${form?.lot_no || form?.batch_no || "Details"}`; if (type === "movement") return "Post Stock Movement"; if (type === "reservation") return "Create Stock Reservation"; if (type === "warehouse") return form?.id ? "Edit Warehouse" : "Create Warehouse"; if (type === "location") return form?.id ? "Edit Warehouse Location" : "Create Warehouse Location"; if (type === "item") return form?.id ? "Edit Item Master" : "Create Item Master"; return "Inventory Record"; }
function modalSubtitle(type: ModalType) { if (type === "receive") return "Creates a new inventory lot and posts the initial receipt movement in one controlled transaction."; if (type === "lot") return "Update descriptive lot information only. On-hand and reserved balances are controlled by movement and reservation workflows."; if (type === "movement") return "Post a physical inventory event. The resulting balance adjustment is recorded in the movement audit trail."; if (type === "reservation") return "Commit available stock to a customer, deal or shipment without reducing physical on-hand quantity."; if (type === "warehouse") return "Maintain the warehouse master record used by stock and location controls."; if (type === "location") return "Configure a physical storage position and its operational availability."; if (type === "item") return "Maintain SKU controls, ownership links and replenishment thresholds."; return ""; }

function F({ label, value, onChange, type = "text", disabled = false, hint, min }: { label: string, value: any, onChange: (v: any) => void, type?: string, disabled?: boolean, hint?: string, min?: number }) {
  if (type === "checkbox") return <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-300"><input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} disabled={disabled} />{label}</label>;
  return <label className="text-xs text-slate-400">{label}<input type={type} min={min} value={value ?? ""} onChange={e => onChange(e.target.value)} disabled={disabled} className={`${input} mt-2`} />{hint && <span className="mt-1 block text-[10px] leading-4 text-slate-600">{hint}</span>}</label>;
}
function T({ label, value, onChange, disabled = false }: { label: string, value: any, onChange: (v: any) => void, disabled?: boolean }) { return <label className="text-xs text-slate-400">{label}<textarea rows={3} value={value ?? ""} onChange={e => onChange(e.target.value)} disabled={disabled} className={`${input} mt-2 resize-y`} /></label>; }
function S({ label, value, onChange, children, disabled = false }: { label: string, value: any, onChange: (v: string) => void, children: any, disabled?: boolean }) { return <label className="text-xs text-slate-400">{label}<select value={value ?? ""} onChange={e => onChange(e.target.value)} disabled={disabled} className={`${input} mt-2`}>{children}</select></label>; }
function SectionTitle({ title, text }: { title: string, text?: string }) { return <div className="md:col-span-2 xl:col-span-3"><h3 className="text-sm font-semibold text-slate-200">{title}</h3>{text && <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>}</div>; }

function Fields({ type, f, patch, data, lots }: { type: ModalType, f: any, patch: (k: string, v: any) => void, data: Workspace, lots: any[] }) {
  const g = "grid gap-4 md:grid-cols-2 xl:grid-cols-3";
  if (type === "warehouse") return <div className={g}><SectionTitle title="Warehouse Identity" /><F label="Code *" value={f.code} onChange={v => patch("code", v.toUpperCase())} /><F label="Name *" value={f.name} onChange={v => patch("name", v)} /><S label="Type" value={f.warehouse_type} onChange={v => patch("warehouse_type", v)}><option value="general">General</option><option value="bonded">Bonded</option><option value="cold_storage">Cold Storage</option><option value="open_yard">Open Yard</option></S><F label="Country" value={f.country} onChange={v => patch("country", v)} /><F label="City" value={f.city} onChange={v => patch("city", v)} /><F label="Address" value={f.address} onChange={v => patch("address", v)} /><SectionTitle title="Operations" /><F label="Operator" value={f.operator_name} onChange={v => patch("operator_name", v)} /><F label="Contact Person" value={f.contact_person} onChange={v => patch("contact_person", v)} /><F label="Phone" value={f.phone} onChange={v => patch("phone", v)} /><S label="Status" value={f.status} onChange={v => patch("status", v)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="blocked">Blocked</option></S><F label="Temperature Controlled" value={f.temperature_controlled} onChange={v => patch("temperature_controlled", v)} type="checkbox" /><div className="md:col-span-2 xl:col-span-3"><T label="Notes" value={f.notes} onChange={v => patch("notes", v)} /></div></div>;

  if (type === "location") return <div className={g}><SectionTitle title="Storage Location" /><S label="Warehouse *" value={f.warehouse_id} onChange={v => patch("warehouse_id", v)}><option value="">Select warehouse</option>{data.warehouses.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</S><F label="Code *" value={f.code} onChange={v => patch("code", v.toUpperCase())} /><S label="Location Type" value={f.location_type} onChange={v => patch("location_type", v)}><option value="storage">Storage</option><option value="receiving">Receiving</option><option value="dispatch">Dispatch</option><option value="quarantine">Quarantine</option><option value="staging">Staging</option></S><F label="Zone" value={f.zone} onChange={v => patch("zone", v)} /><F label="Aisle" value={f.aisle} onChange={v => patch("aisle", v)} /><F label="Rack" value={f.rack} onChange={v => patch("rack", v)} /><F label="Bin" value={f.bin} onChange={v => patch("bin", v)} /><SectionTitle title="Capacity & Control" /><F label="Capacity" value={f.capacity_qty} onChange={v => patch("capacity_qty", v)} type="number" min={0} /><F label="Capacity Unit" value={f.capacity_unit} onChange={v => patch("capacity_unit", v)} /><S label="Status" value={f.status} onChange={v => patch("status", v)}><option value="available">Available</option><option value="occupied">Occupied</option><option value="hold">Hold</option><option value="blocked">Blocked</option></S><F label="Temperature Min °C" value={f.temperature_min_c} onChange={v => patch("temperature_min_c", v)} type="number" /><F label="Temperature Max °C" value={f.temperature_max_c} onChange={v => patch("temperature_max_c", v)} type="number" /><div className="md:col-span-2 xl:col-span-3"><T label="Notes" value={f.notes} onChange={v => patch("notes", v)} /></div></div>;

  if (type === "item") return <div className={g}><SectionTitle title="Item Identity" /><F label="SKU *" value={f.sku} onChange={v => patch("sku", v.toUpperCase())} /><F label="Item Name *" value={f.item_name} onChange={v => patch("item_name", v)} /><F label="Category" value={f.category} onChange={v => patch("category", v)} /><F label="HS Code" value={f.hs_code} onChange={v => patch("hs_code", v)} /><F label="Base Unit" value={f.base_unit} onChange={v => patch("base_unit", v.toUpperCase())} /><S label="Status" value={f.status} onChange={v => patch("status", v)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="blocked">Blocked</option></S><div className="md:col-span-2 xl:col-span-3"><T label="Description" value={f.description} onChange={v => patch("description", v)} /></div><SectionTitle title="Replenishment & Ownership" /><F label="Minimum Stock" value={f.min_stock} onChange={v => patch("min_stock", v)} type="number" min={0} /><F label="Reorder Point" value={f.reorder_point} onChange={v => patch("reorder_point", v)} type="number" min={0} /><S label="Customer" value={f.customer_id} onChange={v => patch("customer_id", v)}><option value="">Not linked</option>{data.customers.map((x: any) => <option key={x.id} value={x.id}>{x.company_name}</option>)}</S><S label="Supplier" value={f.supplier_id} onChange={v => patch("supplier_id", v)}><option value="">Not linked</option>{data.suppliers.map((x: any) => <option key={x.id} value={x.id}>{x.company_name}</option>)}</S><SectionTitle title="Inventory Controls" text="Controls are enforced by the receiving workflow where applicable." /><F label="Lot Controlled" value={f.lot_controlled} onChange={v => patch("lot_controlled", v)} type="checkbox" /><F label="Serial Controlled" value={f.serial_controlled} onChange={v => patch("serial_controlled", v)} type="checkbox" /><F label="Expiry Controlled" value={f.expiry_controlled} onChange={v => patch("expiry_controlled", v)} type="checkbox" /><F label="Temperature Controlled" value={f.temperature_controlled} onChange={v => patch("temperature_controlled", v)} type="checkbox" /><div className="md:col-span-2 xl:col-span-3"><T label="Notes" value={f.notes} onChange={v => patch("notes", v)} /></div></div>;

  if (type === "receive") {
    const item = data.items.find((x: any) => x.id === f.item_id);
    const locations = data.locations.filter((x: any) => (!f.warehouse_id || x.warehouse_id === f.warehouse_id) && !["hold", "blocked"].includes(x.status));
    return <div className={g}><SectionTitle title="Receipt Source" text="The initial quantity will be posted as an audited Receipt movement." /><S label="Item *" value={f.item_id} onChange={v => { patch("item_id", v); const i = data.items.find((x: any) => x.id === v); if (i) patch("unit", i.base_unit || "KG"); }}><option value="">Select item</option>{data.items.filter((x: any) => x.status === "active").map((x: any) => <option key={x.id} value={x.id}>{x.sku} · {x.item_name}</option>)}</S><S label="Warehouse *" value={f.warehouse_id} onChange={v => { patch("warehouse_id", v); patch("location_id", ""); }}><option value="">Select warehouse</option>{data.warehouses.filter((x: any) => x.status === "active").map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</S><S label="Location" value={f.location_id} onChange={v => patch("location_id", v)}><option value="">Unassigned</option>{locations.map((x: any) => <option key={x.id} value={x.id}>{x.code} · {formatLabel(x.location_type)}</option>)}</S><S label="Inbound Shipment" value={f.shipment_id} onChange={v => patch("shipment_id", v)}><option value="">Not linked</option>{data.shipments.map((x: any) => <option key={x.id} value={x.id}>{x.shipment_no}</option>)}</S><F label="Received Quantity *" value={f.qty_on_hand} onChange={v => patch("qty_on_hand", v)} type="number" min={0} /><F label="Unit" value={f.unit} onChange={v => patch("unit", v.toUpperCase())} /><SectionTitle title="Traceability" /><F label="Lot No." value={f.lot_no} onChange={v => patch("lot_no", v)} hint={item?.lot_controlled ? "Lot reference recommended for this controlled item." : undefined} /><F label="Batch No." value={f.batch_no} onChange={v => patch("batch_no", v)} /><F label={`Serial No.${item?.serial_controlled ? " *" : ""}`} value={f.serial_no} onChange={v => patch("serial_no", v)} /><F label="Container No." value={f.container_no} onChange={v => patch("container_no", v.toUpperCase())} /><F label="Package Ref." value={f.package_ref} onChange={v => patch("package_ref", v)} /><F label="Received Date" value={f.received_date} onChange={v => patch("received_date", v)} type="date" /><F label="Production Date" value={f.production_date} onChange={v => patch("production_date", v)} type="date" /><F label={`Expiry Date${item?.expiry_controlled ? " *" : ""}`} value={f.expiry_date} onChange={v => patch("expiry_date", v)} type="date" /><SectionTitle title="Cargo & Compliance" /><F label="Gross Weight KG" value={f.gross_weight_kg} onChange={v => patch("gross_weight_kg", v)} type="number" min={0} /><F label="Net Weight KG" value={f.net_weight_kg} onChange={v => patch("net_weight_kg", v)} type="number" min={0} /><F label="Volume CBM" value={f.volume_cbm} onChange={v => patch("volume_cbm", v)} type="number" min={0} /><S label="Condition" value={f.condition_status} onChange={v => patch("condition_status", v)}><option value="good">Good</option><option value="damaged">Damaged</option><option value="quarantine">Quarantine</option><option value="rejected">Rejected</option></S><S label="Stock Status" value={f.stock_status} onChange={v => patch("stock_status", v)}><option value="available">Available</option><option value="hold">Hold</option><option value="quarantine">Quarantine</option><option value="damaged">Damaged</option></S><F label="Customs Status" value={f.customs_status} onChange={v => patch("customs_status", v)} /><F label="Owner Name" value={f.owner_name} onChange={v => patch("owner_name", v)} /><div className="md:col-span-2 xl:col-span-3"><T label="Receipt Notes" value={f.notes} onChange={v => patch("notes", v)} /></div></div>;
  }

  if (type === "lot") return <div className={g}><SectionTitle title="Protected Inventory Balance" text="Balances are read-only here. Use Receive, Issue, Transfer, Adjustment, Reservation or Release workflows to change stock." /><F label="On Hand" value={f.qty_on_hand} onChange={() => {}} disabled /><F label="Reserved" value={f.qty_reserved} onChange={() => {}} disabled /><F label="Available" value={Number(f.qty_on_hand || 0) - Number(f.qty_reserved || 0)} onChange={() => {}} disabled /><SectionTitle title="Lot Details" /><S label="Item *" value={f.item_id} onChange={v => patch("item_id", v)}><option value="">Select item</option>{data.items.map((x: any) => <option key={x.id} value={x.id}>{x.sku} · {x.item_name}</option>)}</S><S label="Warehouse *" value={f.warehouse_id} onChange={v => { patch("warehouse_id", v); patch("location_id", ""); }}><option value="">Select warehouse</option>{data.warehouses.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</S><S label="Location" value={f.location_id} onChange={v => patch("location_id", v)}><option value="">Unassigned</option>{data.locations.filter((x: any) => !f.warehouse_id || x.warehouse_id === f.warehouse_id).map((x: any) => <option key={x.id} value={x.id}>{x.code}</option>)}</S><S label="Inbound Shipment" value={f.shipment_id} onChange={v => patch("shipment_id", v)}><option value="">Not linked</option>{data.shipments.map((x: any) => <option key={x.id} value={x.id}>{x.shipment_no}</option>)}</S><F label="Lot No." value={f.lot_no} onChange={v => patch("lot_no", v)} /><F label="Batch No." value={f.batch_no} onChange={v => patch("batch_no", v)} /><F label="Serial No." value={f.serial_no} onChange={v => patch("serial_no", v)} /><F label="Container No." value={f.container_no} onChange={v => patch("container_no", v)} /><F label="Package Ref." value={f.package_ref} onChange={v => patch("package_ref", v)} /><F label="Received Date" value={f.received_date} onChange={v => patch("received_date", v)} type="date" /><F label="Production Date" value={f.production_date} onChange={v => patch("production_date", v)} type="date" /><F label="Expiry Date" value={f.expiry_date} onChange={v => patch("expiry_date", v)} type="date" /><SectionTitle title="Cargo & Compliance" /><F label="Gross Weight KG" value={f.gross_weight_kg} onChange={v => patch("gross_weight_kg", v)} type="number" min={0} /><F label="Net Weight KG" value={f.net_weight_kg} onChange={v => patch("net_weight_kg", v)} type="number" min={0} /><F label="Volume CBM" value={f.volume_cbm} onChange={v => patch("volume_cbm", v)} type="number" min={0} /><S label="Condition" value={f.condition_status} onChange={v => patch("condition_status", v)}><option value="good">Good</option><option value="damaged">Damaged</option><option value="quarantine">Quarantine</option><option value="rejected">Rejected</option><option value="expired">Expired</option></S><S label="Stock Status" value={f.stock_status} onChange={v => patch("stock_status", v)}><option value="available">Available</option><option value="reserved">Reserved</option><option value="hold">Hold</option><option value="in_transit">In Transit</option><option value="damaged">Damaged</option><option value="quarantine">Quarantine</option></S><F label="Owner Name" value={f.owner_name} onChange={v => patch("owner_name", v)} /><F label="Customs Status" value={f.customs_status} onChange={v => patch("customs_status", v)} /><div className="md:col-span-2 xl:col-span-3"><T label="Notes" value={f.notes} onChange={v => patch("notes", v)} /></div></div>;

  if (type === "movement") {
    const lot = lots.find((x: any) => x.id === f.lot_id);
    const destinations = data.locations.filter((x: any) => !lot || (x.warehouse_id === lot.warehouse_id && !["hold", "blocked"].includes(x.status) && x.id !== lot.location_id));
    const quarantine = f.movement_type === "quarantine";
    return <div className={g}><SectionTitle title="Movement Transaction" text={lot ? `Current balance: ${num(lot.on)} ${lot.unit} on hand · ${num(lot.available)} ${lot.unit} available.` : "Select a lot to continue."} /><S label="Movement Type" value={f.movement_type} onChange={v => { patch("movement_type", v); if (v === "quarantine" && lot) patch("quantity", lot.on); }}><option value="receipt">Receive More</option><option value="issue">Issue Stock</option><option value="transfer">Transfer Location</option><option value="adjustment">Set On-Hand Balance</option><option value="damage">Record Damage / Reduce</option><option value="quarantine">Quarantine Complete Lot</option></S><S label="Lot *" value={f.lot_id} onChange={v => { patch("lot_id", v); const l = lots.find((x: any) => x.id === v); if (l) { patch("unit", l.unit); patch("from_location_id", l.location_id || ""); if (f.movement_type === "quarantine") patch("quantity", l.on); } }}><option value="">Select lot</option>{lots.map((l: any) => <option key={l.id} value={l.id}>{l.item?.sku} · {l.lot_no || l.batch_no || "No lot"} · Avail {num(l.available)}</option>)}</S><F label={f.movement_type === "adjustment" ? "New On-Hand Balance *" : "Quantity *"} value={f.quantity} onChange={v => patch("quantity", v)} type="number" min={0} disabled={quarantine} /><F label="Unit" value={f.unit} onChange={v => patch("unit", v)} disabled /><S label="From Location" value={f.from_location_id} onChange={v => patch("from_location_id", v)} disabled={f.movement_type !== "transfer"}><option value="">Not set</option>{data.locations.map((x: any) => <option key={x.id} value={x.id}>{x.warehouse?.name} · {x.code}</option>)}</S><S label="To Location" value={f.to_location_id} onChange={v => patch("to_location_id", v)} disabled={f.movement_type !== "transfer"}><option value="">Select destination</option>{destinations.map((x: any) => <option key={x.id} value={x.id}>{x.warehouse?.name} · {x.code}</option>)}</S><F label="Reference No." value={f.reference_no} onChange={v => patch("reference_no", v)} /><S label="Performed By" value={f.performed_by} onChange={v => patch("performed_by", v)}><option value="">Current signed-in user</option>{data.profiles.map((x: any) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</S><div className="md:col-span-2 xl:col-span-3"><T label={["adjustment", "damage", "quarantine"].includes(f.movement_type) ? "Reason *" : "Reason / Operational Note"} value={f.reason} onChange={v => patch("reason", v)} /></div></div>;
  }

  if (type === "reservation") return <div className={g}><SectionTitle title="Reservation Allocation" text="Only healthy available stock can be reserved. The physical on-hand quantity is not reduced." /><S label="Lot *" value={f.lot_id} onChange={v => { patch("lot_id", v); const l = lots.find((x: any) => x.id === v); if (l) patch("unit", l.unit); }}><option value="">Select lot</option>{lots.filter((l: any) => l.available > 0 && l.condition_status === "good" && !["hold", "damaged", "quarantine"].includes(l.stock_status)).map((l: any) => <option key={l.id} value={l.id}>{l.item?.sku} · {l.lot_no || l.batch_no || "No lot"} · Avail {num(l.available)}</option>)}</S><F label="Quantity *" value={f.quantity} onChange={v => patch("quantity", v)} type="number" min={0} /><F label="Unit" value={f.unit} onChange={v => patch("unit", v)} disabled /><S label="Customer" value={f.customer_id} onChange={v => patch("customer_id", v)}><option value="">Not linked</option>{data.customers.map((x: any) => <option key={x.id} value={x.id}>{x.company_name}</option>)}</S><S label="Deal" value={f.deal_id} onChange={v => patch("deal_id", v)}><option value="">Not linked</option>{data.deals.map((x: any) => <option key={x.id} value={x.id}>{x.deal_no}</option>)}</S><S label="Shipment" value={f.shipment_id} onChange={v => patch("shipment_id", v)}><option value="">Not linked</option>{data.shipments.map((x: any) => <option key={x.id} value={x.id}>{x.shipment_no}</option>)}</S><S label="Reserved By" value={f.reserved_by} onChange={v => patch("reserved_by", v)}><option value="">Current signed-in user</option>{data.profiles.map((x: any) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</S><F label="Expires At" value={f.expires_at} onChange={v => patch("expires_at", v)} type="datetime-local" /><div className="md:col-span-2 xl:col-span-3"><T label="Reservation Notes" value={f.notes} onChange={v => patch("notes", v)} /></div></div>;

  return null;
}
