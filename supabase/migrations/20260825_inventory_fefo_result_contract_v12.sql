create or replace function public.inventory_reserve_fefo_v1(p_payload jsonb)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_item uuid := nullif(p_payload->>'item_id','')::uuid;
  v_warehouse uuid := nullif(p_payload->>'warehouse_id','')::uuid;
  v_qty numeric := coalesce((p_payload->>'quantity')::numeric,0);
  v_remaining numeric;
  v_take numeric;
  v_lot public.inventory_lots%rowtype;
  v_no text;
  v_id uuid;
  v_allocations jsonb := '[]'::jsonb;
  v_total_available numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if v_item is null then raise exception 'Item is required for FEFO reservation.'; end if;
  if v_qty <= 0 then raise exception 'Reservation quantity must be greater than zero.'; end if;

  select coalesce(sum(qty_on_hand-qty_reserved),0) into v_total_available
  from public.inventory_lots
  where item_id=v_item
    and (v_warehouse is null or warehouse_id=v_warehouse)
    and qty_on_hand>qty_reserved
    and condition_status='good'
    and stock_status not in ('hold','damaged','quarantine')
    and (expiry_date is null or expiry_date >= current_date);
  if v_total_available < v_qty then raise exception 'Insufficient eligible FEFO stock. Available: %, requested: %.', v_total_available, v_qty; end if;

  v_remaining := v_qty;
  for v_lot in
    select * from public.inventory_lots
    where item_id=v_item
      and (v_warehouse is null or warehouse_id=v_warehouse)
      and qty_on_hand>qty_reserved
      and condition_status='good'
      and stock_status not in ('hold','damaged','quarantine')
      and (expiry_date is null or expiry_date >= current_date)
    order by expiry_date asc nulls last, received_date asc nulls last, created_at asc
    for update skip locked
  loop
    exit when v_remaining <= 0;
    v_take := least(v_remaining, coalesce(v_lot.qty_on_hand,0)-coalesce(v_lot.qty_reserved,0));
    if v_take <= 0 then continue; end if;
    v_no := 'RES-' || to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS') || '-' || substr(gen_random_uuid()::text,1,8);
    insert into public.inventory_reservations(reservation_no,lot_id,quantity,unit,deal_id,shipment_id,customer_id,status,reserved_by,expires_at,notes)
    values(v_no,v_lot.id,v_take,coalesce(nullif(p_payload->>'unit',''),v_lot.unit),nullif(p_payload->>'deal_id','')::uuid,nullif(p_payload->>'shipment_id','')::uuid,nullif(p_payload->>'customer_id','')::uuid,'active',coalesce(nullif(p_payload->>'reserved_by','')::uuid,auth.uid()),nullif(p_payload->>'expires_at','')::timestamptz,nullif(p_payload->>'notes',''))
    returning id into v_id;
    perform set_config('app.inventory_balance_write','on',true);
    update public.inventory_lots set qty_reserved=qty_reserved+v_take,stock_status='reserved',updated_at=now() where id=v_lot.id;
    v_allocations := v_allocations || jsonb_build_array(jsonb_build_object('reservation_id',v_id,'reservation_no',v_no,'lot_id',v_lot.id,'lot_no',v_lot.lot_no,'batch_no',v_lot.batch_no,'expiry_date',v_lot.expiry_date,'quantity',v_take,'unit',v_lot.unit));
    v_remaining := v_remaining-v_take;
  end loop;
  if v_remaining > 0 then raise exception 'Eligible stock changed during allocation. Please retry.'; end if;
  return jsonb_build_object('allocated',true,'reserved',v_qty,'allocations',v_allocations,'method','FEFO');
end;
$function$;
