import { createClient } from "@/lib/supabase/client";
const sb=()=>createClient();

export async function getInventoryWorkspace(){
 const s=sb();
 const [w,l,i,b,m,r,c,p,sh,d,sup]=await Promise.all([
  s.from('warehouses').select('*').order('name'),
  s.from('warehouse_locations').select('*,warehouse:warehouses(name)').order('code'),
  s.from('inventory_items').select('*,customer:customers(company_name),supplier:suppliers(company_name)').order('item_name'),
  s.from('inventory_lots').select('*,item:inventory_items(item_name,sku,base_unit,reorder_point,min_stock,expiry_controlled,temperature_controlled),warehouse:warehouses(name,code),location:warehouse_locations(code,zone,aisle,rack,bin),shipment:shipments(shipment_no)').order('created_at',{ascending:false}),
  s.from('inventory_movements').select('*,lot:inventory_lots(lot_no,item:inventory_items(item_name,sku)),from_location:warehouse_locations!inventory_movements_from_location_id_fkey(code),to_location:warehouse_locations!inventory_movements_to_location_id_fkey(code),performed_by_profile:profiles!inventory_movements_performed_by_fkey(full_name)').order('created_at',{ascending:false}).limit(250),
  s.from('inventory_reservations').select('*,lot:inventory_lots(lot_no,item:inventory_items(item_name,sku)),customer:customers(company_name),shipment:shipments(shipment_no),deal:deals(deal_no)').order('created_at',{ascending:false}),
  s.from('customers').select('id,company_name').eq('status','active').order('company_name'),
  s.from('profiles').select('id,full_name').eq('active',true).order('full_name'),
  s.from('shipments').select('id,shipment_no').order('created_at',{ascending:false}),
  s.from('deals').select('id,deal_no').order('created_at',{ascending:false}),
  s.from('suppliers').select('id,company_name').order('company_name')
 ]);
 for(const x of [w,l,i,b,m,r,c,p,sh,d,sup])if(x.error)throw x.error;
 return{warehouses:w.data??[],locations:l.data??[],items:i.data??[],lots:b.data??[],movements:m.data??[],reservations:r.data??[],customers:c.data??[],profiles:p.data??[],shipments:sh.data??[],deals:d.data??[],suppliers:sup.data??[]}
}

function clean(v:any){const out={...v};delete out.id;for(const k of Object.keys(out))if(out[k]==='')out[k]=null;return out}
export async function saveWarehouse(v:any){const s=sb();const payload={...clean(v),updated_at:new Date().toISOString()};const q=v.id?s.from('warehouses').update(payload).eq('id',v.id):s.from('warehouses').insert(payload);const {error}=await q;if(error)throw error}
export async function saveLocation(v:any){const s=sb();const payload=clean(v);const q=v.id?s.from('warehouse_locations').update(payload).eq('id',v.id):s.from('warehouse_locations').insert(payload);const {error}=await q;if(error)throw error}
export async function saveItem(v:any){const s=sb();const payload={...clean(v),min_stock:Number(v.min_stock||0),reorder_point:Number(v.reorder_point||0),updated_at:new Date().toISOString()};const q=v.id?s.from('inventory_items').update(payload).eq('id',v.id):s.from('inventory_items').insert(payload);const {error}=await q;if(error)throw error}

export async function saveLot(v:any){
 const s=sb();
 if(!v.id){
  const {data,error}=await s.rpc('inventory_receive_stock_v3',{p_payload:clean(v)});
  if(error)throw error;
  return data;
 }
 const {data:current,error:readError}=await s.from('inventory_lots').select('qty_on_hand,qty_reserved').eq('id',v.id).single();
 if(readError)throw readError;
 if(Number(v.qty_on_hand||0)!==Number(current.qty_on_hand||0)||Number(v.qty_reserved||0)!==Number(current.qty_reserved||0)){
  throw new Error('Stock balances cannot be edited directly. Use Stock Movement or Reservation workflows.');
 }
 const payload:any=clean(v);
 delete payload.qty_on_hand;
 delete payload.qty_reserved;
 payload.gross_weight_kg=v.gross_weight_kg?Number(v.gross_weight_kg):null;
 payload.net_weight_kg=v.net_weight_kg?Number(v.net_weight_kg):null;
 payload.volume_cbm=v.volume_cbm?Number(v.volume_cbm):null;
 payload.updated_at=new Date().toISOString();
 const {error}=await s.from('inventory_lots').update(payload).eq('id',v.id);
 if(error)throw error;
}

export async function addMovement(v:any){
 const s=sb();
 const {data,error}=await s.rpc('inventory_add_movement_v2',{p_payload:clean(v)});
 if(error)throw error;
 return data;
}

export async function addReservation(v:any){
 const s=sb();
 const {data,error}=await s.rpc('inventory_add_reservation_v2',{p_payload:clean(v)});
 if(error)throw error;
 return data;
}

export async function releaseReservation(id:string){
 const s=sb();
 const {data,error}=await s.rpc('inventory_release_reservation_v2',{p_reservation_id:id});
 if(error)throw error;
 return data;
}
