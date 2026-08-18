create or replace function public.payment_sensitive_guard_v2()
returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op='UPDATE' and current_user not in ('postgres','service_role') then
    if new.status is distinct from old.status
       or new.approval_status is distinct from old.approval_status
       or new.approved_by is distinct from old.approved_by
       or new.compliance_status is distinct from old.compliance_status
       or new.compliance_notes is distinct from old.compliance_notes
       or new.settlement_status is distinct from old.settlement_status
       or new.reconciliation_status is distinct from old.reconciliation_status
       or new.executed_at is distinct from old.executed_at then
      raise exception 'Payment execution fields are controlled by Finance Workflow.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_payment_sensitive_guard_v2 on public.payments;
create trigger trg_payment_sensitive_guard_v2 before update on public.payments for each row execute function public.payment_sensitive_guard_v2();

create or replace function public.finance_set_payment_compliance_v2(p_payment_id uuid,p_status text,p_notes text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_role text:=public.finance_current_role(); v public.payments%rowtype; v_from text;
begin
 if v_user is null or v_role not in ('admin','ceo','manager','finance') then raise exception 'Finance write access required.'; end if;
 if p_status not in ('pending','clear','review','held','rejected') then raise exception 'Invalid compliance status.'; end if;
 if p_status in ('held','rejected') and length(btrim(coalesce(p_notes,'')))<5 then raise exception 'Compliance reason is required.'; end if;
 select * into v from public.payments where id=p_payment_id for update; if not found then raise exception 'Payment not found.'; end if;
 if v.status in ('completed','cancelled') then raise exception 'Compliance cannot be changed after completion or cancellation.'; end if;
 v_from:=coalesce(v.compliance_status,'pending');
 update public.payments set compliance_status=p_status,compliance_notes=nullif(btrim(p_notes),''),updated_at=now() where id=p_payment_id returning * into v;
 insert into public.finance_events(entity_type,entity_id,event_type,from_status,to_status,reason,performed_by) values('payment',v.id,'payment_compliance_changed',v_from,p_status,nullif(btrim(p_notes),''),v_user);
 return to_jsonb(v);
end $$;

create or replace function public.finance_set_payment_reconciliation_v2(p_payment_id uuid,p_status text,p_reference text default null,p_value_date date default null,p_notes text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_role text:=public.finance_current_role(); v public.payments%rowtype; v_from text;
begin
 if v_user is null or v_role not in ('admin','ceo','manager','finance') then raise exception 'Finance write access required.'; end if;
 if p_status not in ('unreconciled','partial','reconciled') then raise exception 'Invalid reconciliation status.'; end if;
 select * into v from public.payments where id=p_payment_id for update; if not found then raise exception 'Payment not found.'; end if;
 if v.status<>'completed' then raise exception 'Only completed payments can be reconciled.'; end if;
 if p_status='reconciled' and length(btrim(coalesce(p_reference,v.reference_no,'')))<2 then raise exception 'Bank reference is required for reconciliation.'; end if;
 v_from:=coalesce(v.reconciliation_status,'unreconciled');
 update public.payments set reconciliation_status=p_status,reference_no=coalesce(nullif(btrim(p_reference),''),reference_no),value_date=coalesce(p_value_date,value_date),updated_at=now() where id=p_payment_id returning * into v;
 insert into public.finance_events(entity_type,entity_id,event_type,from_status,to_status,reason,metadata,performed_by) values('payment',v.id,'payment_reconciliation_changed',v_from,p_status,nullif(btrim(p_notes),''),jsonb_build_object('reference_no',v.reference_no,'value_date',v.value_date),v_user);
 return to_jsonb(v);
end $$;

create or replace function public.finance_add_payment_event_v2(p_payment_id uuid,p_event_type text,p_event_at timestamptz default now(),p_bank_reference text default null,p_notes text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_role text:=public.finance_current_role(); v_id uuid;
begin
 if v_user is null or v_role not in ('admin','ceo','manager','finance') then raise exception 'Finance write access required.'; end if;
 if not exists(select 1 from public.payments where id=p_payment_id) then raise exception 'Payment not found.'; end if;
 if length(btrim(coalesce(p_event_type,'')))<2 then raise exception 'Event type is required.'; end if;
 if length(btrim(coalesce(p_notes,'')))<2 and length(btrim(coalesce(p_bank_reference,'')))<2 then raise exception 'Event note or bank reference is required.'; end if;
 insert into public.payment_events(payment_id,event_type,event_at,notes,bank_reference,created_by) values(p_payment_id,btrim(p_event_type),coalesce(p_event_at,now()),nullif(btrim(p_notes),''),nullif(btrim(p_bank_reference),''),v_user) returning id into v_id;
 return jsonb_build_object('id',v_id,'payment_id',p_payment_id);
end $$;

alter table public.payment_events enable row level security;
drop policy if exists "payment_events_authenticated_all" on public.payment_events;
drop policy if exists payment_events_read_finance_roles on public.payment_events;
create policy payment_events_read_finance_roles on public.payment_events for select to authenticated using ((select public.finance_current_role()) in ('admin','ceo','manager','finance'));
drop policy if exists payments_delete_control on public.payments;
revoke all on function public.finance_set_payment_compliance_v2(uuid,text,text) from public,anon;
revoke all on function public.finance_set_payment_reconciliation_v2(uuid,text,text,date,text) from public,anon;
revoke all on function public.finance_add_payment_event_v2(uuid,text,timestamptz,text,text) from public,anon;
grant execute on function public.finance_set_payment_compliance_v2(uuid,text,text) to authenticated,service_role;
grant execute on function public.finance_set_payment_reconciliation_v2(uuid,text,text,date,text) to authenticated,service_role;
grant execute on function public.finance_add_payment_event_v2(uuid,text,timestamptz,text,text) to authenticated,service_role;
