create or replace function public.customer_insert_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_role text := public.customer_current_role();
begin
  if current_user not in ('postgres','service_role') then
    new.status := 'lead';
    new.credit_limit := 0;
    new.currency := coalesce(nullif(upper(trim(new.currency)),''),'AED');
    if v_role='dealer' then new.assigned_to := auth.uid(); end if;
  end if;
  new.company_name := trim(new.company_name);
  if new.customer_code is not null then new.customer_code := nullif(trim(new.customer_code),''); end if;
  return new;
end;
$$;
drop trigger if exists trg_customer_insert_guard on public.customers;
create trigger trg_customer_insert_guard before insert on public.customers for each row execute function public.customer_insert_guard();

create or replace function public.customer_delete_v1(p_customer_id uuid,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_name text; v_links integer; v_detail jsonb;
begin
  if not public.customer_can_delete() then raise exception 'Customer deletion requires admin or CEO permission.'; end if;
  if length(trim(coalesce(p_reason,'')))<8 then raise exception 'Deletion reason must contain at least 8 characters.'; end if;
  select company_name into v_name from public.customers where id=p_customer_id for update;
  if v_name is null then raise exception 'Customer not found.'; end if;
  v_detail:=jsonb_build_object(
    'deals',(select count(*) from public.deals where customer_id=p_customer_id),
    'quotations',(select count(*) from public.quotations where customer_id=p_customer_id),
    'shipments',(select count(*) from public.shipments where customer_id=p_customer_id),
    'invoices',(select count(*) from public.invoices where customer_id=p_customer_id),
    'payments',(select count(*) from public.payments where customer_id=p_customer_id),
    'opportunities',(select count(*) from public.opportunities where customer_id=p_customer_id),
    'inventory_items',(select count(*) from public.inventory_items where customer_id=p_customer_id),
    'inventory_lots',(select count(*) from public.inventory_lots where customer_id=p_customer_id),
    'inventory_reservations',(select count(*) from public.inventory_reservations where customer_id=p_customer_id));
  select sum(value::int) into v_links from jsonb_each_text(v_detail);
  if coalesce(v_links,0)>0 then raise exception 'Customer has linked commercial, financial, shipment or inventory records. Set the account inactive instead of deleting it.'; end if;
  delete from public.customers where id=p_customer_id;
  return jsonb_build_object('deleted',true,'customer_id',p_customer_id,'company_name',v_name,'reason',trim(p_reason));
end;
$$;
grant execute on function public.customer_delete_v1(uuid,text) to authenticated,service_role;
revoke all on function public.customer_delete_v1(uuid,text) from anon;

create or replace function public.customer_account_snapshot_v1(p_customer_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
select jsonb_build_object(
 'opportunities',(select count(*) from public.opportunities where customer_id=p_customer_id),
 'deals',(select count(*) from public.deals where customer_id=p_customer_id),
 'quotations',(select count(*) from public.quotations where customer_id=p_customer_id),
 'shipments',(select count(*) from public.shipments where customer_id=p_customer_id),
 'active_shipments',(select count(*) from public.shipments where customer_id=p_customer_id and status not in ('delivered','cancelled')),
 'open_invoices',(select count(*) from public.invoices where customer_id=p_customer_id and status not in ('paid','cancelled')),
 'open_invoice_value',(select coalesce(sum(total_amount),0) from public.invoices where customer_id=p_customer_id and status not in ('paid','cancelled')),
 'payments',(select count(*) from public.payments where customer_id=p_customer_id),
 'inventory_on_hand',(select coalesce(sum(qty_on_hand),0) from public.inventory_lots where customer_id=p_customer_id),
 'last_event_at',(select max(created_at) from public.customer_events where customer_id=p_customer_id));
$$;
grant execute on function public.customer_account_snapshot_v1(uuid) to authenticated,service_role;
revoke all on function public.customer_account_snapshot_v1(uuid) from anon;
