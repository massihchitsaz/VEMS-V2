-- v48: RLS init-plan optimization and finance audit actor index.
create index if not exists finance_events_performed_by_idx on public.finance_events(performed_by);

drop policy if exists opportunities_insert_roles on public.opportunities;
create policy opportunities_insert_roles on public.opportunities for insert to authenticated with check (
  public.commercial_flow_role() in ('admin','ceo','manager','dealer')
  and (public.commercial_flow_role()<>'dealer' or coalesce(owner_id,created_by)=(select auth.uid()))
);
drop policy if exists opportunities_update_roles on public.opportunities;
create policy opportunities_update_roles on public.opportunities for update to authenticated using (
  public.commercial_flow_can_control() or owner_id=(select auth.uid()) or created_by=(select auth.uid())
) with check (
  public.commercial_flow_can_control() or owner_id=(select auth.uid()) or created_by=(select auth.uid())
);
drop policy if exists opportunities_read_roles on public.opportunities;
create policy opportunities_read_roles on public.opportunities for select to authenticated using (
  public.commercial_flow_can_control() or owner_id=(select auth.uid()) or created_by=(select auth.uid())
);
drop policy if exists quotations_read_roles on public.quotations;
create policy quotations_read_roles on public.quotations for select to authenticated using (
  public.commercial_flow_can_control() or owner_id=(select auth.uid()) or created_by=(select auth.uid())
);

drop policy if exists payments_read_roles on public.payments;
create policy payments_read_roles on public.payments for select to authenticated using (
  public.finance_current_role() in ('admin','ceo','manager','finance')
  or (public.finance_current_role()='dealer' and (deal_id in (select d.id from public.deals d where d.dealer_id=(select auth.uid())) or created_by=(select auth.uid())))
  or (public.finance_current_role() in ('operations','logistics') and deal_id is not null)
);
drop policy if exists invoices_read_roles on public.invoices;
create policy invoices_read_roles on public.invoices for select to authenticated using (
  public.finance_current_role() in ('admin','ceo','manager','finance')
  or (public.finance_current_role()='dealer' and deal_id in (select d.id from public.deals d where d.dealer_id=(select auth.uid())))
  or (public.finance_current_role() in ('operations','logistics') and shipment_id is not null)
);
