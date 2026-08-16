create or replace function public.shipment_transition_v1(p_shipment_id uuid,p_to_status text,p_reason text default null,p_override boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.shipments%rowtype; expected text; gate_name text; readiness jsonb; pct int;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.shipping_can_write() then raise exception 'Role % has read-only shipping access',public.shipping_current_role(); end if;
  select * into s from public.shipments where id=p_shipment_id for update;
  if not found then raise exception 'Shipment not found'; end if;
  if p_to_status not in ('planning','booked','picked_up','in_transit','customs','delivered','cancelled') then raise exception 'Invalid shipment status'; end if;
  if s.status=p_to_status then return jsonb_build_object('shipment_id',s.id,'from_status',s.status,'to_status',s.status,'changed',false); end if;
  expected:=case s.status when 'planning' then 'booked' when 'booked' then 'picked_up' when 'picked_up' then 'in_transit' when 'in_transit' then 'customs' when 'customs' then 'delivered' else null end;
  if p_to_status='cancelled' then
    if length(trim(coalesce(p_reason,'')))<5 then raise exception 'Cancellation reason is required'; end if;
  elsif p_to_status<>expected then
    if not p_override then raise exception 'Invalid transition from % to %. Expected next status: %',s.status,p_to_status,coalesce(expected,'none'); end if;
    if not public.shipping_can_override() then raise exception 'Manager override is required for skipped or backward transitions'; end if;
    if length(trim(coalesce(p_reason,'')))<8 then raise exception 'Override reason is required'; end if;
  end if;
  gate_name:=public.shipment_transition_gate(p_to_status);
  if gate_name is not null and not p_override then
    readiness:=public.shipping_gate_readiness_v1(p_shipment_id,gate_name);
    pct:=coalesce((readiness->>'completion_percent')::int,0);
    if readiness->>'gate_status'<>'ready' then raise exception 'Document gate % is blocked (% percent ready)',gate_name,pct; end if;
  elsif gate_name is not null then
    readiness:=public.shipping_gate_readiness_v1(p_shipment_id,gate_name);
    pct:=coalesce((readiness->>'completion_percent')::int,0);
  else pct:=100; end if;
  perform set_config('vtc.shipping_transition','1',true);
  update public.shipments set status=p_to_status,updated_at=now(),actual_delivery_date=case when p_to_status='delivered' then coalesce(actual_delivery_date,current_date) else actual_delivery_date end where id=p_shipment_id;
  perform set_config('vtc.shipping_transition','0',true);
  insert into public.shipment_status_events(shipment_id,from_status,to_status,gate,readiness_percent,override_used,reason,performed_by)
  values(p_shipment_id,s.status,p_to_status,gate_name,pct,p_override,trim(p_reason),auth.uid());
  return jsonb_build_object('shipment_id',p_shipment_id,'from_status',s.status,'to_status',p_to_status,'gate',gate_name,'readiness_percent',pct,'override_used',p_override,'changed',true);
exception when others then perform set_config('vtc.shipping_transition','0',true); raise; end $$;
revoke all on function public.shipment_transition_v1(uuid,text,text,boolean) from public,anon;
grant execute on function public.shipment_transition_v1(uuid,text,text,boolean) to authenticated,service_role;
