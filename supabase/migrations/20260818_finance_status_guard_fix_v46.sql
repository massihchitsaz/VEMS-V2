-- Finance v46: remove transaction-scoped GUC bypass from payment/invoice status guards.
-- Controlled SECURITY DEFINER workflow functions execute as database owner; direct authenticated updates remain blocked.

create or replace function public.payment_status_guard_v1()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if tg_op='UPDATE'
     and new.status is distinct from old.status
     and current_user not in ('postgres','service_role') then
    raise exception 'Payment status is controlled by Finance Workflow.';
  end if;
  if tg_op='INSERT' and current_user not in ('postgres','service_role') then
    new.status := 'pending';
    new.approved_by := null;
  end if;
  return new;
end $$;

create or replace function public.invoice_status_guard_v1()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if tg_op='UPDATE'
     and new.status is distinct from old.status
     and current_user not in ('postgres','service_role') then
    raise exception 'Invoice status is controlled by Finance Workflow.';
  end if;
  return new;
end $$;

drop function if exists public.finance_internal_change();
