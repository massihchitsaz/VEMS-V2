create or replace function public.treasury_can_write()
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(public.current_app_role(),'unknown') in ('admin','ceo','manager','finance')
$$;
revoke all on function public.treasury_can_write() from public,anon;
grant execute on function public.treasury_can_write() to authenticated,service_role;

drop policy if exists "Controllers can update unlocked deals" on public.deals;

do $$ declare t text; begin
  foreach t in array array['warehouses','warehouse_locations','inventory_items','inventory_lots','inventory_movements','inventory_reservations','inventory_events'] loop
    execute format('drop policy if exists %I on public.%I', case t when 'warehouses' then 'inventory_write_warehouses' when 'warehouse_locations' then 'inventory_write_locations' when 'inventory_items' then 'inventory_write_items' when 'inventory_lots' then 'inventory_write_lots' when 'inventory_movements' then 'inventory_write_movements' when 'inventory_reservations' then 'inventory_write_reservations' else 'inventory_write_events' end,t);
    execute format('drop policy if exists inventory_insert_v37 on public.%I',t);
    execute format('drop policy if exists inventory_update_v37 on public.%I',t);
    execute format('drop policy if exists inventory_delete_v37 on public.%I',t);
    execute format('create policy inventory_insert_v37 on public.%I for insert to authenticated with check ((select public.inventory_can_write()))',t);
    execute format('create policy inventory_update_v37 on public.%I for update to authenticated using ((select public.inventory_can_write())) with check ((select public.inventory_can_write()))',t);
    execute format('create policy inventory_delete_v37 on public.%I for delete to authenticated using ((select public.inventory_can_write()))',t);
  end loop;
end $$;

do $$ declare t text; begin
  foreach t in array array['shipment_units','shipment_milestones','shipment_events','shipment_charges'] loop
    execute format('drop policy if exists shipping_write on public.%I',t);
    execute format('drop policy if exists shipping_insert_v37 on public.%I',t);
    execute format('drop policy if exists shipping_update_v37 on public.%I',t);
    execute format('drop policy if exists shipping_delete_v37 on public.%I',t);
    execute format('create policy shipping_insert_v37 on public.%I for insert to authenticated with check ((select public.shipping_can_write()))',t);
    execute format('create policy shipping_update_v37 on public.%I for update to authenticated using ((select public.shipping_can_write())) with check ((select public.shipping_can_write()))',t);
    execute format('create policy shipping_delete_v37 on public.%I for delete to authenticated using ((select public.shipping_can_write()))',t);
  end loop;
end $$;

drop policy if exists treasury_accounts_write on public.treasury_accounts;
drop policy if exists treasury_accounts_insert_v37 on public.treasury_accounts;
drop policy if exists treasury_accounts_update_v37 on public.treasury_accounts;
drop policy if exists treasury_accounts_delete_v37 on public.treasury_accounts;
create policy treasury_accounts_insert_v37 on public.treasury_accounts for insert to authenticated with check ((select public.treasury_can_write()));
create policy treasury_accounts_update_v37 on public.treasury_accounts for update to authenticated using ((select public.treasury_can_write())) with check ((select public.treasury_can_write()));
create policy treasury_accounts_delete_v37 on public.treasury_accounts for delete to authenticated using ((select public.treasury_can_write()));

drop policy if exists deals_insert_roles on public.deals;
drop policy if exists deals_read_roles on public.deals;
drop policy if exists deals_update_roles on public.deals;
create policy deals_read_roles on public.deals for select to authenticated using ((select public.deal_current_role()) in ('admin','ceo','manager','finance','operations','logistics') or ((select public.deal_current_role())='dealer' and dealer_id=(select auth.uid())));
create policy deals_insert_roles on public.deals for insert to authenticated with check ((select public.deal_can_write()) and ((select public.deal_current_role())<>'dealer' or dealer_id=(select auth.uid())));
create policy deals_update_roles on public.deals for update to authenticated using ((select public.deal_current_role()) in ('admin','ceo','manager') or ((select public.deal_current_role())='dealer' and dealer_id=(select auth.uid()) and status in ('draft','review'))) with check ((select public.deal_current_role()) in ('admin','ceo','manager') or ((select public.deal_current_role())='dealer' and dealer_id=(select auth.uid())));

