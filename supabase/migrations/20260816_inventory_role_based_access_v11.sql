create or replace function public.inventory_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select lower(p.role::text) from public.profiles p where p.id = auth.uid() and p.active = true limit 1),'')
$$;

create or replace function public.inventory_can_write()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.inventory_current_role() = any(array['admin','ceo','manager','warehouse','operations','logistics'])
$$;

revoke all on function public.inventory_current_role() from public, anon;
revoke all on function public.inventory_can_write() from public, anon;
grant execute on function public.inventory_current_role() to authenticated, service_role;
grant execute on function public.inventory_can_write() to authenticated, service_role;

alter table public.warehouses enable row level security;
alter table public.warehouse_locations enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_lots enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.inventory_events enable row level security;

do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname='public'
      and tablename in ('warehouses','warehouse_locations','inventory_items','inventory_lots','inventory_movements','inventory_reservations','inventory_events')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

create policy inventory_read_warehouses on public.warehouses for select to authenticated using (true);
create policy inventory_write_warehouses on public.warehouses for all to authenticated using (public.inventory_can_write()) with check (public.inventory_can_write());
create policy inventory_read_locations on public.warehouse_locations for select to authenticated using (true);
create policy inventory_write_locations on public.warehouse_locations for all to authenticated using (public.inventory_can_write()) with check (public.inventory_can_write());
create policy inventory_read_items on public.inventory_items for select to authenticated using (true);
create policy inventory_write_items on public.inventory_items for all to authenticated using (public.inventory_can_write()) with check (public.inventory_can_write());
create policy inventory_read_lots on public.inventory_lots for select to authenticated using (true);
create policy inventory_write_lots on public.inventory_lots for all to authenticated using (public.inventory_can_write()) with check (public.inventory_can_write());
create policy inventory_read_movements on public.inventory_movements for select to authenticated using (true);
create policy inventory_write_movements on public.inventory_movements for all to authenticated using (public.inventory_can_write()) with check (public.inventory_can_write());
create policy inventory_read_reservations on public.inventory_reservations for select to authenticated using (true);
create policy inventory_write_reservations on public.inventory_reservations for all to authenticated using (public.inventory_can_write()) with check (public.inventory_can_write());
create policy inventory_read_events on public.inventory_events for select to authenticated using (true);
create policy inventory_write_events on public.inventory_events for all to authenticated using (public.inventory_can_write()) with check (public.inventory_can_write());

comment on function public.inventory_can_write() is 'Inventory RBAC: write access for admin, ceo, manager, warehouse, operations and logistics roles; other authenticated roles are read-only.';
