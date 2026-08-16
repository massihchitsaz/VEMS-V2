create or replace function public.inventory_guard_lot_balances_v3()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if current_setting('app.inventory_balance_write', true) is distinct from 'on' then
    if tg_op = 'INSERT' then
      if coalesce(new.qty_on_hand,0) <> 0 or coalesce(new.qty_reserved,0) <> 0 then
        raise exception 'Opening stock must be created through the inventory receipt workflow.';
      end if;
    else
      if new.qty_on_hand is distinct from old.qty_on_hand or new.qty_reserved is distinct from old.qty_reserved then
        raise exception 'Inventory balances can only be changed through controlled movement and reservation workflows.';
      end if;
      if new.item_id is distinct from old.item_id then
        raise exception 'The item assigned to an existing inventory lot cannot be changed.';
      end if;
      if new.warehouse_id is distinct from old.warehouse_id or new.location_id is distinct from old.location_id then
        raise exception 'Warehouse and location can only be changed through a controlled transfer movement.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.inventory_receive_stock_v3(p_payload jsonb)
returns jsonb
language plpgsql
set search_path to 'public'
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
  v_item public.inventory_items%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if v_item_id is null then raise exception 'Item is required.'; end if;
  if v_warehouse_id is null then raise exception 'Warehouse is required.'; end if;
  if v_qty <= 0 then raise exception 'Received quantity must be greater than zero.'; end if;

  select * into v_item from public.inventory_items where id=v_item_id and status='active';
  if not found then raise exception 'Active inventory item not found.'; end if;
  if not exists(select 1 from public.warehouses where id=v_warehouse_id and status='active') then raise exception 'Active warehouse not found.'; end if;

  if coalesce(v_item.lot_controlled,false) and nullif(trim(coalesce(p_payload->>'lot_no','')),'') is null and nullif(trim(coalesce(p_payload->>'batch_no','')),'') is null then
    raise exception 'Lot or batch number is required for this lot-controlled item.';
  end if;
  if coalesce(v_item.serial_controlled,false) and nullif(trim(coalesce(p_payload->>'serial_no','')),'') is null then
    raise exception 'Serial number is required for this serial-controlled item.';
  end if;
  if coalesce(v_item.expiry_controlled,false) and nullif(p_payload->>'expiry_date','') is null then
    raise exception 'Expiry date is required for this expiry-controlled item.';
  end if;

  if v_location_id is not null then
    select warehouse_id into v_location_warehouse
    from public.warehouse_locations
    where id=v_location_id and status in ('available','occupied');
    if v_location_warehouse is null then raise exception 'Warehouse location is not operationally available.'; end if;
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
set search_path to 'public'
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
    select warehouse_id into v_dest_warehouse
    from public.warehouse_locations
    where id=(p_payload->>'to_location_id')::uuid and status in ('available','occupied');
    if v_dest_warehouse is null then raise exception 'Destination location is not operationally available.'; end if;
    if (p_payload->>'to_location_id')::uuid = v_lot.location_id then raise exception 'Destination location must be different from the current location.'; end if;
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

revoke execute on function public.inventory_receive_stock_v3(jsonb) from public, anon;
grant execute on function public.inventory_receive_stock_v3(jsonb) to authenticated, service_role;
revoke execute on function public.inventory_add_movement_v2(jsonb) from public, anon;
grant execute on function public.inventory_add_movement_v2(jsonb) to authenticated, service_role;
