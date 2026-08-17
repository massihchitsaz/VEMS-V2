-- Commercial invoice alignment v42
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
revoke all on function public.commercial_generate_invoice_v1(uuid,uuid,date) from public,anon;
grant execute on function public.commercial_generate_invoice_v1(uuid,uuid,date) to authenticated,service_role;