drop policy if exists quotation_insert_owned on public.quotations;
drop policy if exists quotation_update_owned on public.quotations;
create policy quotation_insert_owned on public.quotations for insert to authenticated with check ((select auth.uid()) is not null and (created_by=(select auth.uid()) or owner_id=(select auth.uid()) or (select public.quotation_can_control())));
create policy quotation_update_owned on public.quotations for update to authenticated using (owner_id=(select auth.uid()) or created_by=(select auth.uid()) or (select public.quotation_can_control())) with check (owner_id=(select auth.uid()) or created_by=(select auth.uid()) or (select public.quotation_can_control()));
drop policy if exists quotation_items_insert_owned on public.quotation_items;
drop policy if exists quotation_items_update_owned on public.quotation_items;
drop policy if exists quotation_items_delete_owned on public.quotation_items;
create policy quotation_items_insert_owned on public.quotation_items for insert to authenticated with check (exists(select 1 from public.quotations q where q.id=quotation_id and (q.owner_id=(select auth.uid()) or q.created_by=(select auth.uid()) or (select public.quotation_can_control()))));
create policy quotation_items_update_owned on public.quotation_items for update to authenticated using (exists(select 1 from public.quotations q where q.id=quotation_id and (q.owner_id=(select auth.uid()) or q.created_by=(select auth.uid()) or (select public.quotation_can_control())))) with check (exists(select 1 from public.quotations q where q.id=quotation_id and (q.owner_id=(select auth.uid()) or q.created_by=(select auth.uid()) or (select public.quotation_can_control()))));
create policy quotation_items_delete_owned on public.quotation_items for delete to authenticated using (exists(select 1 from public.quotations q where q.id=quotation_id and (q.owner_id=(select auth.uid()) or q.created_by=(select auth.uid()) or (select public.quotation_can_control()))));

create index if not exists idx_deals_customer_id on public.deals(customer_id);
create index if not exists idx_deals_supplier_id on public.deals(supplier_id);
create index if not exists idx_deals_dealer_id on public.deals(dealer_id);
create index if not exists idx_deals_quotation_id on public.deals(quotation_id);
create index if not exists idx_deals_opportunity_id on public.deals(opportunity_id);
create index if not exists idx_customers_assigned_to on public.customers(assigned_to);
create index if not exists idx_customers_created_by on public.customers(created_by);
create index if not exists idx_suppliers_created_by on public.suppliers(created_by);
create index if not exists idx_suppliers_kyc_reviewed_by on public.suppliers(kyc_reviewed_by);
create index if not exists idx_quotations_owner_id on public.quotations(owner_id);
create index if not exists idx_quotations_created_by on public.quotations(created_by);
create index if not exists idx_quotations_supplier_id on public.quotations(supplier_id);
create index if not exists idx_quotations_opportunity_id on public.quotations(opportunity_id);
create index if not exists idx_quotation_events_quotation_id on public.quotation_events(quotation_id);
create index if not exists idx_quotation_events_performed_by on public.quotation_events(performed_by);
create index if not exists idx_shipments_customer_id on public.shipments(customer_id);
create index if not exists idx_shipments_supplier_id on public.shipments(supplier_id);
create index if not exists idx_shipments_quotation_id on public.shipments(quotation_id);
create index if not exists idx_shipments_owner_id on public.shipments(owner_id);
create index if not exists idx_shipments_created_by on public.shipments(created_by);
create index if not exists idx_invoices_customer_id on public.invoices(customer_id);
create index if not exists idx_invoices_supplier_id on public.invoices(supplier_id);
create index if not exists idx_invoices_shipment_id on public.invoices(shipment_id);
create index if not exists idx_invoices_created_by on public.invoices(created_by);
create index if not exists idx_payments_deal_id on public.payments(deal_id);
create index if not exists idx_payments_created_by on public.payments(created_by);
create index if not exists idx_inventory_items_customer_id on public.inventory_items(customer_id);
create index if not exists idx_inventory_items_supplier_id on public.inventory_items(supplier_id);
create index if not exists idx_inventory_movements_from_location_id on public.inventory_movements(from_location_id);
create index if not exists idx_inventory_movements_to_location_id on public.inventory_movements(to_location_id);
create index if not exists idx_inventory_movements_performed_by on public.inventory_movements(performed_by);
create index if not exists idx_inventory_reservations_deal_id on public.inventory_reservations(deal_id);
create index if not exists idx_inventory_reservations_shipment_id on public.inventory_reservations(shipment_id);
create index if not exists idx_inventory_reservations_customer_id on public.inventory_reservations(customer_id);
create index if not exists idx_inventory_reservations_reserved_by on public.inventory_reservations(reserved_by);
create index if not exists idx_approvals_requested_by on public.approvals(requested_by);