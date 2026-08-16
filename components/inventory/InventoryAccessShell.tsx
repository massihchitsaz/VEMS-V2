"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { getInventoryAccess, getInventoryWorkspace, InventoryAccess } from "@/lib/inventory-workspace";

const panel = "rounded-2xl border border-slate-800 bg-[#0d1423]";
const input = "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";
const btn = "rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-blue-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
const num = (v: unknown) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

export function InventoryAccessShell({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<InventoryAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAccess = async () => {
    setLoading(true);
    setError(null);
    try {
      setAccess(await getInventoryAccess());
    } catch (e: any) {
      setError(e.message || "Unable to verify inventory access.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadAccess(); }, []);

  if (loading) return <InventoryLoading />;
  if (error || !access) return <section className="p-5 text-white md:p-8"><div className={`${panel} p-6`}><p className="text-xs font-semibold uppercase tracking-[.18em] text-red-300">Inventory Access</p><h1 className="mt-2 text-xl font-bold">Unable to verify your access</h1><p className="mt-2 text-sm text-slate-400">{error || "Your inventory access could not be resolved."}</p><button className={`${btn} mt-4`} onClick={() => void loadAccess()}>Retry Access Check</button></div></section>;

  if (!access.canWrite) return <InventoryReadOnlyDashboard access={access} />;

  return <>
    <section className="px-5 pt-5 text-white md:px-8 md:pt-8">
      <div className="flex flex-col gap-3 rounded-2xl border border-emerald-900/60 bg-emerald-950/15 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-emerald-300">Operational Access Verified</p><p className="mt-1 text-sm text-slate-300">Role <b className="text-white">{formatRole(access.role)}</b> · Inventory write workflows enabled · Database RLS enforced</p></div>
        <span className="w-fit rounded-lg border border-emerald-800 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-300">PRODUCTION ACCESS</span>
      </div>
    </section>
    {children}
  </>;
}

function InventoryReadOnlyDashboard({ access }: { access: InventoryAccess }) {
  const [data, setData] = useState<any>({ warehouses: [], lots: [], reservations: [], items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState("all");

  const load = async () => {
    setLoading(true); setError(null);
    try { setData(await getInventoryWorkspace()); }
    catch (e: any) { setError(e.message || "Unable to load inventory."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const lots = useMemo(() => (data.lots || []).map((lot: any) => ({ ...lot, on: Number(lot.qty_on_hand || 0), reserved: Number(lot.qty_reserved || 0), available: Number(lot.qty_on_hand || 0) - Number(lot.qty_reserved || 0) })), [data.lots]);
  const filtered = useMemo(() => lots.filter((lot: any) => {
    const hay = [lot.item?.sku, lot.item?.item_name, lot.lot_no, lot.batch_no, lot.serial_no, lot.container_no, lot.warehouse?.name, lot.location?.code, lot.shipment?.shipment_no, lot.owner_name].filter(Boolean).join(" ").toLowerCase();
    return (warehouseId === "all" || lot.warehouse_id === warehouseId) && (!search || hay.includes(search.toLowerCase()));
  }), [lots, warehouseId, search]);
  const metrics = useMemo(() => ({
    on: lots.reduce((n: number, l: any) => n + l.on, 0),
    reserved: lots.reduce((n: number, l: any) => n + l.reserved, 0),
    available: lots.reduce((n: number, l: any) => n + l.available, 0),
    exceptions: lots.filter((l: any) => l.condition_status !== "good" || ["hold", "damaged", "quarantine"].includes(l.stock_status)).length,
  }), [lots]);

  return <main className="p-5 text-white md:p-8">
    <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[.22em] text-blue-400">VTC ONE · Inventory</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Inventory & Warehouse Visibility</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Read-only operational visibility across warehouses, stock balances, reservations and inventory exceptions.</p></div>
      <div className="flex flex-wrap items-center gap-2"><span className="rounded-xl border border-amber-800 bg-amber-950/30 px-4 py-2.5 text-sm text-amber-300">{formatRole(access.role)} · Read Only</span><button className={btn} onClick={() => void load()} disabled={loading}>{loading ? "Refreshing..." : "Refresh Inventory"}</button></div>
    </header>

    <div className="mt-5 rounded-2xl border border-amber-900/60 bg-amber-950/15 p-4 text-sm leading-6 text-amber-200">Your role can review inventory data but cannot receive, transfer, reserve, adjust, hold, damage, fulfill or edit warehouse master records. Write access is controlled by database RLS, not by hidden buttons.</div>
    {error && <div className="mt-4 rounded-xl border border-red-900 bg-red-950/30 p-4 text-sm text-red-300">{error}</div>}

    <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="On Hand" value={num(metrics.on)} />
      <Metric label="Reserved" value={num(metrics.reserved)} />
      <Metric label="Available" value={num(metrics.available)} accent />
      <Metric label="Exceptions" value={num(metrics.exceptions)} warning={metrics.exceptions > 0} />
    </section>

    <section className={`${panel} mt-6 p-4`}>
      <div className="grid gap-3 lg:grid-cols-[1fr_280px_auto]">
        <input className={input} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search SKU, item, lot, batch, container, shipment or owner..." />
        <select className={input} value={warehouseId} onChange={e => setWarehouseId(e.target.value)}><option value="all">All Warehouses</option>{(data.warehouses || []).map((w: any) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select>
        <button className={btn} disabled={!search && warehouseId === "all"} onClick={() => { setSearch(""); setWarehouseId("all"); }}>Clear Filters</button>
      </div>
      <p className="mt-3 text-xs text-slate-500">Showing {filtered.length} of {lots.length} stock lots</p>
    </section>

    <section className={`${panel} mt-5 overflow-hidden`}>
      <div className="overflow-x-auto"><table className="w-full min-w-[1150px] text-sm"><thead className="bg-slate-950/40 text-left text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Item / SKU</th><th>Lot / Batch</th><th>Warehouse / Location</th><th>Shipment</th><th>On Hand</th><th>Reserved</th><th>Available</th><th>Condition</th><th>Status</th><th>Expiry</th></tr></thead><tbody>{filtered.map((lot: any) => <tr key={lot.id} className="border-t border-slate-800"><td className="px-4 py-4"><b>{lot.item?.item_name || "Unnamed item"}</b><p className="mt-1 text-xs text-slate-500">{lot.item?.sku || "—"}</p></td><td>{lot.lot_no || "—"}<p className="mt-1 text-xs text-slate-500">{lot.batch_no || lot.serial_no || ""}</p></td><td>{lot.warehouse?.name || "—"}<p className="mt-1 text-xs text-slate-500">{lot.location?.code || "Unassigned"}</p></td><td>{lot.shipment?.shipment_no || "—"}</td><td>{num(lot.on)} {lot.unit}</td><td>{num(lot.reserved)}</td><td className="font-semibold text-emerald-300">{num(lot.available)}</td><td>{lot.condition_status || "—"}</td><td>{lot.stock_status || "—"}</td><td>{lot.expiry_date || "—"}</td></tr>)}{!filtered.length && <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500">No stock matches the current filters.</td></tr>}</tbody></table></div>
    </section>
  </main>;
}

function InventoryLoading() {
  return <main className="p-5 text-white md:p-8"><div className="animate-pulse space-y-4"><div className="h-8 w-72 rounded bg-slate-800"/><div className="h-4 w-full max-w-2xl rounded bg-slate-900"/><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map(i => <div key={i} className="h-24 rounded-2xl border border-slate-800 bg-[#0d1423]"/>)}</div><div className="h-72 rounded-2xl border border-slate-800 bg-[#0d1423]"/></div></main>;
}

function Metric({ label, value, accent = false, warning = false }: any) {
  return <div className={`${panel} p-4`}><p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-2 text-2xl font-bold ${warning ? "text-amber-300" : accent ? "text-emerald-300" : "text-white"}`}>{value}</p></div>;
}
function formatRole(role: string) { return role ? role.replace(/_/g, " ").replace(/\b\w/g, x => x.toUpperCase()) : "Authenticated"; }
