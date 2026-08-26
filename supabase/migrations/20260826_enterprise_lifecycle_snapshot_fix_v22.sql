-- Fix lifecycle snapshot shipment ordering by carrying created_at into the projection.
create or replace function public.enterprise_lifecycle_snapshot_v1(p_deal_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.deals%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into d from public.deals where id=p_deal_id;
  if not found then raise exception 'Deal not found'; end if;
  return jsonb_build_object(
    'deal',jsonb_build_object('id',d.id,'deal_no',d.deal_no,'status',d.status,'quotation_id',d.quotation_id,'opportunity_id',d.opportunity_id),
    'quotation',(select to_jsonb(q) from (select id,quotation_no,status,quotation_type,total_amount,currency,revision from public.quotations where id=d.quotation_id) q),
    'shipment',(select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at),'[]'::jsonb) from (select id,shipment_no,status,mode,origin,destination,etd,eta,created_at from public.shipments where deal_id=d.id) s),
    'documents',(select jsonb_build_object('total',count(*),'approved',count(*) filter(where status='approved'),'under_review',count(*) filter(where status='under_review')) from public.documents where entity_type='deal' and entity_id=d.id),
    'invoices',(select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at),'[]'::jsonb) from (select id,invoice_no,invoice_type,status,currency,total_amount,due_date,created_at from public.invoices where deal_id=d.id) i),
    'payments',(select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at),'[]'::jsonb) from (select id,payment_no,payment_type,status,currency,amount,payment_date,created_at from public.payments where deal_id=d.id) p)
  );
end;$$;