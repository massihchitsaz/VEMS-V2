create table if not exists public.quotation_events (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  revision integer,
  details jsonb not null default '{}'::jsonb,
  performed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.quotation_events enable row level security;
drop policy if exists quotation_events_read on public.quotation_events;
create policy quotation_events_read on public.quotation_events for select to authenticated using (true);

create or replace function public.quotation_current_role()
returns text language sql stable security definer set search_path=public as $$
  select coalesce((select role::text from public.profiles where id=auth.uid()),'unknown')
$$;
create or replace function public.quotation_can_control()
returns boolean language sql stable security definer set search_path=public as $$
  select public.quotation_current_role() in ('admin','ceo','manager')
$$;

create or replace function public.save_quotation_v3(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_user uuid := auth.uid(); v_role text; v_id uuid; v_existing public.quotations%rowtype; v_quote public.quotations%rowtype;
  v_revision integer := 1; v_no text := nullif(btrim(coalesce(p_payload->>'quotation_no','')),'');
  v_status text := coalesce(nullif(p_payload->>'status',''),'draft'); v_lines jsonb := coalesce(p_payload->'lines','[]'::jsonb);
  v_subtotal numeric := 0; v_total numeric := 0; v_margin numeric := 0; v_line jsonb; v_line_no integer := 0;
  v_qty numeric; v_cost numeric; v_sell numeric; v_is_update boolean := false;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  v_role := public.quotation_current_role();
  if v_role not in ('admin','ceo','manager','dealer','operations','logistics') then raise exception 'Role % has read-only quotation access', v_role; end if;
  if v_status not in ('draft','sent','review','accepted','rejected','expired','awarded') then raise exception 'Invalid quotation status'; end if;
  if v_status <> 'draft' and v_no is null then raise exception 'Enter a quotation number before moving the quotation out of Draft status.'; end if;
  if v_status <> 'draft' and nullif(p_payload->>'customer_id','') is null then raise exception 'Customer is required before leaving Draft status.'; end if;
  if v_status <> 'draft' and btrim(coalesce(p_payload->>'title',''))='' then raise exception 'Quotation title is required before leaving Draft status.'; end if;
  if nullif(p_payload->>'id','') is not null then
    v_id := (p_payload->>'id')::uuid; select * into v_existing from public.quotations where id=v_id for update;
    if not found then raise exception 'Quotation not found'; end if;
    if not public.quotation_can_control() and coalesce(v_existing.owner_id,v_existing.created_by) <> v_user then raise exception 'You do not have permission to edit this quotation.'; end if;
    v_is_update := true; v_revision := coalesce(v_existing.revision,1)+1;
  end if;
  if v_no is not null and exists(select 1 from public.quotations q where q.quotation_no=v_no and (not v_is_update or q.id<>v_id)) then raise exception 'Quotation number % is already in use.', v_no; end if;
  for v_line in select * from jsonb_array_elements(v_lines) loop
    if btrim(coalesce(v_line->>'description','')) <> '' then
      v_qty := coalesce((v_line->>'qty')::numeric,1); v_cost := coalesce((v_line->>'cost')::numeric,0); v_sell := coalesce((v_line->>'sell')::numeric,0);
      if v_qty < 0 or v_cost < 0 or v_sell < 0 then raise exception 'Quotation quantities and rates cannot be negative.'; end if;
      v_subtotal := v_subtotal + v_qty*v_cost; v_total := v_total + v_qty*v_sell; v_line_no := v_line_no + 1;
    end if;
  end loop;
  if v_status <> 'draft' and v_line_no=0 then raise exception 'At least one quotation line is required.'; end if;
  if v_total<>0 then v_margin:=((v_total-v_subtotal)/v_total)*100; end if;
  if v_is_update then
    update public.quotations set quotation_no=v_no,quotation_type=coalesce(p_payload->>'quotation_type','trading'),customer_id=nullif(p_payload->>'customer_id','')::uuid,supplier_id=nullif(p_payload->>'supplier_id','')::uuid,opportunity_id=nullif(p_payload->>'opportunity_id','')::uuid,title=coalesce(nullif(btrim(p_payload->>'title'),''),'Untitled quotation'),contact_person=nullif(p_payload->>'contact_person',''),currency=coalesce(nullif(p_payload->>'currency',''),'AED'),subtotal=v_subtotal,margin_percent=v_margin,total_amount=v_total,status=v_status,valid_until=nullif(p_payload->>'valid_until','')::date,route=nullif(concat_ws(' → ',nullif(p_payload->>'origin',''),nullif(p_payload->>'destination','')),''),incoterm=nullif(p_payload->>'incoterm',''),payment_terms=nullif(p_payload->>'payment_terms',''),origin=nullif(p_payload->>'origin',''),destination=nullif(p_payload->>'destination',''),mode=nullif(p_payload->>'mode',''),commodity=nullif(p_payload->>'commodity',''),hs_code=nullif(p_payload->>'hs_code',''),packing_details=nullif(p_payload->>'packing_details',''),gross_weight=nullif(p_payload->>'gross_weight',''),volume_details=nullif(p_payload->>'volume_details',''),notes=nullif(p_payload->>'notes',''),revision=v_revision,updated_at=now() where id=v_id returning * into v_quote;
    delete from public.quotation_items where quotation_id=v_id;
  else
    insert into public.quotations(quotation_no,quotation_type,customer_id,supplier_id,opportunity_id,title,contact_person,currency,subtotal,margin_percent,total_amount,status,valid_until,route,incoterm,payment_terms,origin,destination,mode,commodity,hs_code,packing_details,gross_weight,volume_details,notes,owner_id,created_by,revision)
    values(v_no,coalesce(p_payload->>'quotation_type','trading'),nullif(p_payload->>'customer_id','')::uuid,nullif(p_payload->>'supplier_id','')::uuid,nullif(p_payload->>'opportunity_id','')::uuid,coalesce(nullif(btrim(p_payload->>'title'),''),'Untitled quotation'),nullif(p_payload->>'contact_person',''),coalesce(nullif(p_payload->>'currency',''),'AED'),v_subtotal,v_margin,v_total,v_status,nullif(p_payload->>'valid_until','')::date,nullif(concat_ws(' → ',nullif(p_payload->>'origin',''),nullif(p_payload->>'destination','')),''),nullif(p_payload->>'incoterm',''),nullif(p_payload->>'payment_terms',''),nullif(p_payload->>'origin',''),nullif(p_payload->>'destination',''),nullif(p_payload->>'mode',''),nullif(p_payload->>'commodity',''),nullif(p_payload->>'hs_code',''),nullif(p_payload->>'packing_details',''),nullif(p_payload->>'gross_weight',''),nullif(p_payload->>'volume_details',''),nullif(p_payload->>'notes',''),v_user,v_user,1) returning * into v_quote;
    v_id:=v_quote.id;
  end if;
  v_line_no:=0;
  for v_line in select * from jsonb_array_elements(v_lines) loop
    if btrim(coalesce(v_line->>'description','')) <> '' then
      v_line_no:=v_line_no+1;
      insert into public.quotation_items(quotation_id,line_no,description,quantity,unit,unit_cost,unit_sell) values(v_id,v_line_no,btrim(v_line->>'description'),coalesce((v_line->>'qty')::numeric,1),coalesce(nullif(v_line->>'unit',''),'Unit'),coalesce((v_line->>'cost')::numeric,0),coalesce((v_line->>'sell')::numeric,0));
    end if;
  end loop;
  insert into public.quotation_versions(quotation_id,revision,snapshot,created_by) values(v_id,v_revision,p_payload || jsonb_build_object('subtotal',v_subtotal,'total_amount',v_total,'margin_percent',v_margin),v_user);
  insert into public.quotation_events(quotation_id,event_type,from_status,to_status,revision,details,performed_by) values(v_id,case when v_is_update then 'saved_revision' else 'created' end,case when v_is_update then v_existing.status else null end,v_status,v_revision,jsonb_build_object('quotation_no',v_no,'total_amount',v_total,'margin_percent',v_margin),v_user);
  return to_jsonb(v_quote);
end; $$;

revoke all on function public.save_quotation_v2(jsonb) from public,anon,authenticated;
revoke all on function public.save_quotation_v3(jsonb) from public,anon;
grant execute on function public.save_quotation_v3(jsonb) to authenticated,service_role;
revoke all on function public.quotation_current_role() from public,anon;
grant execute on function public.quotation_current_role() to authenticated,service_role;
revoke all on function public.quotation_can_control() from public,anon;
grant execute on function public.quotation_can_control() to authenticated,service_role;

drop policy if exists authenticated_insert on public.quotations;
drop policy if exists authenticated_update on public.quotations;
create policy quotation_insert_owned on public.quotations for insert to authenticated with check (auth.uid() is not null and (created_by=auth.uid() or owner_id=auth.uid() or public.quotation_can_control()));
create policy quotation_update_owned on public.quotations for update to authenticated using (owner_id=auth.uid() or created_by=auth.uid() or public.quotation_can_control()) with check (owner_id=auth.uid() or created_by=auth.uid() or public.quotation_can_control());
drop policy if exists quotation_items_insert on public.quotation_items;
drop policy if exists quotation_items_update on public.quotation_items;
drop policy if exists quotation_items_delete on public.quotation_items;
create policy quotation_items_insert_owned on public.quotation_items for insert to authenticated with check (exists(select 1 from public.quotations q where q.id=quotation_id and (q.owner_id=auth.uid() or q.created_by=auth.uid() or public.quotation_can_control())));
create policy quotation_items_update_owned on public.quotation_items for update to authenticated using (exists(select 1 from public.quotations q where q.id=quotation_id and (q.owner_id=auth.uid() or q.created_by=auth.uid() or public.quotation_can_control()))) with check (exists(select 1 from public.quotations q where q.id=quotation_id and (q.owner_id=auth.uid() or q.created_by=auth.uid() or public.quotation_can_control())));
create policy quotation_items_delete_owned on public.quotation_items for delete to authenticated using (exists(select 1 from public.quotations q where q.id=quotation_id and (q.owner_id=auth.uid() or q.created_by=auth.uid() or public.quotation_can_control())));