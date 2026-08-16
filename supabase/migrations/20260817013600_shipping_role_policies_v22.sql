create or replace function public.shipping_current_role()
returns text language sql stable security definer set search_path=public as $$
  select coalesce((select role::text from public.profiles where id=auth.uid() and active=true),'unknown');
$$;
revoke all on function public.shipping_current_role() from public,anon;
grant execute on function public.shipping_current_role() to authenticated,service_role;

do $$
declare t text;
begin
  foreach t in array array['shipment_units','shipment_milestones','shipment_events','shipment_charges'] loop
    execute format('drop policy if exists authenticated_write on public.%I',t);
    execute format('drop policy if exists shipping_write on public.%I',t);
    execute format('create policy shipping_write on public.%I for all to authenticated using (public.shipping_can_write()) with check (public.shipping_can_write())',t);
  end loop;
end $$;

drop policy if exists manager_delete on public.shipments;
drop policy if exists shipping_delete on public.shipments;
create policy shipping_delete on public.shipments for delete to authenticated using (public.shipping_can_override());
