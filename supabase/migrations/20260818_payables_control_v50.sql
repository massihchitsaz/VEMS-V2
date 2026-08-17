-- VEMS V2 / VTC ONE - Controlled Accounts Payable workflow v50

drop policy if exists "Authenticated users manage payable activities" on public.payable_activities;
alter table public.payable_activities enable row level security;
create policy payable_activities_read_finance_roles on public.payable_activities for select to authenticated using ((select public.finance_current_role()) = any(array['admin','ceo','manager','finance']));

create or replace function public.payable_approval_guard_v1() returns trigger language plpgsql set search_path='public' as $$
begin
 if tg_op='UPDATE' and (new.approval_status is distinct from old.approval_status or new.approved_by is distinct from old.approved_by or new.approved_at is distinct from old.approved_at) and current_user not in ('postgres','service_role') then raise exception 'Payable approval is controlled by Finance Workflow.'; end if;
 return new;
end $$;
drop trigger if exists trg_payable_approval_guard_v1 on public.invoices;
create trigger trg_payable_approval_guard_v1 before update on public.invoices for each row execute function public.payable_approval_guard_v1();

create or replace function public.finance_create_payable_v2(p_payload jsonb,p_issue boolean default false) returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_user uuid:=auth.uid();v_role text:=public.finance_current_role();v public.invoices%rowtype;v_supplier public.suppliers%rowtype;v_amount numeric:=coalesce(nullif(p_payload->>'amount','')::numeric,0);v_tax numeric:=coalesce(nullif(p_payload->>'tax_amount','')::numeric,0);v_no text;v_priority text:=coalesce(nullif(p_payload->>'payment_priority',''),'normal');
begin
 if v_user is null or v_role not in ('admin','ceo','manager','finance') then raise exception 'Finance write access required.'; end if;
 if nullif(p_payload->>'supplier_id','') is null then raise exception 'Supplier is required.'; end if;
 select * into v_supplier from public.suppliers where id=(p_payload->>'supplier_id')::uuid and status='active';if not found then raise exception 'Active supplier not found.';end if;
 if v_amount<0 or v_tax<0 or v_amount+v_tax<=0 then raise exception 'Payable total must be greater than zero.';end if;
 if nullif(p_payload->>'due_date','') is null then raise exception 'Due date is required.';end if;
 if v_priority not in ('low','normal','high','critical') then raise exception 'Invalid payment priority.';end if;
 v_no:=coalesce(nullif(btrim(p_payload->>'invoice_no'),''),'AP-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS'));
 insert into public.invoices(invoice_no,invoice_type,supplier_id,deal_id,shipment_id,currency,amount,tax_amount,total_amount,status,issue_date,due_date,notes,created_by,dispute_status,collection_status,payment_priority,payment_hold,approval_status,scheduled_payment_date,vendor_reference,payment_terms,finance_owner_id)
 values(v_no,'payable',v_supplier.id,nullif(p_payload->>'deal_id','')::uuid,nullif(p_payload->>'shipment_id','')::uuid,coalesce(nullif(p_payload->>'currency',''),v_supplier.currency,'AED'),v_amount,v_tax,v_amount+v_tax,case when p_issue then 'issued' else 'draft' end,coalesce(nullif(p_payload->>'issue_date','')::date,current_date),(p_payload->>'due_date')::date,nullif(p_payload->>'notes',''),v_user,'clear','open',v_priority,false,'pending',nullif(p_payload->>'scheduled_payment_date','')::date,nullif(p_payload->>'vendor_reference',''),coalesce(nullif(p_payload->>'payment_terms',''),v_supplier.payment_terms),coalesce(nullif(p_payload->>'finance_owner_id','')::uuid,v_user)) returning * into v;
 insert into public.finance_events(entity_type,entity_id,event_type,to_status,metadata,performed_by) values('invoice',v.id,case when p_issue then 'payable_created_issued' else 'payable_created' end,v.status,jsonb_build_object('invoice_no',v.invoice_no,'supplier_id',v.supplier_id,'total_amount',v.total_amount,'currency',v.currency,'approval_status',v.approval_status),v_user);
 return to_jsonb(v);
end $$;

