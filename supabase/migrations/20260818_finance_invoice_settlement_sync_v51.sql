-- VEMS V2 / VTC ONE - Keep invoice status synchronized with completed direct payments and allocations.

create or replace function public.finance_recalculate_invoice_status_v1(p_invoice_id uuid)
returns text language plpgsql security definer set search_path='public' as $$
declare v public.invoices%rowtype;v_direct numeric:=0;v_alloc numeric:=0;v_paid numeric:=0;v_status text;
begin
 select * into v from public.invoices where id=p_invoice_id for update;if not found then return null;end if;
 if v.status in ('draft','cancelled') then return v.status;end if;
 select coalesce(sum(amount),0) into v_direct from public.payments where invoice_id=v.id and status='completed';
 select coalesce(sum(pa.amount),0) into v_alloc from public.payment_allocations pa join public.payments p on p.id=pa.payment_id where pa.invoice_id=v.id and p.status='completed' and p.invoice_id is null;
 v_paid:=v_direct+v_alloc;
 v_status:=case when v_paid<=0 then case when v.due_date is not null and v.due_date<current_date then 'overdue' else 'issued' end when v_paid+0.0001>=v.total_amount then 'paid' else 'partially_paid' end;
 update public.invoices set status=v_status,collection_status=case when invoice_type='receivable' and v_status='paid' then 'closed' else collection_status end,updated_at=now() where id=v.id;
 return v_status;
end $$;
revoke all on function public.finance_recalculate_invoice_status_v1(uuid) from public,anon,authenticated;

create or replace function public.finance_settle_payment_v1(p_payment_id uuid,p_outcome text,p_reference text default null,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_user uuid:=auth.uid();v_role text:=public.finance_current_role();v public.payments%rowtype;v_to text;v_invoice_status text;
begin
 if v_user is null or v_role not in ('admin','ceo','manager','finance') then raise exception 'Finance write access required.';end if;
 if p_outcome not in ('completed','failed') then raise exception 'Outcome must be completed or failed.';end if;
 select * into v from public.payments where id=p_payment_id for update;if not found then raise exception 'Payment not found.';end if;
 if v.status<>'approved' then raise exception 'Only approved payments can be settled.';end if;
 if p_outcome='failed' and length(btrim(coalesce(p_reason,'')))<5 then raise exception 'Failure reason is required.';end if;
 v_to:=p_outcome;
 update public.payments set status=v_to,reference_no=coalesce(nullif(btrim(p_reference),''),reference_no),executed_at=case when v_to='completed' then now() else executed_at end,settlement_status=case when v_to='completed' then 'settled' else 'failed' end,failure_reason=case when v_to='failed' then btrim(p_reason) else null end,updated_at=now() where id=p_payment_id returning * into v;
 if v.invoice_id is not null then v_invoice_status:=public.finance_recalculate_invoice_status_v1(v.invoice_id);end if;
 insert into public.finance_events(entity_type,entity_id,event_type,from_status,to_status,reason,metadata,performed_by) values('payment',v.id,'payment_'||v_to,'approved',v_to,nullif(btrim(p_reason),''),jsonb_build_object('reference_no',v.reference_no,'invoice_id',v.invoice_id,'invoice_status',v_invoice_status),v_user);
 return to_jsonb(v);
end $$;

create or replace function public.finance_cancel_payment_v1(p_payment_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_user uuid:=auth.uid();v_role text:=public.finance_current_role();v public.payments%rowtype;v_from text;v_invoice_status text;
begin
 if v_user is null or v_role not in ('admin','ceo','manager','finance') then raise exception 'Finance write access required.';end if;
 if length(btrim(coalesce(p_reason,'')))<5 then raise exception 'Cancellation reason is required.';end if;
 select * into v from public.payments where id=p_payment_id for update;if not found then raise exception 'Payment not found.';end if;
 if v.status not in ('pending','approved') then raise exception 'Only pending or approved payments can be cancelled.';end if;
 v_from:=v.status;
 update public.payments set status='cancelled',approval_status='cancelled',failure_reason=btrim(p_reason),updated_at=now() where id=p_payment_id returning * into v;
 if v.invoice_id is not null then v_invoice_status:=public.finance_recalculate_invoice_status_v1(v.invoice_id);end if;
 insert into public.finance_events(entity_type,entity_id,event_type,from_status,to_status,reason,metadata,performed_by) values('payment',v.id,'payment_cancelled',v_from,'cancelled',btrim(p_reason),jsonb_build_object('invoice_id',v.invoice_id,'invoice_status',v_invoice_status),v_user);
 return to_jsonb(v);
end $$;
