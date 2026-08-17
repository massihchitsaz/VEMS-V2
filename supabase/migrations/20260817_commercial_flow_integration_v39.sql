-- Commercial Flow Integration v39 full production migration.
-- This file mirrors the production migration applied on 2026-08-17.

create table if not exists public.commercial_flow_events (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  source_type text not null,
  source_id uuid not null,
  target_type text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  performed_by uuid,
  created_at timestamptz not null default now()
);
alter table public.commercial_flow_events enable row level security;
drop policy if exists commercial_flow_events_read on public.commercial_flow_events;
create policy commercial_flow_events_read on public.commercial_flow_events for select to authenticated using (true);
revoke all on public.commercial_flow_events from anon;
grant select on public.commercial_flow_events to authenticated;

create or replace function public.commercial_flow_role()
returns text language sql stable security definer set search_path=public as $$
  select coalesce((select p.role::text from public.profiles p where p.id=auth.uid() and p.active=true),'unknown')
$$;
revoke all on function public.commercial_flow_role() from public,anon;
grant execute on function public.commercial_flow_role() to authenticated,service_role;

create or replace function public.commercial_flow_can_control()
returns boolean language sql stable security definer set search_path=public as $$
  select public.commercial_flow_role() in ('admin','ceo','manager')
$$;
revoke all on function public.commercial_flow_can_control() from public,anon;
grant execute on function public.commercial_flow_can_control() to authenticated,service_role;

create unique index if not exists ux_quotations_opportunity on public.quotations(opportunity_id) where opportunity_id is not null;
create unique index if not exists ux_deals_quotation on public.deals(quotation_id) where quotation_id is not null;
create index if not exists ix_deals_opportunity on public.deals(opportunity_id) where opportunity_id is not null;
create index if not exists ix_invoices_deal_shipment on public.invoices(deal_id,shipment_id);
create index if not exists ix_flow_source on public.commercial_flow_events(source_type,source_id,created_at desc);
create index if not exists ix_flow_target on public.commercial_flow_events(target_type,target_id,created_at desc);

create or replace function public.opportunity_flow_guard_v1()
returns trigger language plpgsql set search_path=public as $$
begin
  if current_user not in ('postgres','service_role') then
    if tg_op='UPDATE' and new.quotation_id is distinct from old.quotation_id then
      raise exception 'Quotation linkage is controlled by Commercial Flow.';
    end if;
    if tg_op='UPDATE' and new.stage is distinct from old.stage and new.stage in ('quotation','approval','won') then
      raise exception 'This opportunity stage is controlled by Commercial Flow.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_opportunity_flow_guard_v1 on public.opportunities;
create trigger trg_opportunity_flow_guard_v1 before update on public.opportunities for each row execute function public.opportunity_flow_guard_v1();

create or replace function public.quotation_status_guard_v1()
returns trigger language plpgsql set search_path=public as $$
begin
  if current_user not in ('postgres','service_role') and new.status is distinct from old.status then
    raise exception 'Quotation status is controlled by Commercial Flow actions.';
  end if;
  return new;
end $$;
drop trigger if exists trg_quotation_status_guard_v1 on public.quotations;
create trigger trg_quotation_status_guard_v1 before update on public.quotations for each row execute function public.quotation_status_guard_v1();

