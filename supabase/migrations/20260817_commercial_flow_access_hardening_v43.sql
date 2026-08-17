-- Commercial Flow Integration access hardening v43

drop policy if exists authenticated_insert on public.opportunities;
drop policy if exists authenticated_update on public.opportunities;
drop policy if exists manager_delete on public.opportunities;
create policy opportunities_insert_roles on public.opportunities for insert to authenticated with check (public.commercial_flow_role() in ('admin','ceo','manager','dealer') and (public.commercial_flow_role()<>'dealer' or coalesce(owner_id,created_by)=auth.uid()));
create policy opportunities_update_roles on public.opportunities for update to authenticated using (public.commercial_flow_role() in ('admin','ceo','manager') or (public.commercial_flow_role()='dealer' and coalesce(owner_id,created_by)=auth.uid())) with check (public.commercial_flow_role() in ('admin','ceo','manager') or (public.commercial_flow_role()='dealer' and coalesce(owner_id,created_by)=auth.uid()));

drop policy if exists authenticated_insert on public.invoices;
drop policy if exists authenticated_update on public.invoices;
create policy invoices_insert_finance_roles on public.invoices for insert to authenticated with check (public.current_app_role() in ('admin','ceo','manager','finance'));
create policy invoices_update_finance_roles on public.invoices for update to authenticated using (public.current_app_role() in ('admin','ceo','manager','finance')) with check (public.current_app_role() in ('admin','ceo','manager','finance'));

drop policy if exists manager_delete on public.quotations;
revoke execute on function public.save_quotation_v3(jsonb) from authenticated;
revoke execute on function public.save_quotation_v2(jsonb) from authenticated;
