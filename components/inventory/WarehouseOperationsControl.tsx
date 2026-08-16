"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addMovement,
  fulfillReservation,
  getInventoryWorkspace,
  releaseReservation,
  setLotHold,
} from "@/lib/inventory-workspace";

const panel = "rounded-2xl border border-slate-800 bg-[#0d1423]";
const input = "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50";
const btn = "rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-blue-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40";
const primary = "rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40";
const danger = "rounded-xl border border-red-900 bg-red-950/30 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-950/60 disabled:cursor-not-allowed disabled:opacity-40";
const num = (v: any) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const human = (v: any) => String(v || "—").replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());

type ActionType = "hold" | "release_hold" | "damage" | "adjustment" | "fulfill" | "release_reservation" | null;

type Workspace = {
  warehouses: any[];
  locations: any[];
  items: any[];
  lots: any[];
  movements: any[];
  reservations: any[];
  events: any[];
  customers: any[];
  profiles: any[];
  shipments: any[];
  deals: any[];
  suppliers: any[];
};

const emptyWorkspace: Workspace = {
  warehouses: [], locations: [], items: [], lots: [], movements: [], reservations: [], events: [],
  customers: [], profiles: [], shipments: [], deals: [], suppliers: [],
};

export function WarehouseOperationsControl() {
  const [data, setData] = useState<Workspace>(emptyWorkspace);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedLotId, setSelectedLotId] = useState("");
  const [action, setAction] = useState<ActionType>(null);
  const [target, setTarget] = useState<any>(null);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [referenceNo, setReferenceNo] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getInventoryWorkspace() as Workspace);
    } catch (e: any) {
      setError(e.message || "Unable to load warehouse operations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const lots = useMemo(() => data.lots.map((lot: any) => {
    const on = Number(lot.qty_on_hand || 0);
    const reserved = Number(lot.qty_reserved || 0);
    return { ...lot, on, reserved, available: on - reserved };
  }), [data.lots]);

  const visibleLots = useMemo(() => lots.filter((lot: any) => {
    const hay = [lot.item?.sku, lot.item?.item_name, lot.lot_no, lot.batch_no, lot.warehouse?.name, lot.location?.code].filter(Boolean).join(" ").toLowerCase();
    return (warehouseId === "all" || lot.warehouse_id === warehouseId) && (!search || hay.includes(search.toLowerCase()));
  }), [lots, warehouseId, search]);

  const activeReservations = useMemo(() => data.reservations.filter((r: any) => {
    if (r.status !== "active") return false;
    if (warehouseId === "all") return true;
    return lots.find((l: any) => l.id === r.lot_id)?.warehouse_id === warehouseId;
  }), [data.reservations, lots, warehouseId]);

  const now = Date.now();
  const selectedLot = lots.find((lot: any) => lot.id === selectedLotId) || null;
  const heldLots = visibleLots.filter((lot: any) => lot.stock_status === "hold").length;
  const quarantineLots = visibleLots.filter((lot: any) => lot.stock_status === "quarantine").length;
  const expiringReservations = activeReservations.filter((r: any) => r.expires_at && new Date(r.expires_at).getTime() <= now + 2 * 86400000).length;
  const damageTransactions = data.movements.filter((m: any) => m.movement_type === "damage" && (warehouseId === "all" || lots.find((l: any) => l.id === m.lot_id)?.warehouse_id === warehouseId)).length;

  const timeline = useMemo(() => {
    if (!selectedLotId) return [];
    const movements = data.movements.filter((m: any) => m.lot_id === selectedLotId).map((m: any) => ({
      id: `m-${m.id}`,
      at: m.created_at,
      type: m.movement_type,
      ref: m.reference_no || m.movement_no,
      text: `${human(m.movement_type)} · ${num(m.quantity)} ${m.unit}${m.to_location?.code ? ` → ${m.to_location.code}` : ""}`,
      by: m.performed_by_profile?.full_name || "System user",
      source: "Movement",
    }));
    const reservations = data.reservations.filter((r: any) => r.lot_id === selectedLotId).map((r: any) => ({
      id: `r-${r.id}`,
      at: r.updated_at || r.created_at,
      type: r.status === "active" ? "reserve" : r.status,
      ref: r.reservation_no,
      text: `${human(r.status)} reservation · ${num(r.quantity)} ${r.unit}${r.customer?.company_name ? ` · ${r.customer.company_name}` : ""}`,
      by: r.reserved_by_profile?.full_name || "System user",
      source: "Reservation",
    }));
    const events = data.events.filter((e: any) => e.lot_id === selectedLotId).map((e: any) => ({
      id: `e-${e.id}`,
      at: e.created_at,
      type: e.event_type,
      ref: e.reference_no || e.event_no,
      text: `${human(e.event_type)}${e.reason ? ` · ${e.reason}` : ""}`,
      by: e.performed_by_profile?.full_name || "System user",
      source: "Control Event",
    }));
    return [...movements, ...reservations, ...events].sort((a: any, b: any) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [selectedLotId, data.movements, data.reservations, data.events]);

  const beginLotAction = (nextAction: ActionType, lot: any) => {
    setAction(nextAction);
    setTarget(lot);
    setQuantity(nextAction === "adjustment" ? String(lot.on) : "");
    setReason("");
    setReferenceNo("");
    setError(null);
    setMessage(null);
  };

  const beginReservationAction = (nextAction: ActionType, reservation: any) => {
    setAction(nextAction);
    setTarget(reservation);
    setQuantity("");
    setReason(nextAction === "fulfill" ? "Reservation fulfillment" : "");
    setReferenceNo("");
    setError(null);
    setMessage(null);
  };

  const closeAction = () => {
    if (!saving) {
      setAction(null);
      setTarget(null);
    }
  };

  const submitAction = async () => {
    if (!action || !target) return;
    setSaving(true);
    setError(null);
    try {
      if (action === "hold" || action === "release_hold") {
        if (!reason.trim()) throw new Error("Operational reason is required.");
        await setLotHold(target.id, action === "hold", reason.trim(), referenceNo.trim() || undefined);
      }
      if (action === "damage") {
        const q = Number(quantity || 0);
        if (q <= 0 || q > target.available) throw new Error(`Damage quantity must be between 0 and ${num(target.available)} ${target.unit}.`);
        if (!reason.trim()) throw new Error("Damage reason is required.");
        await addMovement({ movement_type: "damage", lot_id: target.id, quantity: q, unit: target.unit, from_location_id: target.location_id || null, reference_no: referenceNo || null, reason: reason.trim() });
      }
      if (action === "adjustment") {
        const q = Number(quantity);
        if (!Number.isFinite(q) || q < target.reserved) throw new Error(`New on-hand balance cannot be below reserved quantity of ${num(target.reserved)} ${target.unit}.`);
        if (!reason.trim()) throw new Error("Adjustment reason is required.");
        await addMovement({ movement_type: "adjustment", lot_id: target.id, quantity: q, unit: target.unit, from_location_id: target.location_id || null, reference_no: referenceNo || null, reason: reason.trim() });
      }
      if (action === "fulfill") {
        await fulfillReservation(target.id, referenceNo.trim() || undefined, reason.trim() || undefined);
      }
      if (action === "release_reservation") {
        await releaseReservation(target.id);
      }
      setMessage(successText(action));
      setAction(null);
      setTarget(null);
      await load();
    } catch (e: any) {
      setError(e.message || "Unable to complete inventory operation");
    } finally {
      setSaving(false);
    }
  };

  return <section className="px-5 pt-5 text-white md:px-8">
    <div className={`${panel} overflow-hidden`}>
      <header className="border-b border-slate-800 bg-gradient-to-r from-slate-950 via-[#101827] to-amber-950/20 p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-amber-900 bg-amber-950/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.18em] text-amber-300">Operations Control</span>
              <span className="text-xs text-slate-500">Audited stock workflows</span>
            </div>
            <h2 className="mt-2 text-xl font-bold">Warehouse Operations & Stock Control</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">Execute stock holds, releases, damage postings, controlled adjustments and reservation fulfillment with a complete lot-level activity trail.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select className={`${input} min-w-[230px]`} value={warehouseId} onChange={e => setWarehouseId(e.target.value)}>
              <option value="all">All Warehouses</option>
              {data.warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}
            </select>
            <button className={btn} onClick={() => void load()} disabled={loading}>{loading ? "Refreshing..." : "Refresh Operations"}</button>
          </div>
        </div>
      </header>

      {error && <Alert kind="error" text={error} onClose={() => setError(null)} />}
      {message && <Alert kind="success" text={message} onClose={() => setMessage(null)} />}

      <div className="grid gap-px bg-slate-800 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Lots on Hold" value={heldLots} tone={heldLots ? "amber" : "default"} />
        <Kpi label="Active Reservations" value={activeReservations.length} />
        <Kpi label="Reservation ≤48h" value={expiringReservations} tone={expiringReservations ? "amber" : "default"} />
        <Kpi label="Quarantine Lots" value={quarantineLots} tone={quarantineLots ? "red" : "default"} />
        <Kpi label="Damage Transactions" value={damageTransactions} />
      </div>

      <div className="grid gap-5 p-5 md:p-6 2xl:grid-cols-[1.15fr_.85fr]">
        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><h3 className="font-semibold">Lot Action Desk</h3><p className="mt-1 text-xs leading-5 text-slate-500">Run controlled operational actions. Direct stock-status editing is blocked.</p></div>
            <input className={`${input} sm:max-w-sm`} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search SKU, item, lot or location..." />
          </div>
          <div className="mt-4 max-h-[480px] space-y-2 overflow-y-auto pr-1">
            {visibleLots.length === 0 ? <Empty text="No lots match the current filters." /> : visibleLots.map((lot: any) => <article key={lot.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <button className="text-left" onClick={() => setSelectedLotId(lot.id)}>
                  <div className="flex flex-wrap items-center gap-2"><b>{lot.item?.item_name || "Unnamed item"}</b><Badge value={lot.stock_status} /></div>
                  <p className="mt-1 text-xs text-slate-500">{lot.item?.sku || "—"} · {lot.lot_no || lot.batch_no || "No lot"} · {lot.warehouse?.name || "—"} / {lot.location?.code || "Unassigned"}</p>
                </button>
                <div className="grid grid-cols-3 gap-3 text-right text-xs">
                  <Qty label="On Hand" value={lot.on} unit={lot.unit} />
                  <Qty label="Reserved" value={lot.reserved} unit={lot.unit} />
                  <Qty label="Available" value={lot.available} unit={lot.unit} accent />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                <button className={btn} disabled={lot.stock_status === "hold" || lot.on <= 0 || lot.condition_status !== "good" || ["damaged", "quarantine"].includes(lot.stock_status)} onClick={() => beginLotAction("hold", lot)}>Place Hold</button>
                <button className={btn} disabled={lot.stock_status !== "hold"} onClick={() => beginLotAction("release_hold", lot)}>Release Hold</button>
                <button className={danger} disabled={lot.available <= 0 || ["hold", "quarantine"].includes(lot.stock_status)} onClick={() => beginLotAction("damage", lot)}>Record Damage</button>
                <button className={btn} disabled={lot.stock_status === "quarantine"} onClick={() => beginLotAction("adjustment", lot)}>Stock Adjustment</button>
                <button className={btn} onClick={() => setSelectedLotId(lot.id)}>Activity Timeline</button>
              </div>
            </article>)}
          </div>
        </div>

        <div>
          <h3 className="font-semibold">Reservation Fulfillment Queue</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">Active reservations awaiting physical issue or release. Fulfillment updates the reservation, balances and issue movement atomically.</p>
          <div className="mt-4 max-h-[480px] space-y-2 overflow-y-auto pr-1">
            {activeReservations.length === 0 ? <Empty text="No active reservations require action." /> : activeReservations.map((r: any) => {
              const lot = lots.find((x: any) => x.id === r.lot_id);
              const expired = !!r.expires_at && new Date(r.expires_at).getTime() < now;
              const blocked = !lot || expired || ["hold", "damaged", "quarantine"].includes(lot.stock_status) || lot.condition_status !== "good";
              return <article key={r.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-mono text-xs text-blue-300">{r.reservation_no}</p><b className="mt-1 block">{r.lot?.item?.item_name || lot?.item?.item_name || "Inventory reservation"}</b><p className="mt-1 text-xs text-slate-500">{r.customer?.company_name || "No customer"} · {r.shipment?.shipment_no || r.deal?.deal_no || "No linked job"}</p></div>
                  <Badge value={expired ? "expired" : "active"} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2"><Mini label="Reserved Qty" value={`${num(r.quantity)} ${r.unit}`} /><Mini label="Expires" value={r.expires_at ? new Date(r.expires_at).toLocaleDateString() : "No expiry"} /></div>
                <div className="mt-4 flex gap-2 border-t border-slate-800 pt-4"><button className={primary} disabled={blocked} onClick={() => beginReservationAction("fulfill", r)}>Fulfill & Issue</button><button className={danger} onClick={() => beginReservationAction("release_reservation", r)}>Release</button></div>
                {blocked && <p className="mt-2 text-[11px] text-amber-300">Fulfillment blocked: {expired ? "reservation expired" : "lot is not operationally releasable"}.</p>}
              </article>;
            })}
          </div>
        </div>
      </div>
    </div>

    <div className={`${panel} mt-5 overflow-hidden`}>
      <div className="flex flex-col gap-3 border-b border-slate-800 p-5 md:flex-row md:items-center md:justify-between">
        <div><h3 className="font-semibold">Lot Activity Timeline</h3><p className="mt-1 text-xs text-slate-500">Unified history of movements, reservations and operational control events.</p></div>
        <select className={`${input} md:max-w-lg`} value={selectedLotId} onChange={e => setSelectedLotId(e.target.value)}><option value="">Select lot to inspect history</option>{visibleLots.map((lot: any) => <option key={lot.id} value={lot.id}>{lot.item?.sku} · {lot.lot_no || lot.batch_no || "No lot"} · {lot.warehouse?.name}</option>)}</select>
      </div>
      {!selectedLot ? <div className="p-8"><Empty text="Select a lot to view its complete operational history." /></div> : <div className="p-5 md:p-6">
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Mini label="Item" value={`${selectedLot.item?.sku || "—"} · ${selectedLot.item?.item_name || "—"}`} /><Mini label="Warehouse" value={selectedLot.warehouse?.name || "—"} /><Mini label="Location" value={selectedLot.location?.code || "Unassigned"} /><Mini label="On Hand" value={`${num(selectedLot.on)} ${selectedLot.unit}`} /><Mini label="Status" value={human(selectedLot.stock_status)} /></div>
        {timeline.length === 0 ? <Empty text="No activity has been recorded for this lot yet." /> : <div>{timeline.map((row: any) => <div key={row.id} className="relative grid gap-3 border-l border-slate-700 pb-5 pl-6 md:grid-cols-[170px_120px_1fr_180px]"><span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-blue-500 ring-4 ring-[#0d1423]" /><div className="text-xs text-slate-500">{row.at ? new Date(row.at).toLocaleString() : "—"}</div><div><Badge value={row.type} /></div><div><p className="text-sm text-slate-200">{row.text}</p><p className="mt-1 text-[11px] text-slate-600">{row.source} · {row.ref || "No reference"}</p></div><div className="text-xs text-slate-500 md:text-right">{row.by}</div></div>)}</div>}
      </div>}
    </div>

    {action && target && <ActionModal action={action} target={target} quantity={quantity} setQuantity={setQuantity} reason={reason} setReason={setReason} referenceNo={referenceNo} setReferenceNo={setReferenceNo} saving={saving} onClose={closeAction} onSubmit={() => void submitAction()} />}
  </section>;
}

function ActionModal({ action, target, quantity, setQuantity, reason, setReason, referenceNo, setReferenceNo, saving, onClose, onSubmit }: any) {
  const reservationAction = action === "fulfill" || action === "release_reservation";
  const title = action === "hold" ? "Place Stock on Hold" : action === "release_hold" ? "Release Stock Hold" : action === "damage" ? "Record Damaged Stock" : action === "adjustment" ? "Controlled Stock Adjustment" : action === "fulfill" ? "Fulfill Reservation & Issue Stock" : "Release Reservation";
  const destructive = action === "damage" || action === "release_reservation";
  const context = reservationAction ? `${target.reservation_no} · ${num(target.quantity)} ${target.unit}` : `${target.item?.sku || "SKU"} · ${target.lot_no || target.batch_no || "Lot"} · ${target.warehouse?.name || "Warehouse"}`;
  const reasonRequired = ["hold", "release_hold", "damage", "adjustment"].includes(action);

  return <div className="fixed inset-0 z-[90] overflow-y-auto bg-black/80 p-4 backdrop-blur-sm md:p-8">
    <div className="mx-auto max-w-2xl rounded-3xl border border-slate-700 bg-[#0b1120] shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-6"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-blue-400">Controlled Workflow</p><h2 className="mt-1 text-2xl font-bold text-white">{title}</h2><p className="mt-2 text-sm text-slate-500">{context}</p></div><button className={btn} disabled={saving} onClick={onClose}>Close</button></div>
      <div className="space-y-4 p-6">
        {action === "damage" && <FormField label={`Damaged Quantity * · Available ${num(target.available)} ${target.unit}`}><input className={input} type="number" min={0} max={target.available} value={quantity} onChange={e => setQuantity(e.target.value)} /></FormField>}
        {action === "adjustment" && <FormField label={`New On-Hand Balance * · Reserved ${num(target.reserved)} ${target.unit}`}><input className={input} type="number" min={target.reserved} value={quantity} onChange={e => setQuantity(e.target.value)} /></FormField>}
        <FormField label="Reference No."><input className={input} value={referenceNo} onChange={e => setReferenceNo(e.target.value)} placeholder="Internal reference, approval or job number" /></FormField>
        {action !== "release_reservation" && <FormField label={reasonRequired ? "Operational Reason *" : "Operational Note"}><textarea className={`${input} min-h-24 resize-y`} value={reason} onChange={e => setReason(e.target.value)} placeholder="State the operational reason and context..." /></FormField>}
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-xs leading-5 text-slate-500">This action is written to the inventory audit trail. Balance-changing operations are executed transactionally in Supabase and cannot be posted by directly editing the stock record.</div>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-800 p-6"><button className={btn} disabled={saving} onClick={onClose}>Cancel</button><button className={destructive ? danger : primary} disabled={saving} onClick={onSubmit}>{saving ? "Processing..." : title}</button></div>
    </div>
  </div>;
}

function FormField({ label, children }: any) { return <label className="block text-xs text-slate-400">{label}<div className="mt-2">{children}</div></label>; }
function Alert({ kind, text, onClose }: any) { const ok = kind === "success"; return <div className={`mx-5 mt-5 flex items-start justify-between gap-3 rounded-xl border p-4 text-sm md:mx-6 ${ok ? "border-emerald-900 bg-emerald-950/30 text-emerald-300" : "border-red-900 bg-red-950/30 text-red-300"}`}><span>{text}</span><button onClick={onClose}>×</button></div>; }
function Kpi({ label, value, tone = "default" }: any) { return <div className="bg-[#0d1423] p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-2 text-2xl font-bold ${tone === "amber" ? "text-amber-300" : tone === "red" ? "text-red-300" : "text-white"}`}>{num(value)}</p></div>; }
function Qty({ label, value, unit, accent = false }: any) { return <div><p className="text-[9px] uppercase tracking-wider text-slate-600">{label}</p><p className={`mt-1 font-semibold ${accent ? "text-emerald-300" : "text-slate-300"}`}>{num(value)} <span className="font-normal text-slate-600">{unit}</span></p></div>; }
function Mini({ label, value }: any) { return <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><p className="text-[9px] uppercase tracking-wider text-slate-600">{label}</p><p className="mt-1 truncate text-sm text-slate-300">{value}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">{text}</div>; }
function Badge({ value }: { value: any }) { const v = String(value || "").toLowerCase(); const cls = ["hold", "expired", "damage", "damaged", "quarantine", "rejected"].includes(v) ? "border-red-900 bg-red-950/30 text-red-300" : ["active", "available", "fulfilled", "release_hold", "released", "receipt"].includes(v) ? "border-emerald-900 bg-emerald-950/30 text-emerald-300" : ["reserve", "reserved", "adjustment", "transfer", "issue", "reservation_fulfilled"].includes(v) ? "border-blue-900 bg-blue-950/30 text-blue-300" : "border-slate-700 bg-slate-900 text-slate-300"; return <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs ${cls}`}>{human(value)}</span>; }
function successText(action: ActionType) { return action === "hold" ? "Stock hold posted and audit event created." : action === "release_hold" ? "Stock hold released and audit event created." : action === "damage" ? "Damaged stock posted as an audited movement." : action === "adjustment" ? "Stock adjustment posted successfully." : action === "fulfill" ? "Reservation fulfilled and stock issue posted atomically." : "Reservation released and available stock restored."; }
