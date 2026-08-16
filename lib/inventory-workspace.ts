import { createClient } from "@/lib/supabase/client";

const sb = () => createClient();

export async function getInventoryWorkspace() {
  const s = sb();
  const [w, l, i, b, m, r, e, c, p, sh, d, sup] = await Promise.all([
    s.from("warehouses").select("*").order("name"),
    s.from("warehouse_locations").select("*,warehouse:warehouses(name,code)").order("code"),
    s.from("inventory_items").select("*,customer:customers(company_name),supplier:suppliers(company_name)").order("item_name"),
    s.from("inventory_lots").select("*,item:inventory_items(item_name,sku,base_unit,reorder_point,min_stock,expiry_controlled,temperature_controlled,serial_controlled,lot_controlled),warehouse:warehouses(name,code),location:warehouse_locations(code,zone,aisle,rack,bin,capacity_qty,capacity_unit,status),shipment:shipments(shipment_no),deal:deals(deal_no),customer:customers(company_name)").order("created_at", { ascending: false }),
    s.from("inventory_movements").select("*,lot:inventory_lots(lot_no,batch_no,item:inventory_items(item_name,sku)),destination_lot:inventory_lots!inventory_movements_destination_lot_id_fkey(lot_no,batch_no),from_location:warehouse_locations!inventory_movements_from_location_id_fkey(code,warehouse:warehouses(name,code)),to_location:warehouse_locations!inventory_movements_to_location_id_fkey(code,warehouse:warehouses(name,code)),performed_by_profile:profiles!inventory_movements_performed_by_fkey(full_name)").order("created_at", { ascending: false }).limit(500),
    s.from("inventory_reservations").select("*,lot:inventory_lots(lot_no,batch_no,expiry_date,warehouse:warehouses(name,code),location:warehouse_locations(code),item:inventory_items(item_name,sku)),customer:customers(company_name),shipment:shipments(shipment_no),deal:deals(deal_no),reserved_by_profile:profiles!inventory_reservations_reserved_by_fkey(full_name)").order("created_at", { ascending: false }),
    s.from("inventory_events").select("*,lot:inventory_lots(lot_no,batch_no,item:inventory_items(item_name,sku)),performed_by_profile:profiles!inventory_events_performed_by_fkey(full_name)").order("created_at", { ascending: false }).limit(500),
    s.from("customers").select("id,company_name").eq("status", "active").order("company_name"),
    s.from("profiles").select("id,full_name,role").eq("active", true).order("full_name"),
    s.from("shipments").select("id,shipment_no").order("created_at", { ascending: false }),
    s.from("deals").select("id,deal_no").order("created_at", { ascending: false }),
    s.from("suppliers").select("id,company_name").order("company_name"),
  ]);
  for (const x of [w, l, i, b, m, r, e, c, p, sh, d, sup]) if (x.error) throw x.error;
  return {
    warehouses: w.data ?? [], locations: l.data ?? [], items: i.data ?? [], lots: b.data ?? [], movements: m.data ?? [],
    reservations: r.data ?? [], events: e.data ?? [], customers: c.data ?? [], profiles: p.data ?? [], shipments: sh.data ?? [],
    deals: d.data ?? [], suppliers: sup.data ?? [],
  };
}

function normalize(value: any) { return value === "" ? null : value; }
function pick(v: any, fields: string[]) {
  const out: Record<string, any> = {};
  for (const key of fields) if (Object.prototype.hasOwnProperty.call(v, key)) out[key] = normalize(v[key]);
  return out;
}

const warehouseFields = ["code", "name", "warehouse_type", "country", "city", "address", "operator_name", "contact_person", "phone", "temperature_controlled", "status", "notes"];
const locationFields = ["warehouse_id", "code", "zone", "aisle", "rack", "bin", "location_type", "capacity_qty", "capacity_unit", "temperature_min_c", "temperature_max_c", "status", "notes"];
const itemFields = ["sku", "item_name", "description", "category", "hs_code", "base_unit", "lot_controlled", "serial_controlled", "expiry_controlled", "temperature_controlled", "min_stock", "reorder_point", "customer_id", "supplier_id", "status", "notes"];
const lotFields = ["item_id", "warehouse_id", "location_id", "shipment_id", "lot_no", "batch_no", "serial_no", "container_no", "package_ref", "production_date", "expiry_date", "received_date", "condition_status", "unit", "gross_weight_kg", "net_weight_kg", "volume_cbm", "owner_type", "owner_name", "customs_status", "notes"];
const movementFields = ["movement_type", "lot_id", "from_location_id", "to_location_id", "quantity", "unit", "reference_type", "reference_id", "reference_no", "reason", "performed_by"];
const reservationFields = ["lot_id", "quantity", "unit", "deal_id", "shipment_id", "customer_id", "reserved_by", "expires_at", "notes"];

