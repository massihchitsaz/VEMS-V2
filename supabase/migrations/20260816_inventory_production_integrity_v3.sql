alter table public.inventory_lots
  add constraint inventory_lots_qty_on_hand_nonnegative check (qty_on_hand >= 0),
  add constraint inventory_lots_qty_reserved_nonnegative check (qty_reserved >= 0),
  add constraint inventory_lots_reserved_not_over_on_hand check (qty_reserved <= qty_on_hand);

create index if not exists idx_inventory_lots_item_id on public.inventory_lots(item_id);
create index if not exists idx_inventory_lots_warehouse_id on public.inventory_lots(warehouse_id);
create index if not exists idx_inventory_lots_location_id on public.inventory_lots(location_id);
create index if not exists idx_inventory_lots_shipment_id on public.inventory_lots(shipment_id);
create index if not exists idx_inventory_movements_lot_created on public.inventory_movements(lot_id, created_at desc);
create index if not exists idx_inventory_reservations_lot_status on public.inventory_reservations(lot_id, status);

create or replace function public.inventory_guard_lot_balances_v3()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('app.inventory_balance_write', true) is distinct from 'on' then
    if tg_op = 'INSERT' then
      if coalesce(new.qty_on_hand,0) <> 0 or coalesce(new.qty_reserved,0) <> 0 then
        raise exception 'Opening stock must be created through the inventory receipt workflow.';
      end if;
    elsif new.qty_on_hand is distinct from old.qty_on_hand or new.qty_reserved is distinct from old.qty_reserved then
      raise exception 'Inventory balances can only be changed through controlled movement and reservation workflows.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_inventory_guard_lot_balances_v3 on public.inventory_lots;
create trigger trg_inventory_guard_lot_balances_v3
before insert or update of qty_on_hand, qty_reserved on public.inventory_lots
for each row execute function public.inventory_guard_lot_balances_v3();

