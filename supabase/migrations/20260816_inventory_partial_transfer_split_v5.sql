alter table public.inventory_movements
  add column if not exists destination_lot_id uuid references public.inventory_lots(id);

create index if not exists idx_inventory_movements_destination_lot_id
  on public.inventory_movements(destination_lot_id)
  where destination_lot_id is not null;

create or replace function public.inventory_add_movement_v2(p_payload jsonb)
returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_lot public.inventory_lots%rowtype;
  v_item public.inventory_items%rowtype;
  v_type text := coalesce(nullif(trim(p_payload->>'movement_type'),''),'receipt');
  v_qty numeric := coalesce((p_payload->>'quantity')::numeric,0);
  v_on numeric;
  v_reserved numeric;
  v_available numeric;
  v_location uuid;
  v_warehouse uuid;
  v_status text;
  v_dest_warehouse uuid;
  v_dest_location uuid;
  v_destination_lot_id uuid;
  v_transfer_mode text;
  v_movement_no text := 'MOV-' || to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS') || '-' || substr(gen_random_uuid()::text,1,8);
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if v_qty <= 0 then raise exception 'Movement quantity must be greater than zero.'; end if;

  select * into v_lot from public.inventory_lots where id=(p_payload->>'lot_id')::uuid for update;
  if not found then raise exception 'Inventory lot not found.'; end if;
  select * into v_item from public.inventory_items where id=v_lot.item_id;
  if not found then raise exception 'Inventory item not found.'; end if;

  v_on := coalesce(v_lot.qty_on_hand,0);
  v_reserved := coalesce(v_lot.qty_reserved,0);
  v_available := v_on-v_reserved;
  v_location := v_lot.location_id;
  v_warehouse := v_lot.warehouse_id;
  v_status := v_lot.stock_status;

  if v_type in ('issue','damage') then
    if v_qty > v_available then raise exception 'Insufficient available stock.'; end if;
    v_on := v_on-v_qty;
    if v_type='damage' and v_on=0 then v_status := 'damaged'; end if;
  elsif v_type='receipt' then
    v_on := v_on+v_qty;
  elsif v_type='adjustment' then
    if v_qty < v_reserved then raise exception 'Adjusted stock cannot be below reserved quantity.'; end if;
    v_on := v_qty;
  elsif v_type='transfer' then
    if nullif(p_payload->>'to_location_id','') is null then raise exception 'Destination location is required for transfer.'; end if;
    v_dest_location := (p_payload->>'to_location_id')::uuid;
    select warehouse_id into v_dest_warehouse from public.warehouse_locations where id=v_dest_location and status in ('available','occupied');
    if v_dest_warehouse is null then raise exception 'Destination location is not operationally available.'; end if;
    if v_dest_location=v_lot.location_id then raise exception 'Destination location must be different from the current location.'; end if;
    if v_qty>v_on then raise exception 'Transfer quantity cannot exceed on-hand stock.'; end if;

    if v_qty=v_on then
      v_transfer_mode := 'full';
      v_location := v_dest_location;
      v_warehouse := v_dest_warehouse;
      v_destination_lot_id := v_lot.id;
    else
      if v_qty>v_available then raise exception 'Partial transfer cannot include reserved stock. Maximum transferable quantity is %.',v_available; end if;
      if coalesce(v_item.serial_controlled,false) then raise exception 'Serial-controlled stock cannot be split. Transfer the full lot.'; end if;
      v_transfer_mode := 'partial_split';
      perform set_config('app.inventory_balance_write','on',true);
      insert into public.inventory_lots(
        item_id,warehouse_id,location_id,shipment_id,lot_no,batch_no,serial_no,container_no,package_ref,
        production_date,expiry_date,received_date,condition_status,stock_status,qty_on_hand,qty_reserved,unit,
        gross_weight_kg,net_weight_kg,volume_cbm,owner_type,owner_name,customs_status,notes
      ) values (
        v_lot.item_id,v_dest_warehouse,v_dest_location,v_lot.shipment_id,v_lot.lot_no,v_lot.batch_no,null,v_lot.container_no,v_lot.package_ref,
        v_lot.production_date,v_lot.expiry_date,v_lot.received_date,v_lot.condition_status,
        case when v_lot.condition_status='good' then 'available' else v_lot.stock_status end,
        v_qty,0,v_lot.unit,
        case when v_on>0 and v_lot.gross_weight_kg is not null then round(v_lot.gross_weight_kg*(v_qty/v_on),6) else null end,
        case when v_on>0 and v_lot.net_weight_kg is not null then round(v_lot.net_weight_kg*(v_qty/v_on),6) else null end,
        case when v_on>0 and v_lot.volume_cbm is not null then round(v_lot.volume_cbm*(v_qty/v_on),6) else null end,
        v_lot.owner_type,v_lot.owner_name,v_lot.customs_status,
        concat_ws(E'\n',nullif(v_lot.notes,''),'Split from lot '||v_lot.id::text||' by transfer '||v_movement_no)
      ) returning id into v_destination_lot_id;
      v_on := v_on-v_qty;
      v_status := case when v_reserved>0 then 'reserved' else v_lot.stock_status end;
    end if;
  elsif v_type='quarantine' then
    if v_qty<>v_on then raise exception 'Quarantine currently applies to the full lot; use the full on-hand quantity.'; end if;
    v_status := 'quarantine';
  elsif v_type='repack' then
    null;
  else
    raise exception 'Unsupported movement type: %',v_type;
  end if;

  perform set_config('app.inventory_balance_write','on',true);
  insert into public.inventory_movements(
    movement_no,movement_type,lot_id,destination_lot_id,from_location_id,to_location_id,quantity,unit,
    reference_type,reference_id,reference_no,reason,performed_by
  ) values (
    v_movement_no,v_type,v_lot.id,v_destination_lot_id,
    nullif(p_payload->>'from_location_id','')::uuid,nullif(p_payload->>'to_location_id','')::uuid,
    v_qty,coalesce(nullif(p_payload->>'unit',''),v_lot.unit),
    nullif(p_payload->>'reference_type',''),nullif(p_payload->>'reference_id','')::uuid,
    nullif(p_payload->>'reference_no',''),nullif(p_payload->>'reason',''),
    coalesce(nullif(p_payload->>'performed_by','')::uuid,auth.uid())
  ) returning id into v_id;

  if v_type='transfer' and v_transfer_mode='partial_split' then
    update public.inventory_lots
    set qty_on_hand=v_on,
        stock_status=v_status,
        gross_weight_kg=case when gross_weight_kg is not null and coalesce(v_lot.qty_on_hand,0)>0 then round(v_lot.gross_weight_kg*(v_on/v_lot.qty_on_hand),6) else gross_weight_kg end,
        net_weight_kg=case when net_weight_kg is not null and coalesce(v_lot.qty_on_hand,0)>0 then round(v_lot.net_weight_kg*(v_on/v_lot.qty_on_hand),6) else net_weight_kg end,
        volume_cbm=case when volume_cbm is not null and coalesce(v_lot.qty_on_hand,0)>0 then round(v_lot.volume_cbm*(v_on/v_lot.qty_on_hand),6) else volume_cbm end,
        updated_at=now()
    where id=v_lot.id;
  else
    update public.inventory_lots set qty_on_hand=v_on,warehouse_id=v_warehouse,location_id=v_location,stock_status=v_status,updated_at=now() where id=v_lot.id;
  end if;

  return jsonb_build_object(
    'id',v_id,'movement_no',v_movement_no,'qty_on_hand',v_on,'stock_status',v_status,
    'warehouse_id',case when v_type='transfer' and v_transfer_mode='partial_split' then v_lot.warehouse_id else v_warehouse end,
    'location_id',case when v_type='transfer' and v_transfer_mode='partial_split' then v_lot.location_id else v_location end,
    'destination_lot_id',v_destination_lot_id,'transfer_mode',v_transfer_mode
  );
end;
$$;

revoke execute on function public.inventory_add_movement_v2(jsonb) from public, anon;
grant execute on function public.inventory_add_movement_v2(jsonb) to authenticated, service_role;