create or replace function public.save_quotation_v4(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_user uuid:=auth.uid(); v_role text; v_id uuid; v_existing public.quotations%rowtype; v_quote public.quotations%rowtype;
  v_revision int:=1; v_no text:=nullif(btrim(coalesce(p_payload->>'quotation_no','')),''); v_lines jsonb:=coalesce(p_payload->'lines','[]'::jsonb);
  v_subtotal numeric:=0; v_total numeric:=0; v_margin numeric:=0; v_line jsonb; v_line_no int:=0; v_qty numeric; v_cost numeric; v_sell numeric; v_update boolean:=false;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  v_role:=public.quotation_current_role();
  if v_role not in ('admin','ceo','manager','dealer','operations','logistics') then raise exception 'Role % has read-only quotation access',v_role; end if;
  if nullif(p_payload->>'id','') is not null then
    v_id:=(p_payload->>'id')::uuid; select * into v_existing from public.quotations where id=v_id for update;
    if not found then raise exception 'Quotation not found'; end if;
    if not public.quotation_can_control() and coalesce(v_existing.owner_id,v_existing.created_by)<>v_user then raise exception 'You do not have permission to edit this quotation.'; end if;
    if v_existing.status not in ('draft','rejected') then raise exception 'Quotation % cannot be edited while status is %. Use the controlled workflow.',coalesce(v_existing.quotation_no,'draft'),v_existing.status; end if;
    v_update:=true; v_revision:=coalesce(v_existing.revision,1)+1;
  end if;
  if v_no is not null and exists(select 1 from public.quotations q where q.quotation_no=v_no and (not v_update or q.id<>v_id)) then raise exception 'Quotation number % is already in use.',v_no; end if;
  for v_line in select * from jsonb_array_elements(v_lines) loop
    if btrim(coalesce(v_line->>'description',''))<>'' then
      v_qty:=coalesce((v_line->>'qty')::numeric,1); v_cost:=coalesce((v_line->>'cost')::numeric,0); v_sell:=coalesce((v_line->>'sell')::numeric,0);
      if v_qty<0 or v_cost<0 or v_sell<0 then raise exception 'Quotation quantities and rates cannot be negative.'; end if;
      v_subtotal:=v_subtotal+v_qty*v_cost; v_total:=v_total+v_qty*v_sell; v_line_no:=v_line_no+1;
    end if;
  end loop;
  if v_total<>0 then v_margin:=((v_total-v_subtotal)/v_total)*100; end if;
  if v_update then
    update public.quotations set quotation_no=v_no,quotation_type=coalesce(p_payload->>'quotation_type','trading'),customer_id=nullif(p_payload->>'customer_id','')::uuid,
      supplier_id=nullif(p_payload->>'supplier_id','')::uuid,opportunity_id=coalesce(v_existing.opportunity_id,nullif(p_payload->>'opportunity_id','')::uuid),
      title=coalesce(nullif(btrim(p_payload->>'title'),''),'Untitled quotation'),contact_person=nullif(p_payload->>'contact_person',''),currency=coalesce(nullif(p_payload->>'currency',''),'AED'),
      subtotal=v_subtotal,margin_percent=v_margin,total_amount=v_total,valid_until=nullif(p_payload->>'valid_until','')::date,
      route=nullif(concat_ws(' → ',nullif(p_payload->>'origin',''),nullif(p_payload->>'destination','')),''),incoterm=nullif(p_payload->>'incoterm',''),payment_terms=nullif(p_payload->>'payment_terms',''),
      origin=nullif(p_payload->>'origin',''),destination=nullif(p_payload->>'destination',''),mode=nullif(p_payload->>'mode',''),commodity=nullif(p_payload->>'commodity',''),hs_code=nullif(p_payload->>'hs_code',''),
      packing_details=nullif(p_payload->>'packing_details',''),gross_weight=nullif(p_payload->>'gross_weight',''),volume_details=nullif(p_payload->>'volume_details',''),notes=nullif(p_payload->>'notes',''),revision=v_revision,updated_at=now()
    where id=v_id returning * into v_quote;
    delete from public.quotation_items where quotation_id=v_id;
  else
    insert into public.quotations(quotation_no,quotation_type,customer_id,supplier_id,opportunity_id,title,contact_person,currency,subtotal,margin_percent,total_amount,status,valid_until,route,incoterm,payment_terms,origin,destination,mode,commodity,hs_code,packing_details,gross_weight,volume_details,notes,owner_id,created_by,revision)
    values(v_no,coalesce(p_payload->>'quotation_type','trading'),nullif(p_payload->>'customer_id','')::uuid,nullif(p_payload->>'supplier_id','')::uuid,nullif(p_payload->>'opportunity_id','')::uuid,
      coalesce(nullif(btrim(p_payload->>'title'),''),'Untitled quotation'),nullif(p_payload->>'contact_person',''),coalesce(nullif(p_payload->>'currency',''),'AED'),v_subtotal,v_margin,v_total,'draft',nullif(p_payload->>'valid_until','')::date,
      nullif(concat_ws(' → ',nullif(p_payload->>'origin',''),nullif(p_payload->>'destination','')),''),nullif(p_payload->>'incoterm',''),nullif(p_payload->>'payment_terms',''),nullif(p_payload->>'origin',''),nullif(p_payload->>'destination',''),nullif(p_payload->>'mode',''),
      nullif(p_payload->>'commodity',''),nullif(p_payload->>'hs_code',''),nullif(p_payload->>'packing_details',''),nullif(p_payload->>'gross_weight',''),nullif(p_payload->>'volume_details',''),nullif(p_payload->>'notes',''),v_user,v_user,1)
    returning * into v_quote; v_id:=v_quote.id;
  end if;
  v_line_no:=0;
  for v_line in select * from jsonb_array_elements(v_lines) loop
    if btrim(coalesce(v_line->>'description',''))<>'' then v_line_no:=v_line_no+1;
      insert into public.quotation_items(quotation_id,line_no,description,quantity,unit,unit_cost,unit_sell)
      values(v_id,v_line_no,btrim(v_line->>'description'),coalesce((v_line->>'qty')::numeric,1),coalesce(nullif(v_line->>'unit',''),'Unit'),coalesce((v_line->>'cost')::numeric,0),coalesce((v_line->>'sell')::numeric,0));
    end if;
  end loop;
  insert into public.quotation_versions(quotation_id,revision,snapshot,created_by) values(v_id,v_revision,p_payload||jsonb_build_object('subtotal',v_subtotal,'total_amount',v_total,'margin_percent',v_margin,'status',v_quote.status),v_user);
  insert into public.quotation_events(quotation_id,event_type,from_status,to_status,revision,details,performed_by) values(v_id,case when v_update then 'saved_revision' else 'created' end,case when v_update then v_existing.status else null end,v_quote.status,v_revision,jsonb_build_object('quotation_no',v_no,'total_amount',v_total,'margin_percent',v_margin),v_user);
  return to_jsonb(v_quote);
end $$;

create or replace function public.opportunity_to_quotation_v1(p_opportunity_id uuid,p_supplier_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_role text:=public.commercial_flow_role(); v_o public.opportunities%rowtype; v_q public.quotations%rowtype; v_customer_status text; v_supplier record;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select * into v_o from public.opportunities where id=p_opportunity_id for update; if not found then raise exception 'Opportunity not found'; end if;
 if v_role not in ('admin','ceo','manager') and coalesce(v_o.owner_id,v_o.created_by)<>v_user then raise exception 'You do not control this opportunity.'; end if;
 if v_o.quotation_id is not null or exists(select 1 from public.quotations where opportunity_id=v_o.id) then raise exception 'This opportunity already has a quotation.'; end if;
 if v_o.customer_id is null then raise exception 'Customer is required before creating a quotation.'; end if;
 select status into v_customer_status from public.customers where id=v_o.customer_id; if coalesce(v_customer_status,'')<>'active' then raise exception 'Customer must be active.'; end if;
 if p_supplier_id is not null then select status,kyc_status,kyc_expiry_date into v_supplier from public.suppliers where id=p_supplier_id; if not found then raise exception 'Supplier not found'; end if; if v_supplier.status<>'active' or coalesce(v_supplier.kyc_status,'')<>'approved' or v_supplier.kyc_expiry_date is null or v_supplier.kyc_expiry_date<current_date then raise exception 'Supplier must be active with valid approved KYC.'; end if; end if;
 insert into public.quotations(customer_id,supplier_id,opportunity_id,title,currency,subtotal,total_amount,status,valid_until,owner_id,created_by,revision,notes)
 values(v_o.customer_id,p_supplier_id,v_o.id,v_o.title,v_o.currency,0,0,'draft',current_date+15,coalesce(v_o.owner_id,v_user),v_user,1,v_o.notes) returning * into v_q;
 insert into public.quotation_items(quotation_id,line_no,description,quantity,unit,unit_cost,unit_sell) values(v_q.id,1,coalesce(v_o.title,'Opportunity scope'),1,'Lot',0,coalesce(v_o.estimated_value,0));
 update public.quotations set total_amount=coalesce(v_o.estimated_value,0),margin_percent=0 where id=v_q.id returning * into v_q;
 update public.opportunities set quotation_id=v_q.id,stage='quotation',next_action='Prepare costing and submit quotation for commercial review',updated_at=now() where id=v_o.id;
 insert into public.quotation_events(quotation_id,event_type,to_status,revision,details,performed_by) values(v_q.id,'created_from_opportunity','draft',1,jsonb_build_object('opportunity_id',v_o.id),v_user);
 insert into public.commercial_flow_events(action,source_type,source_id,target_type,target_id,details,performed_by) values('opportunity_to_quotation','opportunity',v_o.id,'quotation',v_q.id,jsonb_build_object('customer_id',v_o.customer_id),v_user);
 return to_jsonb(v_q);
end $$;

create or replace function public.quotation_submit_v1(p_quotation_id uuid,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_q public.quotations%rowtype; v_count int; v_role text:=public.commercial_flow_role(); v_from text;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select * into v_q from public.quotations where id=p_quotation_id for update; if not found then raise exception 'Quotation not found'; end if;
 if v_role not in ('admin','ceo','manager') and coalesce(v_q.owner_id,v_q.created_by)<>v_user then raise exception 'You do not control this quotation.'; end if;
 if v_q.status not in ('draft','rejected') then raise exception 'Only Draft or Rejected quotations can be submitted.'; end if;
 if v_q.customer_id is null or btrim(coalesce(v_q.title,''))='' or v_q.quotation_no is null or btrim(v_q.quotation_no)='' then raise exception 'Quotation number, customer and title are required.'; end if;
 if v_q.valid_until is not null and v_q.valid_until<current_date then raise exception 'Quotation validity date has expired.'; end if;
 select count(*) into v_count from public.quotation_items where quotation_id=v_q.id and btrim(description)<>'';
 if v_count=0 or coalesce(v_q.total_amount,0)<=0 then raise exception 'At least one priced quotation line is required.'; end if;
 v_from:=v_q.status; update public.quotations set status='review',updated_at=now() where id=v_q.id returning * into v_q;
 if v_q.opportunity_id is not null then update public.opportunities set stage='approval',next_action='Management commercial review / quotation decision',updated_at=now() where id=v_q.opportunity_id; end if;
 insert into public.quotation_events(quotation_id,event_type,from_status,to_status,revision,details,performed_by) values(v_q.id,'submitted_for_review',v_from,'review',v_q.revision,jsonb_build_object('reason',p_reason),v_user);
 return to_jsonb(v_q);
end $$;

create or replace function public.quotation_decide_v1(p_quotation_id uuid,p_decision text,p_comments text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_q public.quotations%rowtype; v_from text;
begin
 if v_user is null then raise exception 'Authentication required'; end if; if not public.commercial_flow_can_control() then raise exception 'Only commercial controllers can decide quotations.'; end if;
 if p_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected.'; end if;
 if p_decision='rejected' and length(btrim(coalesce(p_comments,'')))<3 then raise exception 'Rejection comments are required.'; end if;
 select * into v_q from public.quotations where id=p_quotation_id for update; if not found then raise exception 'Quotation not found'; end if; if v_q.status<>'review' then raise exception 'Quotation must be under review.'; end if;
 v_from:=v_q.status; update public.quotations set status=p_decision,updated_at=now() where id=v_q.id returning * into v_q;
 if v_q.opportunity_id is not null then update public.opportunities set stage=case when p_decision='approved' then 'approval' else 'negotiation' end,next_action=case when p_decision='approved' then 'Convert approved quotation to Deal' else 'Revise quotation following review comments' end,updated_at=now() where id=v_q.opportunity_id; end if;
 insert into public.quotation_events(quotation_id,event_type,from_status,to_status,revision,details,performed_by) values(v_q.id,case when p_decision='approved' then 'approved' else 'rejected' end,v_from,p_decision,v_q.revision,jsonb_build_object('comments',p_comments),v_user);
 return to_jsonb(v_q);
end $$;

create or replace function public.quotation_to_deal_v1(p_quotation_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_q public.quotations%rowtype; v_d public.deals%rowtype; v_qty numeric; v_units int; v_unit text; v_cost numeric; v_sell numeric; v_customer_status text; v_supplier record; v_no text;
begin
 if v_user is null then raise exception 'Authentication required'; end if; select * into v_q from public.quotations where id=p_quotation_id for update; if not found then raise exception 'Quotation not found'; end if;
 if v_q.status<>'approved' then raise exception 'Only approved quotations can be converted to a Deal.'; end if;
 if exists(select 1 from public.deals where quotation_id=v_q.id) then raise exception 'A Deal already exists for this quotation.'; end if;
 select status into v_customer_status from public.customers where id=v_q.customer_id; if v_customer_status<>'active' then raise exception 'Customer must be active.'; end if;
 if v_q.supplier_id is not null then select status,kyc_status,kyc_expiry_date into v_supplier from public.suppliers where id=v_q.supplier_id; if v_supplier.status<>'active' or v_supplier.kyc_status<>'approved' or v_supplier.kyc_expiry_date is null or v_supplier.kyc_expiry_date<current_date then raise exception 'Supplier must have valid approved KYC.'; end if; end if;
 select coalesce(sum(quantity),1),count(distinct coalesce(unit,'Unit')),min(coalesce(unit,'Unit')),coalesce(sum(quantity*unit_cost),0),coalesce(sum(quantity*unit_sell),0) into v_qty,v_units,v_unit,v_cost,v_sell from public.quotation_items where quotation_id=v_q.id;
 if coalesce(v_qty,0)<=0 then v_qty:=1; end if; if v_units<>1 then v_unit:='Lot'; v_qty:=1; v_cost:=v_q.subtotal; v_sell:=v_q.total_amount; end if;
 v_no:='VTC-'||to_char(clock_timestamp(),'YYYYMMDD-HH24MISSMS');
 insert into public.deals(deal_no,customer_id,supplier_id,dealer_id,buy_currency,sell_currency,amount,buy_price,sell_price,profit,profit_aed,status,commodity,origin_country,destination_country,incoterm,quantity,unit,quotation_id,opportunity_id,notes)
 values(v_no,v_q.customer_id,v_q.supplier_id,coalesce(v_q.owner_id,v_user),v_q.currency,v_q.currency,v_q.total_amount,v_cost/v_qty,v_sell/v_qty,v_sell-v_cost,case when v_q.currency='AED' then v_sell-v_cost else 0 end,'draft',coalesce(v_q.commodity,v_q.title),v_q.origin,v_q.destination,v_q.incoterm,v_qty,v_unit,v_q.id,v_q.opportunity_id,concat('Created from quotation ',coalesce(v_q.quotation_no,v_q.id::text))) returning * into v_d;
 if v_q.opportunity_id is not null then update public.opportunities set stage='approval',next_action='Complete Deal controls and obtain Deal approval',updated_at=now() where id=v_q.opportunity_id; end if;
 insert into public.commercial_flow_events(action,source_type,source_id,target_type,target_id,details,performed_by) values('quotation_to_deal','quotation',v_q.id,'deal',v_d.id,jsonb_build_object('quotation_no',v_q.quotation_no,'deal_no',v_d.deal_no),v_user);
 insert into public.quotation_events(quotation_id,event_type,from_status,to_status,revision,details,performed_by) values(v_q.id,'converted_to_deal',v_q.status,v_q.status,v_q.revision,jsonb_build_object('deal_id',v_d.id,'deal_no',v_d.deal_no),v_user);
 return to_jsonb(v_d);
end $$;

create or replace function public.commercial_generate_invoice_v1(p_deal_id uuid,p_shipment_id uuid default null,p_due_date date default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_role text:=public.commercial_flow_role(); v_d public.deals%rowtype; v_s public.shipments%rowtype; v_i public.invoices%rowtype; v_no text;
begin
 if v_user is null then raise exception 'Authentication required'; end if; if v_role not in ('admin','ceo','manager','finance','dealer') then raise exception 'Role % cannot generate commercial invoices.',v_role; end if;
 select * into v_d from public.deals where id=p_deal_id; if not found then raise exception 'Deal not found'; end if; if v_d.status not in ('approved','completed') then raise exception 'Deal must be approved before invoicing.'; end if;
 if v_role='dealer' and v_d.dealer_id<>v_user then raise exception 'You do not control this Deal.'; end if;
 if p_shipment_id is not null then select * into v_s from public.shipments where id=p_shipment_id and deal_id=v_d.id; if not found then raise exception 'Shipment does not belong to this Deal.'; end if; end if;
 if exists(select 1 from public.invoices where deal_id=v_d.id and invoice_type='receivable' and coalesce(shipment_id,'00000000-0000-0000-0000-000000000000'::uuid)=coalesce(p_shipment_id,'00000000-0000-0000-0000-000000000000'::uuid) and status<>'cancelled') then raise exception 'A receivable invoice already exists for this Deal / Shipment scope.'; end if;
 v_no:='INV-'||to_char(clock_timestamp(),'YYYYMMDD-HH24MISSMS');
 insert into public.invoices(invoice_no,invoice_type,deal_id,shipment_id,customer_id,currency,amount,tax_amount,total_amount,status,issue_date,due_date,notes,created_by,collection_status)
 values(v_no,'receivable',v_d.id,p_shipment_id,v_d.customer_id,v_d.sell_currency,v_d.amount,0,v_d.amount,'draft',current_date,coalesce(p_due_date,current_date+30),concat('Generated from Deal ',v_d.deal_no),v_user,'open') returning * into v_i;
 insert into public.commercial_flow_events(action,source_type,source_id,target_type,target_id,details,performed_by) values('deal_to_invoice','deal',v_d.id,'invoice',v_i.id,jsonb_build_object('shipment_id',p_shipment_id,'invoice_no',v_i.invoice_no),v_user);
 return to_jsonb(v_i);
end $$;

create or replace function public.commercial_flow_snapshot_v1(p_deal_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_d public.deals%rowtype; v_q public.quotations%rowtype; v_o public.opportunities%rowtype; v_ship jsonb; v_inv jsonb; v_pay numeric; v_next text;
begin
 select * into v_d from public.deals where id=p_deal_id; if not found then raise exception 'Deal not found'; end if;
 if v_d.quotation_id is not null then select * into v_q from public.quotations where id=v_d.quotation_id; end if; if v_d.opportunity_id is not null then select * into v_o from public.opportunities where id=v_d.opportunity_id; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'shipment_no',shipment_no,'status',status,'mode',mode,'etd',etd,'eta',eta) order by created_at),'[]'::jsonb) into v_ship from public.shipments where deal_id=v_d.id;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'invoice_no',invoice_no,'status',status,'currency',currency,'total_amount',total_amount,'due_date',due_date) order by created_at),'[]'::jsonb) into v_inv from public.invoices where deal_id=v_d.id;
 select coalesce(sum(amount),0) into v_pay from public.payments where deal_id=v_d.id and status in ('completed','paid','settled','executed');
 v_next:=case when v_d.status in ('draft','review') then 'Complete Deal and submit for approval' when v_d.status='pending' then 'Management approval required' when v_d.status='approved' and jsonb_array_length(v_ship)=0 then 'Create Shipment' when v_d.status='approved' and jsonb_array_length(v_inv)=0 then 'Generate Invoice' when jsonb_array_length(v_inv)>0 and v_pay<coalesce(v_d.amount,0) then 'Collect outstanding receivable' when v_d.status='approved' then 'Complete Deal when operational and financial conditions are met' else 'Monitor closed Deal' end;
 return jsonb_build_object('deal',to_jsonb(v_d),'quotation',case when v_d.quotation_id is null then null else to_jsonb(v_q) end,'opportunity',case when v_d.opportunity_id is null then null else to_jsonb(v_o) end,'shipments',v_ship,'invoices',v_inv,'paid_total',v_pay,'next_action',v_next);
end $$;

create or replace function public.commercial_sync_deal_opportunity_v1()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.opportunity_id is not null and new.status is distinct from old.status then
   if new.status='approved' then update public.opportunities set stage='won',probability=100,next_action='Execute shipment, invoicing and settlement',updated_at=now() where id=new.opportunity_id;
   elsif new.status='cancelled' then update public.opportunities set stage='lost',next_action='Review loss reason and close commercial follow-up',updated_at=now() where id=new.opportunity_id; end if;
 end if; return new;
end $$;
drop trigger if exists trg_commercial_sync_deal_opportunity_v1 on public.deals;
create trigger trg_commercial_sync_deal_opportunity_v1 after update of status on public.deals for each row execute function public.commercial_sync_deal_opportunity_v1();

revoke all on function public.save_quotation_v4(jsonb),public.opportunity_to_quotation_v1(uuid,uuid),public.quotation_submit_v1(uuid,text),public.quotation_decide_v1(uuid,text,text),public.quotation_to_deal_v1(uuid),public.commercial_generate_invoice_v1(uuid,uuid,date),public.commercial_flow_snapshot_v1(uuid) from public,anon;
grant execute on function public.save_quotation_v4(jsonb),public.opportunity_to_quotation_v1(uuid,uuid),public.quotation_submit_v1(uuid,text),public.quotation_decide_v1(uuid,text,text),public.quotation_to_deal_v1(uuid),public.commercial_generate_invoice_v1(uuid,uuid,date),public.commercial_flow_snapshot_v1(uuid) to authenticated,service_role;