create or replace function public.inventory_receive_stock_v3(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_item_id uuid := nullif(p_payload->>'item_id','')::uuid;
  v_warehouse_id uuid := nullif(p_payload->>'warehouse_id','')::uuid;
  v_location_id uuid := nullif(p_payload->>'location_id','')::uuid;
  v_qty numeric := coalesce((p_payload->>'qty_on_hand')::numeric,0);
  v_unit text := coalesce(nullif(p_payload->>'unit',''),'KG');
  v_lot_id uuid;
  v_movement_id uuid;
  v_movement_no text := 'MOV-' || to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS') || '-' || substr(gen_random_uuid()::text,1,8);
  v_location_warehouse uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if v_item_id is null then raise exception 'Item is required.'; end if;
  if v_warehouse_id is null then raise exception 'Warehouse is required.'; end if;
  if v_qty <= 0 then raise exception 'Received quantity must be greater than zero.'; end if;
  if not exists(select 1 from public.inventory_items where id=v_item_id and status='active') then raise exception 'Active inventory item not found.'; end if;
  if not exists(select 1 from public.warehouses where id=v_warehouse_id and status='active') then raise exception 'Active warehouse not found.'; end if;
  if v_location_id is not null then
    select warehouse_id into v_location_warehouse from public.warehouse_locations where id=v_location_id and status <> 'blocked';
    if v_location_warehouse is null then raise exception 'Warehouse location not found or blocked.'; end if;
    if v_location_warehouse <> v_warehouse_id then raise exception 'Selected location does not belong to the selected warehouse.'; end if;
  end if;

  perform set_config('app.inventory_balance_write','on',true);

  insert into public.inventory_lots(
    item_id,warehouse_id,location_id,shipment_id,lot_no,batch_no,serial_no,container_no,package_ref,
    production_date,expiry_date,received_date,condition_status,stock_status,qty_on_hand,qty_reserved,unit,
    gross_weight_kg,net_weight_kg,volume_cbm,owner_type,owner_name,customs_status,notes
  ) values (
    v_item_id,v_warehouse_id,v_location_id,nullif(p_payload->>'shipment_id','')::uuid,
    nullif(p_payload->>'lot_no',''),nullif(p_payload->>'batch_no',''),nullif(p_payload->>'serial_no',''),nullif(p_payload->>'container_no',''),nullif(p_payload->>'package_ref',''),
    nullif(p_payload->>'production_date','')::date,nullif(p_payload->>'expiry_date','')::date,coalesce(nullif(p_payload->>'received_date','')::date,current_date),
    coalesce(nullif(p_payload->>'condition_status',''),'good'),coalesce(nullif(p_payload->>'stock_status',''),'available'),0,0,v_unit,
    nullif(p_payload->>'gross_weight_kg','')::numeric,nullif(p_payload->>'net_weight_kg','')::numeric,nullif(p_payload->>'volume_cbm','')::numeric,
    coalesce(nullif(p_payload->>'owner_type',''),'vtc'),nullif(p_payload->>'owner_name',''),nullif(p_payload->>'customs_status',''),nullif(p_payload->>'notes','')
  ) returning id into v_lot_id;

  insert into public.inventory_movements(
    movement_no,movement_type,lot_id,from_location_id,to_location_id,quantity,unit,reference_type,reference_id,reference_no,reason,performed_by
  ) values (
    v_movement_no,'receipt',v_lot_id,null,v_location_id,v_qty,v_unit,
    coalesce(nullif(p_payload->>'reference_type',''),case when nullif(p_payload->>'shipment_id','') is not null then 'shipment' else 'receipt' end),
    nullif(p_payload->>'shipment_id','')::uuid,nullif(p_payload->>'reference_no',''),coalesce(nullif(p_payload->>'reason',''),'Opening receipt'),v_user
  ) returning id into v_movement_id;

  update public.inventory_lots set qty_on_hand=v_qty,updated_at=now() where id=v_lot_id;

  return jsonb_build_object('lot_id',v_lot_id,'movement_id',v_movement_id,'movement_no',v_movement_no,'qty_on_hand',v_qty);
end;
$$;

create or replace function public.inventory_add_movement_v2(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_lot public.inventory_lots%rowtype;
  v_type text := coalesce(nullif(trim(p_payload->>'movement_type'),''),'receipt');
  v_qty numeric := coalesce((p_payload->>'quantity')::numeric,0);
  v_on numeric;
  v_available numeric;
  v_location uuid;
  v_warehouse uuid;
  v_status text;
  v_dest_warehouse uuid;
  v_movement_no text := 'MOV-' || to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS') || '-' || substr(gen_random_uuid()::text,1,8);
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if v_qty <= 0 then raise exception 'Movement quantity must be greater than zero.'; end if;
  select * into v_lot from public.inventory_lots where id=(p_payload->>'lot_id')::uuid for update;
  if not found then raise exception 'Inventory lot not found.'; end if;
  v_on := coalesce(v_lot.qty_on_hand,0);
  v_available := v_on - coalesce(v_lot.qty_reserved,0);
  v_location := v_lot.location_id;
  v_warehouse := v_lot.warehouse_id;
  v_status := v_lot.stock_status;

  if v_type in ('issue','damage') then
    if v_qty > v_available then raise exception 'Insufficient available stock.'; end if;
    v_on := v_on - v_qty;
    if v_type='damage' then v_status := case when v_on=0 then 'damaged' else v_status end; end if;
  elsif v_type='receipt' then
    v_on := v_on + v_qty;
  elsif v_type='adjustment' then
    if v_qty < coalesce(v_lot.qty_reserved,0) then raise exception 'Adjusted stock cannot be below reserved quantity.'; end if;
    v_on := v_qty;
  elsif v_type='transfer' then
    if nullif(p_payload->>'to_location_id','') is null then raise exception 'Destination location is required for transfer.'; end if;
    select warehouse_id into v_dest_warehouse from public.warehouse_locations where id=(p_payload->>'to_location_id')::uuid and status <> 'blocked';
    if v_dest_warehouse is null then raise exception 'Destination location not found or blocked.'; end if;
    v_location := (p_payload->>'to_location_id')::uuid;
    v_warehouse := v_dest_warehouse;
  elsif v_type='quarantine' then
    if v_qty <> v_on then raise exception 'Quarantine currently applies to the full lot; use the full on-hand quantity.'; end if;
    v_status := 'quarantine';
  elsif v_type='repack' then
    null;
  else
    raise exception 'Unsupported movement type: %', v_type;
  end if;

  perform set_config('app.inventory_balance_write','on',true);

  insert into public.inventory_movements(movement_no,movement_type,lot_id,from_location_id,to_location_id,quantity,unit,reference_type,reference_id,reference_no,reason,performed_by)
  values(v_movement_no,v_type,v_lot.id,nullif(p_payload->>'from_location_id','')::uuid,nullif(p_payload->>'to_location_id','')::uuid,v_qty,coalesce(nullif(p_payload->>'unit',''),v_lot.unit),nullif(p_payload->>'reference_type',''),nullif(p_payload->>'reference_id','')::uuid,nullif(p_payload->>'reference_no',''),nullif(p_payload->>'reason',''),coalesce(nullif(p_payload->>'performed_by','')::uuid,auth.uid()))
  returning id into v_id;

  update public.inventory_lots set qty_on_hand=v_on,warehouse_id=v_warehouse,location_id=v_location,stock_status=v_status,updated_at=now() where id=v_lot.id;
  return jsonb_build_object('id',v_id,'movement_no',v_movement_no,'qty_on_hand',v_on,'stock_status',v_status,'warehouse_id',v_warehouse,'location_id',v_location);
end;
$$;

create or replace function public.inventory_add_reservation_v2(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_lot public.inventory_lots%rowtype;
  v_qty numeric := coalesce((p_payload->>'quantity')::numeric,0);
  v_available numeric;
  v_no text := 'RES-' || to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS') || '-' || substr(gen_random_uuid()::text,1,8);
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if v_qty <= 0 then raise exception 'Reservation quantity must be greater than zero.'; end if;
  select * into v_lot from public.inventory_lots where id=(p_payload->>'lot_id')::uuid for update;
  if not found then raise exception 'Inventory lot not found.'; end if;
  v_available := coalesce(v_lot.qty_on_hand,0)-coalesce(v_lot.qty_reserved,0);
  if v_qty > v_available then raise exception 'Reservation exceeds available stock.'; end if;
  if v_lot.stock_status in ('hold','damaged','quarantine') or v_lot.condition_status <> 'good' then raise exception 'This lot is not available for reservation.'; end if;

  perform set_config('app.inventory_balance_write','on',true);

  insert into public.inventory_reservations(reservation_no,lot_id,quantity,unit,deal_id,shipment_id,customer_id,status,reserved_by,expires_at,notes)
  values(v_no,v_lot.id,v_qty,coalesce(nullif(p_payload->>'unit',''),v_lot.unit),nullif(p_payload->>'deal_id','')::uuid,nullif(p_payload->>'shipment_id','')::uuid,nullif(p_payload->>'customer_id','')::uuid,'active',coalesce(nullif(p_payload->>'reserved_by','')::uuid,auth.uid()),nullif(p_payload->>'expires_at','')::timestamptz,nullif(p_payload->>'notes',''))
  returning id into v_id;
  update public.inventory_lots set qty_reserved=coalesce(qty_reserved,0)+v_qty,stock_status='reserved',updated_at=now() where id=v_lot.id;
  return jsonb_build_object('id',v_id,'reservation_no',v_no,'qty_reserved',coalesce(v_lot.qty_reserved,0)+v_qty);
end;
$$;

create or replace function public.inventory_release_reservation_v2(p_reservation_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_r public.inventory_reservations%rowtype;
  v_lot public.inventory_lots%rowtype;
  v_next numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_r from public.inventory_reservations where id=p_reservation_id for update;
  if not found then raise exception 'Reservation not found.'; end if;
  if v_r.status <> 'active' then return jsonb_build_object('status',v_r.status,'released',false); end if;
  select * into v_lot from public.inventory_lots where id=v_r.lot_id for update;
  if not found then raise exception 'Inventory lot not found.'; end if;
  v_next := greatest(0,coalesce(v_lot.qty_reserved,0)-coalesce(v_r.quantity,0));

  perform set_config('app.inventory_balance_write','on',true);

  update public.inventory_reservations set status='released',updated_at=now() where id=v_r.id;
  update public.inventory_lots set qty_reserved=v_next,stock_status=case when v_next>0 then 'reserved' when stock_status='reserved' then 'available' else stock_status end,updated_at=now() where id=v_lot.id;
  return jsonb_build_object('released',true,'qty_reserved',v_next);
end;
$$;

revoke execute on function public.inventory_receive_stock_v3(jsonb) from public, anon;
revoke execute on function public.inventory_add_movement_v2(jsonb) from public, anon;
revoke execute on function public.inventory_add_reservation_v2(jsonb) from public, anon;
revoke execute on function public.inventory_release_reservation_v2(uuid) from public, anon;
grant execute on function public.inventory_receive_stock_v3(jsonb) to authenticated, service_role;
grant execute on function public.inventory_add_movement_v2(jsonb) to authenticated, service_role;
grant execute on function public.inventory_add_reservation_v2(jsonb) to authenticated, service_role;
grant execute on function public.inventory_release_reservation_v2(uuid) to authenticated, service_role;
