alter table public.inventory_lots add column if not exists deal_id uuid references public.deals(id);
alter table public.inventory_lots add column if not exists customer_id uuid references public.customers(id);
create index if not exists inventory_lots_deal_id_idx on public.inventory_lots(deal_id);
create index if not exists inventory_lots_customer_id_idx on public.inventory_lots(customer_id);
create index if not exists inventory_lots_expiry_item_warehouse_idx on public.inventory_lots(item_id,warehouse_id,expiry_date) where qty_on_hand > 0;

create or replace function public.inventory_enforce_location_capacity_v1()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_capacity numeric;
  v_capacity_unit text;
  v_used numeric;
begin
  if new.location_id is null or coalesce(new.qty_on_hand,0) <= 0 then return new; end if;
  select capacity_qty, capacity_unit into v_capacity, v_capacity_unit from public.warehouse_locations where id=new.location_id;
  if v_capacity is null or v_capacity <= 0 then return new; end if;
  if nullif(v_capacity_unit,'') is not null and coalesce(nullif(new.unit,''),'') <> v_capacity_unit then
    raise exception 'Location capacity is defined in %, but lot unit is %. Choose a compatible location or correct the capacity unit.', v_capacity_unit, coalesce(new.unit,'not set');
  end if;
  select coalesce(sum(qty_on_hand),0) into v_used from public.inventory_lots where location_id=new.location_id and id is distinct from new.id and coalesce(qty_on_hand,0)>0 and (nullif(v_capacity_unit,'') is null or unit=v_capacity_unit);
  if v_used + coalesce(new.qty_on_hand,0) > v_capacity then raise exception 'Location capacity exceeded. Capacity: % %, used: % %, requested resulting load: % %.', v_capacity, coalesce(v_capacity_unit,new.unit), v_used, coalesce(v_capacity_unit,new.unit), v_used+coalesce(new.qty_on_hand,0), coalesce(v_capacity_unit,new.unit); end if;
  return new;
end;
$function$;

drop trigger if exists trg_inventory_location_capacity_v1 on public.inventory_lots;
create trigger trg_inventory_location_capacity_v1 before insert or update of location_id,qty_on_hand,unit on public.inventory_lots for each row execute function public.inventory_enforce_location_capacity_v1();

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
  select coalesce(sum(qty_on_hand-qty_reserved),0) into v_total_available from public.inventory_lots where item_id=v_item and (v_warehouse is null or warehouse_id=v_warehouse) and qty_on_hand>qty_reserved and condition_status='good' and stock_status not in ('hold','damaged','quarantine') and (expiry_date is null or expiry_date >= current_date);
  if v_total_available < v_qty then raise exception 'Insufficient eligible FEFO stock. Available: %, requested: %.', v_total_available, v_qty; end if;
  v_remaining := v_qty;
  for v_lot in select * from public.inventory_lots where item_id=v_item and (v_warehouse is null or warehouse_id=v_warehouse) and qty_on_hand>qty_reserved and condition_status='good' and stock_status not in ('hold','damaged','quarantine') and (expiry_date is null or expiry_date >= current_date) order by expiry_date asc nulls last, received_date asc nulls last, created_at asc for update skip locked
  loop
    exit when v_remaining <= 0;
    v_take := least(v_remaining, coalesce(v_lot.qty_on_hand,0)-coalesce(v_lot.qty_reserved,0));
    if v_take <= 0 then continue; end if;
    v_no := 'RES-' || to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS') || '-' || substr(gen_random_uuid()::text,1,8);
    insert into public.inventory_reservations(reservation_no,lot_id,quantity,unit,deal_id,shipment_id,customer_id,status,reserved_by,expires_at,notes)
    values(v_no,v_lot.id,v_take,coalesce(nullif(p_payload->>'unit',''),v_lot.unit),nullif(p_payload->>'deal_id','')::uuid,nullif(p_payload->>'shipment_id','')::uuid,nullif(p_payload->>'customer_id','')::uuid,'active',coalesce(nullif(p_payload->>'reserved_by','')::uuid,auth.uid()),nullif(p_payload->>'expires_at','')::timestamptz,nullif(p_payload->>'notes','')) returning id into v_id;
    perform set_config('app.inventory_balance_write','on',true);
    update public.inventory_lots set qty_reserved=qty_reserved+v_take,stock_status='reserved',updated_at=now() where id=v_lot.id;
    v_allocations := v_allocations || jsonb_build_array(jsonb_build_object('reservation_id',v_id,'reservation_no',v_no,'lot_id',v_lot.id,'lot_no',v_lot.lot_no,'batch_no',v_lot.batch_no,'expiry_date',v_lot.expiry_date,'quantity',v_take,'unit',v_lot.unit));
    v_remaining := v_remaining-v_take;
  end loop;
  if v_remaining > 0 then raise exception 'Eligible stock changed during allocation. Please retry.'; end if;
  return jsonb_build_object('reserved',v_qty,'allocations',v_allocations,'method','FEFO');
end;
$function$;

create or replace function public.inventory_link_lot_v1(p_payload jsonb)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_lot public.inventory_lots%rowtype;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select * into v_lot from public.inventory_lots where id=(p_payload->>'lot_id')::uuid for update;
  if not found then raise exception 'Inventory lot not found.'; end if;
  update public.inventory_lots set shipment_id=nullif(p_payload->>'shipment_id','')::uuid,deal_id=nullif(p_payload->>'deal_id','')::uuid,customer_id=nullif(p_payload->>'customer_id','')::uuid,owner_type=coalesce(nullif(p_payload->>'owner_type',''),owner_type),owner_name=coalesce(nullif(p_payload->>'owner_name',''),owner_name),updated_at=now() where id=v_lot.id;
  insert into public.inventory_events(lot_id,event_type,reference_no,reason,performed_by,metadata)
  values(v_lot.id,'linkage_updated',nullif(p_payload->>'reference_no',''),nullif(p_payload->>'reason',''),v_actor,jsonb_build_object('shipment_id',nullif(p_payload->>'shipment_id',''),'deal_id',nullif(p_payload->>'deal_id',''),'customer_id',nullif(p_payload->>'customer_id',''),'owner_type',nullif(p_payload->>'owner_type',''),'owner_name',nullif(p_payload->>'owner_name','')));
  return jsonb_build_object('updated',true,'lot_id',v_lot.id);
end;
$function$;

revoke all on function public.inventory_reserve_fefo_v1(jsonb) from public, anon;
revoke all on function public.inventory_link_lot_v1(jsonb) from public, anon;
grant execute on function public.inventory_reserve_fefo_v1(jsonb) to authenticated, service_role;
grant execute on function public.inventory_link_lot_v1(jsonb) to authenticated, service_role;