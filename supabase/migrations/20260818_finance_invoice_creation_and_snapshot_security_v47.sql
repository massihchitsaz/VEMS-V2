-- Finance v47: controlled invoice origination and SECURITY DEFINER snapshot access hardening.

create or replace function public.finance_create_invoice_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_role text:=public.finance_current_role();
  v public.invoices%rowtype;
  v_type text;
  v_no text;
  v_amount numeric;
  v_tax numeric;
begin
  if v_user is null or v_role not in ('admin','ceo','manager','finance') then
    raise exception 'Finance write access required.';
  end if;
  v_type:=coalesce(nullif(p_payload->>'invoice_type',''),'receivable');
  if v_type not in ('receivable','payable') then raise exception 'Invoice type must be receivable or payable.'; end if;
  v_amount:=coalesce(nullif(p_payload->>'amount','')::numeric,0);
  v_tax:=coalesce(nullif(p_payload->>'tax_amount','')::numeric,0);
  if v_amount<0 or v_tax<0 or (v_amount+v_tax)<=0 then raise exception 'Invoice total must be greater than zero.'; end if;
  if v_type='receivable' and nullif(p_payload->>'customer_id','') is null then raise exception 'Receivable invoice requires a customer.'; end if;
  if v_type='payable' and nullif(p_payload->>'supplier_id','') is null then raise exception 'Payable invoice requires a supplier.'; end if;
  v_no:=coalesce(nullif(btrim(p_payload->>'invoice_no'),''),'INV-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS'));
  insert into public.invoices(invoice_no,invoice_type,deal_id,shipment_id,customer_id,supplier_id,currency,amount,tax_amount,total_amount,status,issue_date,due_date,notes,created_by,dispute_status,collection_status,payment_priority,payment_hold,approval_status,vendor_reference,payment_terms,finance_owner_id)
  values(v_no,v_type,nullif(p_payload->>'deal_id','')::uuid,nullif(p_payload->>'shipment_id','')::uuid,nullif(p_payload->>'customer_id','')::uuid,nullif(p_payload->>'supplier_id','')::uuid,coalesce(nullif(p_payload->>'currency',''),'AED'),v_amount,v_tax,v_amount+v_tax,'draft',current_date,nullif(p_payload->>'due_date','')::date,nullif(p_payload->>'notes',''),v_user,'clear','open',coalesce(nullif(p_payload->>'payment_priority',''),'normal'),false,'not_required',nullif(p_payload->>'vendor_reference',''),nullif(p_payload->>'payment_terms',''),v_user)
  returning * into v;
  insert into public.finance_events(entity_type,entity_id,event_type,to_status,metadata,performed_by)
  values('invoice',v.id,'invoice_created','draft',jsonb_build_object('invoice_no',v.invoice_no,'invoice_type',v.invoice_type,'total_amount',v.total_amount,'currency',v.currency),v_user);
  return to_jsonb(v);
end $$;

create or replace function public.finance_snapshot_v1()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_role text:=public.finance_current_role();
begin
  if auth.uid() is null or v_role not in ('admin','ceo','manager','finance') then raise exception 'Finance access required.'; end if;
  return jsonb_build_object(
    'role',v_role,
    'can_write',public.finance_can_write(),
    'can_approve',public.finance_can_approve(),
    'receivables',coalesce((select jsonb_agg(to_jsonb(x)) from (select i.*,c.company_name customer_name,d.deal_no from public.invoices i left join public.customers c on c.id=i.customer_id left join public.deals d on d.id=i.deal_id where i.invoice_type='receivable' order by i.due_date nulls last) x),'[]'::jsonb),
    'payables',coalesce((select jsonb_agg(to_jsonb(x)) from (select i.*,s.company_name supplier_name,d.deal_no from public.invoices i left join public.suppliers s on s.id=i.supplier_id left join public.deals d on d.id=i.deal_id where i.invoice_type='payable' order by i.due_date nulls last) x),'[]'::jsonb),
    'payments',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from public.payments p),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from public.finance_events e),'[]'::jsonb)
  );
end $$;

revoke all on function public.finance_create_invoice_v1(jsonb) from public,anon;
grant execute on function public.finance_create_invoice_v1(jsonb) to authenticated;
