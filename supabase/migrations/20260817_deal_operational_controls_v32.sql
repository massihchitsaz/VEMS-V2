create or replace function public.deal_operational_snapshot_v1(p_deal_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare inv_count int:=0; open_inv int:=0; inv_total numeric:=0; paid_total numeric:=0; overdue_count int:=0; sh_count int:=0; active_sh int:=0; delivered_count int:=0; pay_state text; ship_state text; last_event timestamptz;
begin
 select count(*),count(*) filter(where status not in ('paid','cancelled')),coalesce(sum(total_amount),0),count(*) filter(where due_date is not null and due_date<current_date and status not in ('paid','cancelled')) into inv_count,open_inv,inv_total,overdue_count from public.invoices where deal_id=p_deal_id and invoice_type='receivable';
 select coalesce(sum(amount),0) into paid_total from public.payments where deal_id=p_deal_id and payment_type='receipt' and status='completed';
 if inv_count=0 then pay_state:='Not Invoiced'; elsif open_inv=0 then pay_state:='Paid'; elsif overdue_count>0 then pay_state:='Overdue'; elsif paid_total>0 then pay_state:='Partial'; else pay_state:='Pending'; end if;
 select count(*),count(*) filter(where status not in ('delivered','cancelled')),count(*) filter(where status='delivered') into sh_count,active_sh,delivered_count from public.shipments where deal_id=p_deal_id;
 if sh_count=0 then ship_state:='Not Created'; elsif active_sh=0 and delivered_count>0 then ship_state:='Delivered'; elsif exists(select 1 from public.shipments where deal_id=p_deal_id and status='customs') then ship_state:='Customs'; elsif exists(select 1 from public.shipments where deal_id=p_deal_id and status='in_transit') then ship_state:='In Transit'; elsif exists(select 1 from public.shipments where deal_id=p_deal_id and status in ('booked','picked_up')) then ship_state:='Booked'; else ship_state:='Planning'; end if;
 select max(created_at) into last_event from public.deal_events where deal_id=p_deal_id;
 return jsonb_build_object('invoice_count',inv_count,'open_invoices',open_inv,'invoice_total',inv_total,'received_total',paid_total,'payment_state',pay_state,'shipment_count',sh_count,'active_shipments',active_sh,'delivered_shipments',delivered_count,'shipment_state',ship_state,'last_event_at',last_event);
end $$;
create or replace function public.deal_create_shipment_v1(p_deal_id uuid,p_mode text default 'sea') returns public.shipments language plpgsql security definer set search_path=public as $$
declare d public.deals; sh public.shipments; no text; role text:=public.deal_current_role();
begin
 if role not in ('admin','ceo','manager','dealer','operations','logistics') then raise exception 'Shipment handover is not permitted for this role.'; end if;
 select * into d from public.deals where id=p_deal_id for update; if not found then raise exception 'Deal not found.'; end if;
 if d.status<>'approved' then raise exception 'Deal must be approved before shipment handover.'; end if;
 if role='dealer' and d.dealer_id<>auth.uid() then raise exception 'Dealer users may hand over only their own deals.'; end if;
 if p_mode not in ('sea','air','road','rail','courier','multimodal') then raise exception 'Invalid shipment mode.'; end if;
 no:='SHP-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
 insert into public.shipments(shipment_no,deal_id,quotation_id,customer_id,supplier_id,mode,status,origin,destination,cargo_description,currency,owner_id,created_by,incoterm,container_no,bl_no,etd,eta)
 values(no,d.id,d.quotation_id,d.customer_id,d.supplier_id,p_mode,'planning',d.origin_country,d.destination_country,coalesce(d.commodity,d.notes),d.sell_currency,d.dealer_id,auth.uid(),d.incoterm,d.container_no,d.bl_no,d.etd,d.eta) returning * into sh;
 insert into public.deal_events(deal_id,event_type,to_value,metadata,performed_by) values(p_deal_id,'shipment_created',sh.id::text,jsonb_build_object('shipment_no',sh.shipment_no,'mode',sh.mode),auth.uid()); return sh;
end $$;
create or replace function public.deal_reopen_v1(p_deal_id uuid,p_reason text) returns public.deals language plpgsql security definer set search_path=public as $$
declare d public.deals;
begin
 if not public.deal_can_approve() then raise exception 'Reopening a deal requires manager-level permission.'; end if;
 if length(trim(coalesce(p_reason,'')))<5 then raise exception 'Reopen reason must contain at least 5 characters.'; end if;
 select * into d from public.deals where id=p_deal_id for update; if not found then raise exception 'Deal not found.'; end if;
 if d.status<>'approved' then raise exception 'Only approved deals can be reopened.'; end if;
 if exists(select 1 from public.shipments where deal_id=p_deal_id and status<>'cancelled') then raise exception 'Deal cannot be reopened after shipment execution has started.'; end if;
 if exists(select 1 from public.invoices where deal_id=p_deal_id and status<>'cancelled') then raise exception 'Deal cannot be reopened after invoicing has started.'; end if;
 update public.deals set status='review',updated_at=now() where id=p_deal_id returning * into d;
 insert into public.deal_events(deal_id,event_type,from_value,to_value,reason,performed_by) values(p_deal_id,'reopened','approved','review',trim(p_reason),auth.uid()); return d;
end $$;
create or replace function public.deal_delete_v1(p_deal_id uuid,p_reason text) returns boolean language plpgsql security definer set search_path=public as $$
declare d public.deals; deps int;
begin
 if public.deal_current_role() not in ('admin','ceo') then raise exception 'Only Admin or CEO can delete a deal.'; end if;
 if length(trim(coalesce(p_reason,'')))<5 then raise exception 'Deletion reason must contain at least 5 characters.'; end if;
 select * into d from public.deals where id=p_deal_id for update; if not found then raise exception 'Deal not found.'; end if;
 if d.status not in ('draft','cancelled') then raise exception 'Only draft or cancelled deals can be deleted.'; end if;
 select (select count(*) from public.shipments where deal_id=p_deal_id)+(select count(*) from public.invoices where deal_id=p_deal_id)+(select count(*) from public.payments where deal_id=p_deal_id)+(select count(*) from public.approvals where entity_type='deal' and entity_id=p_deal_id) into deps;
 if deps>0 then raise exception 'Deal has operational, financial or approval history and cannot be deleted.'; end if;
 delete from public.deal_events where deal_id=p_deal_id; delete from public.deals where id=p_deal_id; return true;
end $$;
drop policy if exists deals_delete_roles on public.deals;
revoke all on function public.deal_operational_snapshot_v1(uuid) from public,anon; revoke all on function public.deal_create_shipment_v1(uuid,text) from public,anon; revoke all on function public.deal_reopen_v1(uuid,text) from public,anon; revoke all on function public.deal_delete_v1(uuid,text) from public,anon;
grant execute on function public.deal_operational_snapshot_v1(uuid) to authenticated,service_role; grant execute on function public.deal_create_shipment_v1(uuid,text) to authenticated,service_role; grant execute on function public.deal_reopen_v1(uuid,text) to authenticated,service_role; grant execute on function public.deal_delete_v1(uuid,text) to authenticated,service_role;
