drop policy if exists authenticated_insert on public.shipments;
drop policy if exists authenticated_update on public.shipments;
drop policy if exists shipping_insert on public.shipments;
drop policy if exists shipping_update on public.shipments;
create policy shipping_insert on public.shipments for insert to authenticated with check (public.shipping_can_write());
create policy shipping_update on public.shipments for update to authenticated using (public.shipping_can_write()) with check (public.shipping_can_write());

create or replace function public.shipment_creation_status_guard_v1() returns trigger language plpgsql as $$
begin
  if new.status is null then new.status:='planning'; end if;
  if new.status<>'planning' then raise exception 'New shipments must start in planning status'; end if;
  return new;
end $$;
drop trigger if exists trg_shipment_creation_status_guard on public.shipments;
create trigger trg_shipment_creation_status_guard before insert on public.shipments for each row execute function public.shipment_creation_status_guard_v1();
revoke insert,update,delete on public.shipment_status_events from authenticated;
grant select on public.shipment_status_events to authenticated;