export async function saveWarehouse(v: any) {
  const s = sb(); const payload = { ...pick(v, warehouseFields), updated_at: new Date().toISOString() };
  const q = v.id ? s.from("warehouses").update(payload).eq("id", v.id) : s.from("warehouses").insert(payload);
  const { error } = await q; if (error) throw error;
}
export async function saveLocation(v: any) {
  const s = sb(); const payload = pick(v, locationFields);
  for (const key of ["capacity_qty", "temperature_min_c", "temperature_max_c"]) if (payload[key] !== null && payload[key] !== undefined) payload[key] = Number(payload[key]);
  const q = v.id ? s.from("warehouse_locations").update(payload).eq("id", v.id) : s.from("warehouse_locations").insert(payload);
  const { error } = await q; if (error) throw error;
}
export async function saveItem(v: any) {
  const s = sb(); const payload = { ...pick(v, itemFields), min_stock: Number(v.min_stock || 0), reorder_point: Number(v.reorder_point || 0), updated_at: new Date().toISOString() };
  const q = v.id ? s.from("inventory_items").update(payload).eq("id", v.id) : s.from("inventory_items").insert(payload);
  const { error } = await q; if (error) throw error;
}
export async function saveLot(v: any) {
  const s = sb();
  if (!v.id) {
    const payload = { ...pick(v, [...lotFields, "stock_status", "qty_on_hand", "qty_reserved"]), qty_on_hand: Number(v.qty_on_hand || 0), qty_reserved: Number(v.qty_reserved || 0), gross_weight_kg: v.gross_weight_kg ? Number(v.gross_weight_kg) : null, net_weight_kg: v.net_weight_kg ? Number(v.net_weight_kg) : null, volume_cbm: v.volume_cbm ? Number(v.volume_cbm) : null };
    const { data, error } = await s.rpc("inventory_receive_stock_v3", { p_payload: payload }); if (error) throw error; return data;
  }
  const { data: current, error: readError } = await s.from("inventory_lots").select("qty_on_hand,qty_reserved,stock_status").eq("id", v.id).single();
  if (readError) throw readError;
  if (Number(v.qty_on_hand || 0) !== Number(current.qty_on_hand || 0) || Number(v.qty_reserved || 0) !== Number(current.qty_reserved || 0)) throw new Error("Stock balances cannot be edited directly. Use Stock Movement or Reservation workflows.");
  if (v.stock_status && v.stock_status !== current.stock_status) throw new Error("Stock status cannot be edited directly. Use Hold, Release, Quarantine or other controlled workflows.");
  const payload: Record<string, any> = pick(v, lotFields); payload.gross_weight_kg = v.gross_weight_kg ? Number(v.gross_weight_kg) : null; payload.net_weight_kg = v.net_weight_kg ? Number(v.net_weight_kg) : null; payload.volume_cbm = v.volume_cbm ? Number(v.volume_cbm) : null; payload.updated_at = new Date().toISOString();
  const { error } = await s.from("inventory_lots").update(payload).eq("id", v.id); if (error) throw error;
}
export async function addMovement(v: any) { const s = sb(); const payload = pick(v, movementFields); payload.quantity = Number(v.quantity || 0); const { data, error } = await s.rpc("inventory_add_movement_v2", { p_payload: payload }); if (error) throw error; return data; }
export async function addReservation(v: any) { const s = sb(); const payload = pick(v, reservationFields); payload.quantity = Number(v.quantity || 0); const { data, error } = await s.rpc("inventory_add_reservation_v2", { p_payload: payload }); if (error) throw error; return data; }
export async function releaseReservation(id: string) { const s = sb(); const { data, error } = await s.rpc("inventory_release_reservation_v2", { p_reservation_id: id }); if (error) throw error; return data; }
export async function fulfillReservation(id: string, referenceNo?: string, reason?: string) { const s = sb(); const { data, error } = await s.rpc("inventory_fulfill_reservation_v1", { p_reservation_id: id, p_reference_no: referenceNo || null, p_reason: reason || null }); if (error) throw error; return data; }
export async function setLotHold(lotId: string, hold: boolean, reason: string, referenceNo?: string) { const s = sb(); const { data, error } = await s.rpc("inventory_set_lot_hold_v1", { p_lot_id: lotId, p_hold: hold, p_reason: reason, p_reference_no: referenceNo || null }); if (error) throw error; return data; }

export async function reserveFefo(v: any) {
  const s = sb();
  const payload = pick(v, ["item_id", "warehouse_id", "quantity", "unit", "deal_id", "shipment_id", "customer_id", "reserved_by", "expires_at", "notes"]);
  payload.quantity = Number(v.quantity || 0);
  const { data, error } = await s.rpc("inventory_reserve_fefo_v1", { p_payload: payload });
  if (error) throw error;
  return data;
}

export async function linkInventoryLot(v: any) {
  const s = sb();
  const payload = pick(v, ["lot_id", "shipment_id", "deal_id", "customer_id", "owner_type", "owner_name", "reference_no", "reason"]);
  const { data, error } = await s.rpc("inventory_link_lot_v1", { p_payload: payload });
  if (error) throw error;
  return data;
}
