drop policy if exists authenticated_collection_activities_all on public.collection_activities;
drop policy if exists authenticated_payment_allocations_all on public.payment_allocations;

create policy collection_activities_read_finance_roles on public.collection_activities
for select to authenticated
using ((select public.finance_current_role()) in ('admin','ceo','manager','finance'));

create policy payment_allocations_read_finance_roles on public.payment_allocations
for select to authenticated
using ((select public.finance_current_role()) in ('admin','ceo','manager','finance'));

create or replace function public.finance_add_collection_activity_v2(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_role text:=public.finance_current_role();
  v public.invoices%rowtype;
  v_activity public.collection_activities%rowtype;
  v_status text;
  v_promised date;
  v_next timestamptz;
  v_owner uuid;
begin
  if v_user is null or v_role not in ('admin','ceo','manager','finance') then raise exception 'Finance write access required.'; end if;
  select * into v from public.invoices where id=nullif(p_payload->>'invoice_id','')::uuid for update;
  if not found then raise exception 'Invoice not found.'; end if;
  if v.invoice_type<>'receivable' then raise exception 'Collection activity applies only to receivables.'; end if;
  if v.status in ('paid','cancelled') then raise exception 'Closed invoice cannot receive collection activity.'; end if;
  v_promised:=nullif(p_payload->>'promised_payment_date','')::date;
  v_next:=nullif(p_payload->>'next_follow_up_at','')::timestamptz;
  v_owner:=coalesce(nullif(p_payload->>'owner_id','')::uuid,v.collection_owner_id,v_user);
  v_status:=coalesce(nullif(p_payload->>'collection_status',''),case when v_promised is not null then 'promised' else 'contacted' end);
  if v_status not in ('open','contacted','promised','escalated','closed') then raise exception 'Invalid collection status.'; end if;
  if v_owner is not null and not exists(select 1 from public.profiles p where p.id=v_owner and coalesce(p.active,true)) then raise exception 'Collection owner is not active.'; end if;

  insert into public.collection_activities(invoice_id,activity_type,activity_at,channel,contact_person,notes,outcome,next_follow_up_at,promised_payment_date,created_by)
  values(v.id,coalesce(nullif(p_payload->>'activity_type',''),'follow_up'),now(),nullif(p_payload->>'channel',''),nullif(p_payload->>'contact_person',''),nullif(btrim(p_payload->>'notes'),''),nullif(p_payload->>'outcome',''),v_next,v_promised,v_user)
  returning * into v_activity;

  update public.invoices
  set collection_status=v_status,
      collection_owner_id=v_owner,
      promised_payment_date=coalesce(v_promised,promised_payment_date),
      last_follow_up_at=now(),
      next_follow_up_at=v_next,
      updated_at=now()
  where id=v.id
  returning * into v;

  insert into public.finance_events(entity_type,entity_id,event_type,reason,metadata,performed_by)
  values('invoice',v.id,'collection_activity',nullif(btrim(p_payload->>'notes'),''),jsonb_build_object('activity_id',v_activity.id,'collection_status',v.collection_status,'promised_payment_date',v.promised_payment_date,'next_follow_up_at',v.next_follow_up_at,'owner_id',v.collection_owner_id),v_user);

  return jsonb_build_object('invoice',to_jsonb(v),'activity',to_jsonb(v_activity));
end $$;

create or replace function public.finance_allocate_receipt_v2(p_invoice_id uuid,p_payment_id uuid,p_amount numeric,p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_role text:=public.finance_current_role();
  v_inv public.invoices%rowtype;
  v_pay public.payments%rowtype;
  v_alloc public.payment_allocations%rowtype;
  v_inv_alloc numeric:=0;
  v_pay_alloc numeric:=0;
  v_direct numeric:=0;
  v_paid numeric:=0;
  v_new_status text;
begin
  if v_user is null or v_role not in ('admin','ceo','manager','finance') then raise exception 'Finance write access required.'; end if;
  if coalesce(p_amount,0)<=0 then raise exception 'Allocation amount must be greater than zero.'; end if;

  select * into v_inv from public.invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found.'; end if;
  if v_inv.invoice_type<>'receivable' then raise exception 'Receipt allocation applies only to receivables.'; end if;
  if v_inv.status in ('paid','cancelled') then raise exception 'Invoice is already closed.'; end if;

  select * into v_pay from public.payments where id=p_payment_id for update;
  if not found then raise exception 'Receipt not found.'; end if;
  if v_pay.payment_type<>'receipt' then raise exception 'Selected payment is not a receipt.'; end if;
  if v_pay.status<>'completed' then raise exception 'Only completed receipts can be allocated.'; end if;
  if v_pay.invoice_id is not null then raise exception 'Receipt is already directly linked to an invoice.'; end if;
  if v_pay.currency<>v_inv.currency then raise exception 'Receipt and invoice currencies must match.'; end if;

  select coalesce(sum(amount),0) into v_inv_alloc from public.payment_allocations where invoice_id=v_inv.id;
  select coalesce(sum(amount),0) into v_pay_alloc from public.payment_allocations where payment_id=v_pay.id;
  select coalesce(sum(amount),0) into v_direct from public.payments where invoice_id=v_inv.id and payment_type='receipt' and status='completed';

  if p_amount>greatest(0,v_inv.total_amount-v_inv_alloc-v_direct)+0.0001 then raise exception 'Allocation exceeds invoice outstanding balance.'; end if;
  if p_amount>greatest(0,v_pay.amount-v_pay_alloc)+0.0001 then raise exception 'Allocation exceeds unapplied receipt balance.'; end if;

  insert into public.payment_allocations(payment_id,invoice_id,amount,currency,allocated_by,notes)
  values(v_pay.id,v_inv.id,p_amount,v_inv.currency,v_user,nullif(btrim(p_notes),''))
  returning * into v_alloc;

  v_paid:=v_direct+v_inv_alloc+p_amount;
  v_new_status:=case when v_paid+0.0001>=v_inv.total_amount then 'paid' else 'partially_paid' end;

  update public.invoices
  set status=v_new_status,
      collection_status=case when v_new_status='paid' then 'closed' else collection_status end,
      credit_hold=case when v_new_status='paid' then false else credit_hold end,
      updated_at=now()
  where id=v_inv.id
  returning * into v_inv;

  insert into public.finance_events(entity_type,entity_id,event_type,to_status,reason,metadata,performed_by)
  values('invoice',v_inv.id,'receipt_allocated',v_new_status,nullif(btrim(p_notes),''),jsonb_build_object('allocation_id',v_alloc.id,'payment_id',v_pay.id,'amount',p_amount,'currency',v_inv.currency,'paid_total',v_paid),v_user);

  return jsonb_build_object('invoice',to_jsonb(v_inv),'allocation',to_jsonb(v_alloc),'receipt',to_jsonb(v_pay),'paid_total',v_paid);
end $$;

revoke all on function public.finance_add_collection_activity_v2(jsonb) from public,anon;
revoke all on function public.finance_allocate_receipt_v2(uuid,uuid,numeric,text) from public,anon;
grant execute on function public.finance_add_collection_activity_v2(jsonb) to authenticated;
grant execute on function public.finance_allocate_receipt_v2(uuid,uuid,numeric,text) to authenticated;

create index if not exists collection_activities_invoice_activity_idx on public.collection_activities(invoice_id,activity_at desc);
create index if not exists payment_allocations_payment_invoice_idx on public.payment_allocations(payment_id,invoice_id);
