create table if not exists public.inventory_events (
  id uuid primary key default gen_random_uuid(),
  event_no text not null unique,
  lot_id uuid not null references public.inventory_lots(id),
  event_type text not null check (event_type in ('hold','release_hold','reservation_fulfilled')),
  reference_type text,
  reference_id uuid,
  reference_no text,
  reason text,
  performed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists inventory_events_lot_created_idx on public.inventory_events(lot_id, created_at desc);
create index if not exists inventory_events_type_created_idx on public.inventory_events(event_type, created_at desc);

alter table public.inventory_events enable row level security;

drop policy if exists "inventory_events_select_authenticated" on public.inventory_events;
create policy "inventory_events_select_authenticated" on public.inventory_events
for select to authenticated using (true);

revoke all on table public.inventory_events from anon;
grant select on table public.inventory_events to authenticated, service_role;

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
      if new.stock_status is distinct from old.stock_status then
        raise exception 'Stock status can only be changed through controlled inventory workflows.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.inventory_set_lot_hold_v1(p_lot_id uuid, p_hold boolean, p_reason text, p_reference_no text default null)
returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_lot public.inventory_lots%rowtype;
  v_event_no text := 'EVT-' || to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS') || '-' || substr(gen_random_uuid()::text,1,8);
  v_next_status text;
  v_event_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Reason is required.'; end if;
  select * into v_lot from public.inventory_lots where id=p_lot_id for update;
  if not found then raise exception 'Inventory lot not found.'; end if;
  if coalesce(v_lot.qty_on_hand,0) <= 0 then raise exception 'Cannot change hold state for a zero-balance lot.'; end if;
  if p_hold then
    if v_lot.stock_status in ('damaged','quarantine') or v_lot.condition_status <> 'good' then raise exception 'Damaged, quarantined or non-good stock cannot be placed on operational hold.'; end if;
    if v_lot.stock_status='hold' then return jsonb_build_object('changed',false,'status','hold'); end if;
    v_next_status := 'hold';
  else
    if v_lot.stock_status <> 'hold' then return jsonb_build_object('changed',false,'status',v_lot.stock_status); end if;
    v_next_status := case when coalesce(v_lot.qty_reserved,0)>0 then 'reserved' else 'available' end;
  end if;
  perform set_config('app.inventory_balance_write','on',true);
  update public.inventory_lots set stock_status=v_next_status, updated_at=now() where id=v_lot.id;
  insert into public.inventory_events(event_no,lot_id,event_type,reference_type,reference_no,reason,performed_by)
  values(v_event_no,v_lot.id,case when p_hold then 'hold' else 'release_hold' end,'inventory_hold',nullif(p_reference_no,''),p_reason,auth.uid())
  returning id into v_event_id;
  return jsonb_build_object('changed',true,'status',v_next_status,'event_id',v_event_id,'event_no',v_event_no);
end;
$$;

create or replace function public.inventory_fulfill_reservation_v1(p_reservation_id uuid, p_reference_no text default null, p_reason text default null)
returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_r public.inventory_reservations%rowtype;
  v_lot public.inventory_lots%rowtype;
  v_next_reserved numeric;
  v_next_on numeric;
  v_next_status text;
  v_movement_no text := 'MOV-' || to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS') || '-' || substr(gen_random_uuid()::text,1,8);
  v_event_no text := 'EVT-' || to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS') || '-' || substr(gen_random_uuid()::text,1,8);
  v_movement_id uuid;
  v_event_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_r from public.inventory_reservations where id=p_reservation_id for update;
  if not found then raise exception 'Reservation not found.'; end if;
  if v_r.status <> 'active' then raise exception 'Only active reservations can be fulfilled.'; end if;
  if v_r.expires_at is not null and v_r.expires_at < now() then raise exception 'Reservation has expired and must be released or recreated.'; end if;
  select * into v_lot from public.inventory_lots where id=v_r.lot_id for update;
  if not found then raise exception 'Inventory lot not found.'; end if;
  if v_lot.stock_status in ('hold','damaged','quarantine') or v_lot.condition_status <> 'good' then raise exception 'Reserved stock is not operationally releasable for fulfillment.'; end if;
  if coalesce(v_lot.qty_reserved,0) < v_r.quantity then raise exception 'Lot reserved balance is lower than the reservation quantity.'; end if;
  if coalesce(v_lot.qty_on_hand,0) < v_r.quantity then raise exception 'Lot on-hand balance is lower than the reservation quantity.'; end if;
  v_next_reserved := coalesce(v_lot.qty_reserved,0)-v_r.quantity;
  v_next_on := coalesce(v_lot.qty_on_hand,0)-v_r.quantity;
  v_next_status := case when v_next_reserved>0 then 'reserved' else 'available' end;
  perform set_config('app.inventory_balance_write','on',true);
  update public.inventory_reservations set status='fulfilled', updated_at=now() where id=v_r.id;
  update public.inventory_lots set qty_reserved=v_next_reserved, qty_on_hand=v_next_on, stock_status=v_next_status, updated_at=now() where id=v_lot.id;
  insert into public.inventory_movements(movement_no,movement_type,lot_id,from_location_id,to_location_id,quantity,unit,reference_type,reference_id,reference_no,reason,performed_by)
  values(v_movement_no,'issue',v_lot.id,v_lot.location_id,null,v_r.quantity,v_r.unit,'reservation',v_r.id,coalesce(nullif(p_reference_no,''),v_r.reservation_no),coalesce(nullif(p_reason,''),'Reservation fulfillment'),auth.uid())
  returning id into v_movement_id;
  insert into public.inventory_events(event_no,lot_id,event_type,reference_type,reference_id,reference_no,reason,performed_by)
  values(v_event_no,v_lot.id,'reservation_fulfilled','reservation',v_r.id,coalesce(nullif(p_reference_no,''),v_r.reservation_no),coalesce(nullif(p_reason,''),'Reservation fulfilled'),auth.uid())
  returning id into v_event_id;
  return jsonb_build_object('fulfilled',true,'reservation_id',v_r.id,'movement_id',v_movement_id,'movement_no',v_movement_no,'event_id',v_event_id,'event_no',v_event_no,'qty_on_hand',v_next_on,'qty_reserved',v_next_reserved,'stock_status',v_next_status);
end;
$$;

revoke execute on function public.inventory_set_lot_hold_v1(uuid,boolean,text,text) from public, anon;
grant execute on function public.inventory_set_lot_hold_v1(uuid,boolean,text,text) to authenticated, service_role;
revoke execute on function public.inventory_fulfill_reservation_v1(uuid,text,text) from public, anon;
grant execute on function public.inventory_fulfill_reservation_v1(uuid,text,text) to authenticated, service_role;
