-- Production task states are open / in_progress / blocked / done / cancelled.
-- This release updates enterprise exception and snapshot logic to treat done tasks as completed.
create or replace function public.enterprise_refresh_exceptions_v1()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.operational_exceptions(exception_key,module,entity_type,entity_id,reference,title,detail,severity,owner_id,due_at,updated_at)
  select 'task-overdue-'||t.id,'Tasks','task',t.id,coalesce(t.entity_reference,t.id::text),'Overdue task',t.title,
    case when lower(coalesce(t.priority,'')) in ('critical','high') then 'high' else 'medium' end,t.assigned_to,t.due_at,now()
  from public.tasks t where t.status not in ('done','cancelled') and t.due_at is not null and t.due_at<now()
  on conflict(exception_key) do update set detail=excluded.detail,severity=excluded.severity,owner_id=excluded.owner_id,due_at=excluded.due_at,updated_at=now(),status=case when operational_exceptions.status='resolved' then 'open' else operational_exceptions.status end;
  return jsonb_build_object('open_exceptions',(select count(*) from public.operational_exceptions where status in ('open','acknowledged')),'critical',(select count(*) from public.operational_exceptions where status in ('open','acknowledged') and severity='critical'));
end;$$;
-- Full production version also refreshes Finance, Logistics and Approval exceptions and is tracked in Supabase migration history.