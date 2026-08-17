drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy profiles_select_v38 on public.profiles for select to authenticated using (id=(select auth.uid()) or (select public.current_user_role())='admin'::app_role);

drop policy if exists "Authenticated users can create fx deals" on public.fx_deals;
create policy "Authenticated users can create fx deals" on public.fx_deals for insert to authenticated with check (dealer_id=(select auth.uid()));
drop policy if exists "Authenticated users can create fx history" on public.fx_rate_history;
create policy "Authenticated users can create fx history" on public.fx_rate_history for insert to authenticated with check (changed_by=(select auth.uid()));
drop policy if exists "Authenticated users can create fx settlements" on public.fx_settlements;
create policy "Authenticated users can create fx settlements" on public.fx_settlements for insert to authenticated with check (created_by=(select auth.uid()));

drop policy if exists authenticated_insert on public.invoices;
drop policy if exists authenticated_update on public.invoices;
create policy authenticated_insert on public.invoices for insert to authenticated with check ((select auth.uid()) is not null);
create policy authenticated_update on public.invoices for update to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);

drop policy if exists authenticated_insert on public.opportunities;
drop policy if exists authenticated_update on public.opportunities;
create policy authenticated_insert on public.opportunities for insert to authenticated with check ((select auth.uid()) is not null);
create policy authenticated_update on public.opportunities for update to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);

drop policy if exists authenticated_insert on public.payments;
drop policy if exists authenticated_update on public.payments;
create policy authenticated_insert on public.payments for insert to authenticated with check ((select auth.uid()) is not null);
create policy authenticated_update on public.payments for update to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);

drop policy if exists authenticated_insert on public.tasks;
drop policy if exists authenticated_update on public.tasks;
create policy authenticated_insert on public.tasks for insert to authenticated with check ((select auth.uid()) is not null);
create policy authenticated_update on public.tasks for update to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);

drop policy if exists own_notifications_select on public.notifications;
drop policy if exists own_notifications_update on public.notifications;
drop policy if exists system_notifications_insert on public.notifications;
create policy own_notifications_select on public.notifications for select to authenticated using (user_id=(select auth.uid()) or (select public.current_app_role()) in ('admin','ceo','manager'));
create policy own_notifications_update on public.notifications for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy system_notifications_insert on public.notifications for insert to authenticated with check ((select auth.uid()) is not null);

drop policy if exists treasury_forecast_adjustments_insert on public.treasury_forecast_adjustments;
create policy treasury_forecast_adjustments_insert on public.treasury_forecast_adjustments for insert to authenticated with check ((select auth.uid())=created_by);

drop policy if exists document_activity_insert_authorized on public.document_activity;
create policy document_activity_insert_authorized on public.document_activity for insert to authenticated with check ((select public.document_can_write()) and (actor_id is null or actor_id=(select auth.uid())));

drop policy if exists approvals_insert_authenticated on public.approvals;
drop policy if exists approvals_update_owner_or_approver on public.approvals;
create policy approvals_insert_authenticated on public.approvals for insert to authenticated with check ((select auth.uid()) is not null);
create policy approvals_update_owner_or_approver on public.approvals for update to authenticated using ((select auth.uid())=approver_id or (select auth.uid())=requested_by or (select public.document_can_approve())) with check ((select auth.uid())=approver_id or (select auth.uid())=requested_by or (select public.document_can_approve()));

drop policy if exists document_insert_authorized on public.documents;
create policy document_insert_authorized on public.documents for insert to authenticated with check ((select public.document_can_write()) and (uploaded_by is null or uploaded_by=(select auth.uid())) and coalesce(status,'draft')='draft');

create index if not exists idx_audit_logs_user_id on public.audit_logs(user_id);
create index if not exists idx_collection_activities_created_by on public.collection_activities(created_by);
create index if not exists idx_customer_events_performed_by on public.customer_events(performed_by);
create index if not exists idx_deal_events_performed_by on public.deal_events(performed_by);
create index if not exists idx_document_activity_actor_id on public.document_activity(actor_id);
create index if not exists idx_document_requirement_rules_created_by on public.document_requirement_rules(created_by);
create index if not exists idx_documents_approved_by on public.documents(approved_by);
create index if not exists idx_documents_uploaded_by on public.documents(uploaded_by);
create index if not exists idx_fx_approvals_approver_id on public.fx_approvals(approver_id);
create index if not exists idx_fx_deals_approved_by on public.fx_deals(approved_by);
create index if not exists idx_fx_deals_dealer_id on public.fx_deals(dealer_id);
create index if not exists idx_fx_rate_history_changed_by on public.fx_rate_history(changed_by);
create index if not exists idx_fx_settlements_created_by on public.fx_settlements(created_by);
create index if not exists idx_inventory_events_performed_by on public.inventory_events(performed_by);
create index if not exists idx_invoices_approved_by on public.invoices(approved_by);
create index if not exists idx_invoices_collection_owner_id on public.invoices(collection_owner_id);
create index if not exists idx_invoices_finance_owner_id on public.invoices(finance_owner_id);
create index if not exists idx_opportunities_created_by on public.opportunities(created_by);
create index if not exists idx_opportunities_owner_id on public.opportunities(owner_id);
create index if not exists idx_opportunities_quotation_id on public.opportunities(quotation_id);
create index if not exists idx_payable_activities_created_by on public.payable_activities(created_by);
create index if not exists idx_payable_activities_invoice_id on public.payable_activities(invoice_id);
create index if not exists idx_payment_allocations_allocated_by on public.payment_allocations(allocated_by);
create index if not exists idx_payment_events_created_by on public.payment_events(created_by);
create index if not exists idx_payments_approved_by on public.payments(approved_by);
create index if not exists idx_pending_users_created_by on public.pending_users(created_by);
create index if not exists idx_quotation_versions_created_by on public.quotation_versions(created_by);
create index if not exists idx_shipment_charges_vendor_id on public.shipment_charges(vendor_id);
create index if not exists idx_shipment_events_created_by on public.shipment_events(created_by);
create index if not exists idx_shipment_events_unit_id on public.shipment_events(unit_id);
create index if not exists idx_shipment_status_events_performed_by on public.shipment_status_events(performed_by);
create index if not exists idx_supplier_events_performed_by on public.supplier_events(performed_by);
create index if not exists idx_tasks_created_by on public.tasks(created_by);
create index if not exists idx_treasury_accounts_created_by on public.treasury_accounts(created_by);
create index if not exists idx_treasury_accounts_owner_id on public.treasury_accounts(owner_id);
create index if not exists idx_treasury_forecast_adjustments_created_by on public.treasury_forecast_adjustments(created_by);