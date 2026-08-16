create or replace function public.inventory_link_lot_v1(p_payload jsonb)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_lot public.inventory_lots%rowtype;
  v_actor uuid := auth.uid();
  v_event_no text := 'EVT-' || to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS') || '-' || substr(gen_random_uuid()::text,1,8);
  v_event_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select * into v_lot from public.inventory_lots where id=(p_payload->>'lot_id')::uuid for update;
  if not found then raise exception 'Inventory lot not found.'; end if;
  update public.inventory_lots set shipment_id=nullif(p_payload->>'shipment_id','')::uuid,deal_id=nullif(p_payload->>'deal_id','')::uuid,customer_id=nullif(p_payload->>'customer_id','')::uuid,owner_type=coalesce(nullif(p_payload->>'owner_type',''),owner_type),owner_name=coalesce(nullif(p_payload->>'owner_name',''),owner_name),updated_at=now() where id=v_lot.id;
  insert into public.inventory_events(event_no,lot_id,event_type,reference_type,reference_no,reason,performed_by,metadata)
  values(v_event_no,v_lot.id,'linkage_updated','inventory_linkage',nullif(p_payload->>'reference_no',''),nullif(p_payload->>'reason',''),v_actor,jsonb_build_object('shipment_id',nullif(p_payload->>'shipment_id',''),'deal_id',nullif(p_payload->>'deal_id',''),'customer_id',nullif(p_payload->>'customer_id',''),'owner_type',nullif(p_payload->>'owner_type',''),'owner_name',nullif(p_payload->>'owner_name',''))) returning id into v_event_id;
  return jsonb_build_object('updated',true,'lot_id',v_lot.id,'event_id',v_event_id,'event_no',v_event_no);
end;
$function$;
revoke all on function public.inventory_link_lot_v1(jsonb) from public, anon;
grant execute on function public.inventory_link_lot_v1(jsonb) to authenticated, service_role;