create or replace function public.finance_decide_payable_v2(p_invoice_id uuid,p_decision text,p_comments text default null) returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_user uuid:=auth.uid();v_role text:=public.finance_current_role();v public.invoices%rowtype;
begin
 if v_user is null or v_role not in ('admin','ceo','manager') then raise exception 'Payable approval authority required.';end if;
 if p_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected.';end if;
 select * into v from public.invoices where id=p_invoice_id for update;if not found or v.invoice_type<>'payable' then raise exception 'Payable not found.';end if;
 if v.created_by=v_user then raise exception 'Maker cannot approve or reject their own payable.';end if;
 if v.approval_status<>'pending' then raise exception 'Only pending payables can be decided.';end if;
 if p_decision='rejected' and length(btrim(coalesce(p_comments,'')))<5 then raise exception 'Rejection reason is required.';end if;
 update public.invoices set approval_status=p_decision,approved_by=v_user,approved_at=now(),payment_hold=(p_decision='rejected'),updated_at=now() where id=p_invoice_id returning * into v;
 insert into public.finance_events(entity_type,entity_id,event_type,reason,metadata,performed_by) values('invoice',v.id,'payable_'||p_decision,nullif(btrim(p_comments),''),jsonb_build_object('approval_status',v.approval_status,'payment_hold',v.payment_hold),v_user);
 return to_jsonb(v);
end $$;

create or replace function public.finance_set_payable_control_v2(p_invoice_id uuid,p_priority text default null,p_payment_hold boolean default null,p_scheduled_date date default null,p_owner_id uuid default null,p_payment_terms text default null,p_reason text default null) returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_user uuid:=auth.uid();v_role text:=public.finance_current_role();v public.invoices%rowtype;v_priority text;
begin
 if v_user is null or v_role not in ('admin','ceo','manager','finance') then raise exception 'Finance write access required.';end if;
 select * into v from public.invoices where id=p_invoice_id for update;if not found or v.invoice_type<>'payable' then raise exception 'Payable not found.';end if;
 if v.status in ('paid','cancelled') then raise exception 'Closed payable cannot be changed.';end if;
 v_priority:=coalesce(p_priority,v.payment_priority,'normal');if v_priority not in ('low','normal','high','critical') then raise exception 'Invalid payment priority.';end if;
 if p_payment_hold=true and length(btrim(coalesce(p_reason,'')))<5 then raise exception 'Payment hold reason is required.';end if;
 update public.invoices set payment_priority=v_priority,payment_hold=coalesce(p_payment_hold,payment_hold),scheduled_payment_date=coalesce(p_scheduled_date,scheduled_payment_date),finance_owner_id=coalesce(p_owner_id,finance_owner_id,v_user),payment_terms=coalesce(nullif(btrim(p_payment_terms),''),payment_terms),updated_at=now() where id=p_invoice_id returning * into v;
 insert into public.finance_events(entity_type,entity_id,event_type,reason,metadata,performed_by) values('invoice',v.id,'payable_control_updated',nullif(btrim(p_reason),''),jsonb_build_object('priority',v.payment_priority,'payment_hold',v.payment_hold,'scheduled_payment_date',v.scheduled_payment_date,'finance_owner_id',v.finance_owner_id),v_user);
 return to_jsonb(v);
end $$;

create or replace function public.finance_add_payable_activity_v2(p_payload jsonb) returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_user uuid:=auth.uid();v_role text:=public.finance_current_role();v_inv public.invoices%rowtype;v_act public.payable_activities%rowtype;
begin
 if v_user is null or v_role not in ('admin','ceo','manager','finance') then raise exception 'Finance write access required.';end if;
 select * into v_inv from public.invoices where id=(p_payload->>'invoice_id')::uuid;if not found or v_inv.invoice_type<>'payable' then raise exception 'Payable not found.';end if;
 if length(btrim(coalesce(p_payload->>'notes','')))<2 then raise exception 'Activity note is required.';end if;
 insert into public.payable_activities(invoice_id,activity_type,channel,notes,outcome,activity_at,created_by) values(v_inv.id,coalesce(nullif(p_payload->>'activity_type',''),'follow_up'),nullif(p_payload->>'channel',''),btrim(p_payload->>'notes'),nullif(p_payload->>'outcome',''),coalesce(nullif(p_payload->>'activity_at','')::timestamptz,now()),v_user) returning * into v_act;
 insert into public.finance_events(entity_type,entity_id,event_type,reason,metadata,performed_by) values('invoice',v_inv.id,'payable_activity',btrim(p_payload->>'notes'),jsonb_build_object('activity_id',v_act.id,'activity_type',v_act.activity_type,'channel',v_act.channel),v_user);
 return to_jsonb(v_act);
