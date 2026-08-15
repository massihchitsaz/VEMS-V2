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
export async function saveLot(v:any){const s=sb();const payload={...clean(v),qty_on_hand:Number(v.qty_on_hand||0),qty_reserved:Number(v.qty_reserved||0),gross_weight_kg:v.gross_weight_kg?Number(v.gross_weight_kg):null,net_weight_kg:v.net_weight_kg?Number(v.net_weight_kg):null,volume_cbm:v.volume_cbm?Number(v.volume_cbm):null,updated_at:new Date().toISOString()};const q=v.id?s.from('inventory_lots').update(payload).eq('id',v.id):s.from('inventory_lots').insert(payload);const {error}=await q;if(error)throw error}

export async function addMovement(v:any){
 const s=sb();const movement_no=`MOV-${Date.now()}`;
 const {data:lot,error:e1}=await s.from('inventory_lots').select('*').eq('id',v.lot_id).single();if(e1)throw e1;
 let on=Number(lot.qty_on_hand||0),loc=lot.location_id,status=lot.stock_status;const q=Number(v.quantity);
 if(!q||q<=0)throw new Error('Movement quantity must be greater than zero.');
 const available=on-Number(lot.qty_reserved||0);
 if(['issue','damage'].includes(v.movement_type)){if(q>available)throw new Error('Insufficient available stock.');on-=q;if(v.movement_type==='damage')status='damaged'}
 else if(v.movement_type==='receipt')on+=q;
 else if(v.movement_type==='adjustment'){on=q}
 else if(v.movement_type==='transfer')loc=v.to_location_id||loc;
 else if(v.movement_type==='quarantine')status='quarantine';
 else if(v.movement_type==='repack'){}
 const payload={...clean(v),quantity:q,movement_no};
 const {error}=await s.from('inventory_movements').insert(payload);if(error)throw error;
 const u=await s.from('inventory_lots').update({qty_on_hand:on,location_id:loc,stock_status:status,updated_at:new Date().toISOString()}).eq('id',v.lot_id);if(u.error)throw u.error
}

export async function addReservation(v:any){
 const s=sb();const {data:lot,error:e}=await s.from('inventory_lots').select('*').eq('id',v.lot_id).single();if(e)throw e;
 const q=Number(v.quantity),available=Number(lot.qty_on_hand||0)-Number(lot.qty_reserved||0);if(!q||q<=0)throw new Error('Reservation quantity must be greater than zero.');if(q>available)throw new Error('Reservation exceeds available stock.');
 const reservation_no=`RES-${Date.now()}`;const {error}=await s.from('inventory_reservations').insert({...clean(v),quantity:q,reservation_no});if(error)throw error;
 const u=await s.from('inventory_lots').update({qty_reserved:Number(lot.qty_reserved||0)+q,stock_status:'reserved',updated_at:new Date().toISOString()}).eq('id',v.lot_id);if(u.error)throw u.error
}

export async function releaseReservation(id:string){const s=sb();const {data:r,error}=await s.from('inventory_reservations').select('*').eq('id',id).single();if(error)throw error;if(r.status!=='active')return;const {data:lot,error:e}=await s.from('inventory_lots').select('*').eq('id',r.lot_id).single();if(e)throw e;const next=Math.max(0,Number(lot.qty_reserved||0)-Number(r.quantity||0));const a=await s.from('inventory_reservations').update({status:'released',updated_at:new Date().toISOString()}).eq('id',id);if(a.error)throw a.error;const b=await s.from('inventory_lots').update({qty_reserved:next,stock_status:next>0?'reserved':'available',updated_at:new Date().toISOString()}).eq('id',r.lot_id);if(b.error)throw b.error}
