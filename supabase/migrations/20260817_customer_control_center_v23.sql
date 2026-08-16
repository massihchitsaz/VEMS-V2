create table if not exists public.customer_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  event_type text not null,
  from_value text,
  to_value text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  performed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.customer_events enable row level security;
create index if not exists idx_customer_events_customer_created on public.customer_events(customer_id, created_at desc);
create unique index if not exists ux_customers_customer_code_ci on public.customers(lower(customer_code)) where customer_code is not null;
alter table public.customers drop constraint if exists customers_status_check;
alter table public.customers add constraint customers_status_check check (status in ('lead','active','inactive','blocked'));
alter table public.customers drop constraint if exists customers_type_check;
alter table public.customers add constraint customers_type_check check (customer_type in ('customer','supplier','both','agent','shipping_line','warehouse'));
alter table public.customers drop constraint if exists customers_credit_limit_check;
alter table public.customers add constraint customers_credit_limit_check check (coalesce(credit_limit,0) >= 0);
create or replace function public.customer_current_role() returns text language sql stable security definer set search_path=public as $$ select coalesce((select role::text from public.profiles where id=auth.uid() and active=true limit 1),'unknown') $$;
create or replace function public.customer_can_write() returns boolean language sql stable security definer set search_path=public as $$ select public.customer_current_role() in ('admin','ceo','manager','dealer') $$;
create or replace function public.customer_can_control_credit() returns boolean language sql stable security definer set search_path=public as $$ select public.customer_current_role() in ('admin','ceo','manager') $$;
create or replace function public.customer_can_delete() returns boolean language sql stable security definer set search_path=public as $$ select public.customer_current_role() in ('admin','ceo') $$;
revoke all on function public.customer_current_role() from public;
revoke all on function public.customer_can_write() from public;
revoke all on function public.customer_can_control_credit() from public;
revoke all on function public.customer_can_delete() from public;
grant execute on function public.customer_current_role() to authenticated,service_role;
grant execute on function public.customer_can_write() to authenticated,service_role;
grant execute on function public.customer_can_control_credit() to authenticated,service_role;
grant execute on function public.customer_can_delete() to authenticated,service_role;
drop policy if exists "Authenticated users can insert customers" on public.customers;
drop policy if exists "Authenticated users can update customers" on public.customers;
drop policy if exists "Admins can delete customers" on public.customers;
drop policy if exists customers_read_authenticated on public.customers;
drop policy if exists customers_insert_roles on public.customers;
drop policy if exists customers_update_roles on public.customers;
drop policy if exists customers_delete_roles on public.customers;
create policy customers_read_authenticated on public.customers for select to authenticated using (true);
create policy customers_insert_roles on public.customers for insert to authenticated with check (public.customer_can_write());
create policy customers_update_roles on public.customers for update to authenticated using (public.customer_can_write()) with check (public.customer_can_write());
create policy customers_delete_roles on public.customers for delete to authenticated using (public.customer_can_delete());
drop policy if exists customer_events_read_authenticated on public.customer_events;
create policy customer_events_read_authenticated on public.customer_events for select to authenticated using (true);
create or replace function public.customer_sensitive_update_guard() returns trigger language plpgsql set search_path=public as $$ begin if current_user not in ('postgres','service_role') then if new.status is distinct from old.status or new.credit_limit is distinct from old.credit_limit or new.currency is distinct from old.currency or new.assigned_to is distinct from old.assigned_to then raise exception 'Sensitive customer controls must use controlled customer workflows.'; end if; end if; return new; end $$;
drop trigger if exists trg_customer_sensitive_update_guard on public.customers;
create trigger trg_customer_sensitive_update_guard before update on public.customers for each row execute function public.customer_sensitive_update_guard();
create or replace function public.customer_set_status_v1(p_customer_id uuid,p_status text,p_reason text default null) returns public.customers language plpgsql security definer set search_path=public as $$ declare v_role text:=public.customer_current_role(); v_row public.customers; v_old text; begin if v_role not in ('admin','ceo','manager','dealer') then raise exception 'Customer status change is not permitted for this role.'; end if; if p_status not in ('lead','active','inactive','blocked') then raise exception 'Invalid customer status.'; end if; if p_status='blocked' and v_role not in ('admin','ceo','manager') then raise exception 'Only customer controllers can block an account.'; end if; if p_status in ('inactive','blocked') and length(trim(coalesce(p_reason,'')))<5 then raise exception 'A reason of at least 5 characters is required.'; end if; select * into v_row from public.customers where id=p_customer_id for update; if not found then raise exception 'Customer not found.'; end if; v_old:=v_row.status; update public.customers set status=p_status,updated_at=now() where id=p_customer_id returning * into v_row; insert into public.customer_events(customer_id,event_type,from_value,to_value,reason,performed_by) values(p_customer_id,'status_changed',v_old,p_status,nullif(trim(coalesce(p_reason,'')),''),auth.uid()); return v_row; end $$;
create or replace function public.customer_set_credit_v1(p_customer_id uuid,p_credit_limit numeric,p_currency text,p_reason text) returns public.customers language plpgsql security definer set search_path=public as $$ declare v_row public.customers; v_old_limit numeric; v_old_currency text; begin if not public.customer_can_control_credit() then raise exception 'Credit control requires manager-level permission.'; end if; if p_credit_limit<0 then raise exception 'Credit limit cannot be negative.'; end if; if length(trim(coalesce(p_reason,'')))<5 then raise exception 'Credit change reason must contain at least 5 characters.'; end if; select * into v_row from public.customers where id=p_customer_id for update; if not found then raise exception 'Customer not found.'; end if; v_old_limit:=coalesce(v_row.credit_limit,0); v_old_currency:=coalesce(v_row.currency,'AED'); update public.customers set credit_limit=p_credit_limit,currency=upper(trim(p_currency)),updated_at=now() where id=p_customer_id returning * into v_row; insert into public.customer_events(customer_id,event_type,from_value,to_value,reason,metadata,performed_by) values(p_customer_id,'credit_changed',v_old_currency||' '||v_old_limit::text,upper(trim(p_currency))||' '||p_credit_limit::text,trim(p_reason),jsonb_build_object('old_limit',v_old_limit,'new_limit',p_credit_limit,'old_currency',v_old_currency,'new_currency',upper(trim(p_currency))),auth.uid()); return v_row; end $$;
create or replace function public.customer_assign_owner_v1(p_customer_id uuid,p_owner_id uuid,p_reason text default null) returns public.customers language plpgsql security definer set search_path=public as $$ declare v_role text:=public.customer_current_role(); v_row public.customers; v_old uuid; begin if v_role not in ('admin','ceo','manager','dealer') then raise exception 'Owner assignment is not permitted for this role.'; end if; if v_role='dealer' and p_owner_id is distinct from auth.uid() then raise exception 'Dealer users may only assign an account to themselves.'; end if; if p_owner_id is not null and not exists(select 1 from public.profiles where id=p_owner_id and active=true) then raise exception 'Selected owner is not an active user.'; end if; select * into v_row from public.customers where id=p_customer_id for update; if not found then raise exception 'Customer not found.'; end if; v_old:=v_row.assigned_to; update public.customers set assigned_to=p_owner_id,updated_at=now() where id=p_customer_id returning * into v_row; insert into public.customer_events(customer_id,event_type,from_value,to_value,reason,performed_by) values(p_customer_id,'owner_changed',v_old::text,p_owner_id::text,nullif(trim(coalesce(p_reason,'')),''),auth.uid()); return v_row; end $$;
grant execute on function public.customer_set_status_v1(uuid,text,text) to authenticated,service_role;
grant execute on function public.customer_set_credit_v1(uuid,numeric,text,text) to authenticated,service_role;
grant execute on function public.customer_assign_owner_v1(uuid,uuid,text) to authenticated,service_role;
revoke all on function public.customer_set_status_v1(uuid,text,text) from anon;
revoke all on function public.customer_set_credit_v1(uuid,numeric,text,text) from anon;
revoke all on function public.customer_assign_owner_v1(uuid,uuid,text) from anon;