end $$;

create or replace function public.finance_create_payable_payment_v2(p_invoice_id uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_user uuid:=auth.uid();v_role text:=public.finance_current_role();v public.invoices%rowtype;v_amount numeric:=coalesce(nullif(p_payload->>'amount','')::numeric,0);v_committed numeric;v_alloc numeric;v_payment jsonb;
begin
 if v_user is null or v_role not in ('admin','ceo','manager','finance') then raise exception 'Finance write access required.';end if;
 select * into v from public.invoices where id=p_invoice_id for update;if not found or v.invoice_type<>'payable' then raise exception 'Payable not found.';end if;
 if v.status not in ('issued','partially_paid','overdue') then raise exception 'Payable must be issued before payment instruction.';end if;
 if v.approval_status<>'approved' then raise exception 'Payable must be approved before payment instruction.';end if;
 if v.payment_hold or v.dispute_status='disputed' then raise exception 'Payable is on hold or disputed.';end if;
 if v_amount<=0 then raise exception 'Payment amount must be greater than zero.';end if;
 select coalesce(sum(amount),0) into v_committed from public.payments where invoice_id=v.id and payment_type='payment' and status in ('pending','approved','completed');
 select coalesce(sum(pa.amount),0) into v_alloc from public.payment_allocations pa join public.payments p on p.id=pa.payment_id where pa.invoice_id=v.id and p.payment_type='payment' and p.status='completed';
 if v_amount>v.total_amount-v_committed-v_alloc+0.0001 then raise exception 'Payment instruction exceeds uncommitted payable balance.';end if;
 v_payment:=public.finance_create_payment_v1(jsonb_build_object('payment_type','payment','invoice_id',v.id,'deal_id',v.deal_id,'supplier_id',v.supplier_id,'currency',v.currency,'amount',v_amount,'payment_date',coalesce(nullif(p_payload->>'payment_date',''),current_date::text),'method',coalesce(nullif(p_payload->>'method',''),'bank_transfer'),'priority',coalesce(nullif(p_payload->>'priority',''),v.payment_priority,'normal'),'scheduled_date',coalesce(nullif(p_payload->>'scheduled_date',''),v.scheduled_payment_date::text),'purpose',coalesce(nullif(p_payload->>'purpose',''),'Supplier invoice '||v.invoice_no),'notes',nullif(p_payload->>'notes',''),'beneficiary_name',nullif(p_payload->>'beneficiary_name',''),'beneficiary_bank',nullif(p_payload->>'beneficiary_bank',''),'beneficiary_iban',nullif(p_payload->>'beneficiary_iban',''),'beneficiary_swift',nullif(p_payload->>'beneficiary_swift',''),'source_account',nullif(p_payload->>'source_account','')));
 return v_payment;
end $$;

create or replace function public.finance_allocate_payment_v2(p_invoice_id uuid,p_payment_id uuid,p_amount numeric,p_notes text default null) returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_user uuid:=auth.uid();v_role text:=public.finance_current_role();v public.invoices%rowtype;p public.payments%rowtype;inv_used numeric;pay_used numeric;new_used numeric;a public.payment_allocations%rowtype;
begin
 if v_user is null or v_role not in ('admin','ceo','manager','finance') then raise exception 'Finance write access required.';end if;
 if coalesce(p_amount,0)<=0 then raise exception 'Allocation amount must be greater than zero.';end if;
 select * into v from public.invoices where id=p_invoice_id for update;if not found or v.invoice_type<>'payable' then raise exception 'Payable not found.';end if;
 if v.status in ('paid','cancelled') then raise exception 'Payable is closed.';end if;
 select * into p from public.payments where id=p_payment_id for update;if not found or p.payment_type<>'payment' then raise exception 'Outgoing payment not found.';end if;
 if p.status<>'completed' then raise exception 'Only completed payments can be allocated.';end if;
 if p.invoice_id is not null then raise exception 'Payment is already linked directly to an invoice.';end if;
 if p.currency<>v.currency then raise exception 'Payment and payable currencies must match.';end if;
 if p.supplier_id is not null and p.supplier_id<>v.supplier_id then raise exception 'Payment supplier does not match payable supplier.';end if;
 select coalesce(sum(amount),0) into inv_used from public.payment_allocations where invoice_id=v.id;select coalesce(sum(amount),0) into pay_used from public.payment_allocations where payment_id=p.id;
 if p_amount>v.total_amount-inv_used+0.0001 then raise exception 'Allocation exceeds payable outstanding balance.';end if;if p_amount>p.amount-pay_used+0.0001 then raise exception 'Allocation exceeds unapplied payment balance.';end if;
 insert into public.payment_allocations(payment_id,invoice_id,amount,currency,allocated_by,notes) values(p.id,v.id,p_amount,v.currency,v_user,nullif(btrim(p_notes),'')) returning * into a;
 new_used:=inv_used+p_amount;update public.invoices set status=case when new_used+0.0001>=total_amount then 'paid' else 'partially_paid' end,updated_at=now() where id=v.id returning * into v;
 insert into public.finance_events(entity_type,entity_id,event_type,metadata,performed_by) values('invoice',v.id,'payable_payment_allocated',jsonb_build_object('payment_id',p.id,'allocation_id',a.id,'amount',p_amount,'invoice_status',v.status),v_user);
 return jsonb_build_object('allocation',to_jsonb(a),'invoice',to_jsonb(v));
end $$;

create or replace function public.finance_payables_snapshot_v2() returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_user uuid:=auth.uid();v_role text:=public.finance_current_role();
begin
 if v_user is null or v_role not in ('admin','ceo','manager','finance') then raise exception 'Finance access required.';end if;
 return jsonb_build_object('role',v_role,'can_write',v_role in ('admin','ceo','manager','finance'),'can_approve',v_role in ('admin','ceo','manager'),'invoices',(select coalesce(jsonb_agg(to_jsonb(x) order by x.due_date nulls last,x.created_at desc),'[]'::jsonb) from (select i.*,s.company_name supplier_name,s.currency supplier_currency,s.payment_terms supplier_payment_terms,p.full_name finance_owner_name from public.invoices i left join public.suppliers s on s.id=i.supplier_id left join public.profiles p on p.id=i.finance_owner_id where i.invoice_type='payable') x),'payments',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) from (select p.* from public.payments p where p.payment_type='payment') x),'allocations',(select coalesce(jsonb_agg(to_jsonb(pa) order by pa.allocated_at desc),'[]'::jsonb) from public.payment_allocations pa join public.invoices i on i.id=pa.invoice_id where i.invoice_type='payable'),'activities',(select coalesce(jsonb_agg(to_jsonb(x) order by x.activity_at desc),'[]'::jsonb) from (select a.*,p.full_name creator_name from public.payable_activities a left join public.profiles p on p.id=a.created_by) x),'suppliers',(select coalesce(jsonb_agg(to_jsonb(x) order by x.company_name),'[]'::jsonb) from (select id,company_name,status,currency,payment_terms,kyc_status from public.suppliers where status='active') x),'profiles',(select coalesce(jsonb_agg(to_jsonb(x) order by x.full_name),'[]'::jsonb) from (select id,full_name,role from public.profiles where active=true) x));
