-- Fix enterprise control snapshot: opportunities use stage, not status.
create or replace function public.enterprise_control_snapshot_v1()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform public.enterprise_refresh_exceptions_v1();
  return jsonb_build_object(
    'commercial',jsonb_build_object(
      'open_opportunities',(select count(*) from public.opportunities where lower(coalesce(stage,'')) not in ('won','lost','closed')),
      'draft_quotations',(select count(*) from public.quotations where status='draft'),
      'pending_quotations',(select count(*) from public.quotations where status in ('pending','under_review','submitted')),
      'active_deals',(select count(*) from public.deals where status::text not in ('completed','cancelled','closed'))
    ),
    'logistics',jsonb_build_object(
      'active_shipments',(select count(*) from public.shipments where status not in ('delivered','cancelled','closed')),
      'delayed_shipments',(select count(*) from public.shipments where status not in ('delivered','cancelled','closed') and eta<current_date),
      'dg_shipments',(select count(*) from public.shipments where is_dg=true and status not in ('delivered','cancelled','closed'))
    ),
    'finance',jsonb_build_object(
      'open_receivables',(select count(*) from public.invoices where invoice_type in ('sales','receivable') and status not in ('paid','cancelled')),
      'overdue_receivables',(select count(*) from public.invoices where invoice_type in ('sales','receivable') and status not in ('paid','cancelled') and due_date<current_date),
      'open_receivable_value',(select coalesce(sum(total_amount),0) from public.invoices where invoice_type in ('sales','receivable') and status not in ('paid','cancelled')),
      'pending_payments',(select count(*) from public.payments where status not in ('completed','cancelled','failed'))
    ),
    'control',jsonb_build_object(
      'pending_approvals',(select count(*) from public.approvals where status='pending'),
      'overdue_tasks',(select count(*) from public.tasks where status not in ('completed','cancelled') and due_at<now()),
      'unread_notifications',(select count(*) from public.notifications where user_id=auth.uid() and is_read=false),
      'open_exceptions',(select count(*) from public.operational_exceptions where status in ('open','acknowledged')),
      'critical_exceptions',(select count(*) from public.operational_exceptions where status in ('open','acknowledged') and severity='critical')
    ),
    'exceptions',(select coalesce(jsonb_agg(to_jsonb(e) order by case e.severity when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,e.detected_at desc),'[]'::jsonb) from (select * from public.operational_exceptions where status in ('open','acknowledged') order by detected_at desc limit 50)e)
  );
end;$$;