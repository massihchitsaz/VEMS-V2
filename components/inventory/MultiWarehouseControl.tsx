"use client";

import { useEffect, useMemo, useState } from "react";
import { addMovement, getInventoryWorkspace } from "@/lib/inventory-workspace";

const panel = "rounded-2xl border border-slate-800 bg-[#0d1423]";
const input = "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60";
const btn = "rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-blue-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
const primary = "rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";
const num = (v: unknown) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

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

type TransferForm = {
  source_warehouse_id: string;
  lot_id: string;
  destination_warehouse_id: string;
  to_location_id: string;
  quantity: string;
  reference_no: string;
  reason: string;
  performed_by: string;
};

const blankTransfer: TransferForm = {
  source_warehouse_id: "",
  lot_id: "",
  destination_warehouse_id: "",
  to_location_id: "",
  quantity: "",
  reference_no: "",
  reason: "Inter-warehouse transfer",
  performed_by: "",
};

export function MultiWarehouseControl() {
  const [data, setData] = useState<Workspace>({ warehouses: [], locations: [], items: [], lots: [], movements: [], reservations: [], customers: [], profiles: [], shipments: [], deals: [], suppliers: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TransferForm>(blankTransfer);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getInventoryWorkspace());
    } catch (e: any) {
      setError(e.message || "Unable to load warehouse data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const activeWarehouses = useMemo(() => data.warehouses.filter((w: any) => w.status === "active"), [data.warehouses]);
  const enrichedLots = useMemo(() => data.lots.map((lot: any) => {
    const on = Number(lot.qty_on_hand || 0);
    const reserved = Number(lot.qty_reserved || 0);
    return { ...lot, on, reserved, available: on - reserved };
  }), [data.lots]);

  const warehouseStats = useMemo(() => activeWarehouses.map((warehouse: any) => {
    const lots = enrichedLots.filter((lot: any) => lot.warehouse_id === warehouse.id);
    const locations = data.locations.filter((location: any) => location.warehouse_id === warehouse.id);
    return {
      ...warehouse,
      lotCount: lots.length,
      onHand: lots.reduce((n: number, lot: any) => n + lot.on, 0),
      reserved: lots.reduce((n: number, lot: any) => n + lot.reserved, 0),
      available: lots.reduce((n: number, lot: any) => n + lot.available, 0),
      locations: locations.length,
      operationalLocations: locations.filter((location: any) => ["available", "occupied"].includes(location.status)).length,
    };
  }), [activeWarehouses, enrichedLots, data.locations]);

  const consolidated = useMemo(() => warehouseStats.reduce((acc, warehouse) => ({
    onHand: acc.onHand + warehouse.onHand,
    reserved: acc.reserved + warehouse.reserved,
    available: acc.available + warehouse.available,
  }), { onHand: 0, reserved: 0, available: 0 }), [warehouseStats]);

  const sourceLots = useMemo(() => enrichedLots.filter((lot: any) =>
    lot.warehouse_id === form.source_warehouse_id &&
    lot.available > 0 &&
    lot.condition_status === "good" &&
    !["hold", "damaged", "quarantine"].includes(lot.stock_status)
  ), [enrichedLots, form.source_warehouse_id]);

  const selectedLot = useMemo(() => enrichedLots.find((lot: any) => lot.id === form.lot_id) || null, [enrichedLots, form.lot_id]);
  const destinationLocations = useMemo(() => data.locations.filter((location: any) =>
    location.warehouse_id === form.destination_warehouse_id &&
    ["available", "occupied"].includes(location.status) &&
    location.id !== selectedLot?.location_id
  ), [data.locations, form.destination_warehouse_id, selectedLot]);

  const patch = (key: keyof TransferForm, value: string) => setForm(current => ({ ...current, [key]: value }));

  const startTransfer = () => {
    setError(null);
    setMessage(null);
    setForm(blankTransfer);
    setOpen(true);
  };

  const submitTransfer = async () => {
    setError(null);
    const qty = Number(form.quantity || 0);
    if (!form.source_warehouse_id) return setError("Source warehouse is required.");
    if (!form.lot_id || !selectedLot) return setError("Select an inventory lot to transfer.");
    if (!form.destination_warehouse_id) return setError("Destination warehouse is required.");
    if (form.destination_warehouse_id === form.source_warehouse_id) return setError("For inter-warehouse transfer, destination warehouse must be different from source warehouse.");
    if (!form.to_location_id) return setError("Destination location is required.");
    if (qty <= 0) return setError("Transfer quantity must be greater than zero.");
    if (qty > selectedLot.available) return setError(`Maximum transferable quantity is ${num(selectedLot.available)} ${selectedLot.unit}.`);
    if (!form.reason.trim()) return setError("Operational reason is required for an inter-warehouse transfer.");

    setSaving(true);
    try {
      await addMovement({
        movement_type: "transfer",
        lot_id: selectedLot.id,
        quantity: qty,
        unit: selectedLot.unit,
        from_location_id: selectedLot.location_id || null,
        to_location_id: form.to_location_id,
        reference_no: form.reference_no || null,
        reason: form.reason,
        performed_by: form.performed_by || null,
      });
      setMessage(`Transfer posted from ${selectedLot.warehouse?.name || "source warehouse"} to ${data.warehouses.find((w: any) => w.id === form.destination_warehouse_id)?.name || "destination warehouse"}.`);
      setOpen(false);
      setForm(blankTransfer);
      await load();
    } catch (e: any) {
      setError(e.message || "Unable to post inter-warehouse transfer");
    } finally {
      setSaving(false);
    }
  };

  return <section className="px-5 pt-5 text-white md:px-8 md:pt-8">
    <div className={`${panel} overflow-hidden`}>
      <div className="border-b border-slate-800 bg-gradient-to-r from-blue-950/40 via-slate-950/20 to-cyan-950/20 p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-blue-900 bg-blue-950/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.18em] text-blue-300">Multi-Warehouse</span>
              <span className="text-xs text-slate-500">{activeWarehouses.length} active warehouse{activeWarehouses.length === 1 ? "" : "s"}</span>
            </div>
            <h2 className="mt-2 text-xl font-bold tracking-tight">Warehouse Network Control</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">Consolidated stock visibility across all VTC warehouses with controlled inter-warehouse transfers and location-level execution.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={btn} onClick={() => void load()} disabled={loading}>{loading ? "Refreshing..." : "Refresh Network"}</button>
            <button className={primary} onClick={startTransfer} disabled={activeWarehouses.length < 2}>Inter-Warehouse Transfer</button>
          </div>
        </div>
      </div>

      {error && <div className="mx-5 mt-5 flex items-start justify-between gap-3 rounded-xl border border-red-900 bg-red-950/30 p-4 text-sm text-red-300"><span>{error}</span><button onClick={() => setError(null)}>×</button></div>}
      {message && <div className="mx-5 mt-5 flex items-start justify-between gap-3 rounded-xl border border-emerald-900 bg-emerald-950/30 p-4 text-sm text-emerald-300"><span>{message}</span><button onClick={() => setMessage(null)}>×</button></div>}

      <div className="grid gap-px border-b border-slate-800 bg-slate-800 sm:grid-cols-3">
        <NetworkMetric label="Consolidated On Hand" value={consolidated.onHand} />
        <NetworkMetric label="Consolidated Reserved" value={consolidated.reserved} />
        <NetworkMetric label="Consolidated Available" value={consolidated.available} accent />
      </div>

      <div className="p-5 md:p-6">
        {warehouseStats.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">No active warehouses are configured. Create warehouses in the Warehouse section below before receiving stock.</div> : <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {warehouseStats.map((warehouse: any) => <article key={warehouse.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-blue-400">{warehouse.code}</p><h3 className="mt-1 font-semibold">{warehouse.name}</h3><p className="mt-1 text-xs text-slate-500">{[warehouse.city, warehouse.country].filter(Boolean).join(", ") || "Location not set"}</p></div>
              <span className="rounded-lg border border-emerald-900 bg-emerald-950/30 px-2.5 py-1 text-xs text-emerald-300">Active</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniMetric label="On Hand" value={warehouse.onHand} />
              <MiniMetric label="Reserved" value={warehouse.reserved} />
              <MiniMetric label="Available" value={warehouse.available} accent />
              <MiniMetric label="Lots" value={warehouse.lotCount} />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-4 text-xs text-slate-500"><span>{warehouse.operationalLocations}/{warehouse.locations} operational locations</span><span>{warehouse.temperature_controlled ? "Temperature controlled" : "Standard storage"}</span></div>
          </article>)}
        </div>}
      </div>
    </div>

    {open && <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/80 p-4 backdrop-blur-sm md:p-8">
      <div className="mx-auto max-w-5xl rounded-3xl border border-slate-700 bg-[#0b1120] shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-6">
          <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-blue-400">Warehouse Network</p><h2 className="mt-1 text-2xl font-bold">Inter-Warehouse Transfer</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Move an existing lot between different warehouses. The destination warehouse and storage location are selected explicitly and the movement is recorded in the inventory audit trail.</p></div>
          <button className={btn} disabled={saving} onClick={() => setOpen(false)}>Close</button>
        </div>

        <div className="p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FieldLabel label="Source Warehouse *"><select className={input} value={form.source_warehouse_id} onChange={e => { const value = e.target.value; setForm(current => ({ ...current, source_warehouse_id: value, lot_id: "", quantity: "", destination_warehouse_id: current.destination_warehouse_id === value ? "" : current.destination_warehouse_id, to_location_id: "" })); }}><option value="">Select source warehouse</option>{activeWarehouses.map((w: any) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></FieldLabel>
            <FieldLabel label="Inventory Lot *"><select className={input} value={form.lot_id} disabled={!form.source_warehouse_id} onChange={e => { const value = e.target.value; const lot = enrichedLots.find((x: any) => x.id === value); setForm(current => ({ ...current, lot_id: value, quantity: lot ? String(lot.available) : "" })); }}><option value="">{form.source_warehouse_id ? "Select lot" : "Select source warehouse first"}</option>{sourceLots.map((lot: any) => <option key={lot.id} value={lot.id}>{lot.item?.sku || "SKU"} · {lot.lot_no || lot.batch_no || "No lot"} · Avail {num(lot.available)} {lot.unit}</option>)}</select></FieldLabel>
            <FieldLabel label="Transfer Quantity *"><input className={input} type="number" min={0} value={form.quantity} disabled={!selectedLot} onChange={e => patch("quantity", e.target.value)} /></FieldLabel>

            <FieldLabel label="Destination Warehouse *"><select className={input} value={form.destination_warehouse_id} disabled={!selectedLot} onChange={e => { patch("destination_warehouse_id", e.target.value); patch("to_location_id", ""); }}><option value="">Select destination warehouse</option>{activeWarehouses.filter((w: any) => w.id !== form.source_warehouse_id).map((w: any) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></FieldLabel>
            <FieldLabel label="Destination Location *"><select className={input} value={form.to_location_id} disabled={!form.destination_warehouse_id} onChange={e => patch("to_location_id", e.target.value)}><option value="">{form.destination_warehouse_id ? "Select destination location" : "Select destination warehouse first"}</option>{destinationLocations.map((location: any) => <option key={location.id} value={location.id}>{location.code} · {[location.zone, location.aisle, location.rack, location.bin].filter(Boolean).join(" / ") || location.location_type}</option>)}</select></FieldLabel>
            <FieldLabel label="Reference No."><input className={input} value={form.reference_no} onChange={e => patch("reference_no", e.target.value)} placeholder="Internal transfer / job reference" /></FieldLabel>

            <FieldLabel label="Performed By"><select className={input} value={form.performed_by} onChange={e => patch("performed_by", e.target.value)}><option value="">Current signed-in user</option>{data.profiles.map((profile: any) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select></FieldLabel>
            <div className="md:col-span-2"><FieldLabel label="Operational Reason *"><textarea rows={3} className={`${input} resize-y`} value={form.reason} onChange={e => patch("reason", e.target.value)} /></FieldLabel></div>
          </div>

          {selectedLot && <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-slate-500">Selected Stock</p><p className="mt-1 font-semibold">{selectedLot.item?.item_name || "Inventory item"} · {selectedLot.lot_no || selectedLot.batch_no || "No lot reference"}</p></div><span className="rounded-lg border border-blue-900 bg-blue-950/30 px-3 py-1 text-xs text-blue-300">{selectedLot.warehouse?.name || "Source"} → {data.warehouses.find((w: any) => w.id === form.destination_warehouse_id)?.name || "Destination"}</span></div>
            <div className="mt-4 grid grid-cols-3 gap-3"><MiniMetric label="On Hand" value={selectedLot.on} /><MiniMetric label="Reserved" value={selectedLot.reserved} /><MiniMetric label="Available" value={selectedLot.available} accent /></div>
          </div>}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-800 p-6 sm:flex-row sm:justify-end"><button className={btn} disabled={saving} onClick={() => setOpen(false)}>Cancel</button><button className={primary} disabled={saving || !selectedLot || !form.destination_warehouse_id || !form.to_location_id} onClick={() => void submitTransfer()}>{saving ? "Posting Transfer..." : "Post Inter-Warehouse Transfer"}</button></div>
      </div>
    </div>}
  </section>;
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-xs text-slate-400">{label}<div className="mt-2">{children}</div></label>;
}

function NetworkMetric({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return <div className="bg-[#0d1423] p-4 md:px-6"><p className="text-[10px] font-medium uppercase tracking-[.16em] text-slate-500">{label}</p><p className={`mt-1 text-2xl font-bold ${accent ? "text-emerald-300" : "text-white"}`}>{num(value)}</p></div>;
}

function MiniMetric({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><p className="text-[9px] uppercase tracking-wider text-slate-600">{label}</p><p className={`mt-1 text-sm font-semibold ${accent ? "text-emerald-300" : "text-slate-200"}`}>{num(value)}</p></div>;
}