end $$;

revoke all on function public.finance_create_payable_v2(jsonb,boolean) from public,anon;revoke all on function public.finance_decide_payable_v2(uuid,text,text) from public,anon;revoke all on function public.finance_set_payable_control_v2(uuid,text,boolean,date,uuid,text,text) from public,anon;revoke all on function public.finance_add_payable_activity_v2(jsonb) from public,anon;revoke all on function public.finance_create_payable_payment_v2(uuid,jsonb) from public,anon;revoke all on function public.finance_allocate_payment_v2(uuid,uuid,numeric,text) from public,anon;revoke all on function public.finance_payables_snapshot_v2() from public,anon;
grant execute on function public.finance_create_payable_v2(jsonb,boolean) to authenticated;grant execute on function public.finance_decide_payable_v2(uuid,text,text) to authenticated;grant execute on function public.finance_set_payable_control_v2(uuid,text,boolean,date,uuid,text,text) to authenticated;grant execute on function public.finance_add_payable_activity_v2(jsonb) to authenticated;grant execute on function public.finance_create_payable_payment_v2(uuid,jsonb) to authenticated;grant execute on function public.finance_allocate_payment_v2(uuid,uuid,numeric,text) to authenticated;grant execute on function public.finance_payables_snapshot_v2() to authenticated;
