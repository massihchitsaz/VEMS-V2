alter table public.notifications add column if not exists module text;
alter table public.notifications add column if not exists href text;
alter table public.notifications add column if not exists source_key text;
create unique index if not exists notifications_source_user_uidx on public.notifications(user_id,source_key) where source_key is not null;
create or replace function public.enterprise_sync_exception_notifications_v1()
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer:=0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.notifications(user_id,title,message,entity_type,entity_id,severity,is_read,module,href,source_key)
  select e.owner_id,e.title,e.detail,e.entity_type,e.entity_id,e.severity,false,e.module,
    case e.module when 'Finance' then '/finance/receivables' when 'Logistics' then '/shipping/shipments' when 'Approvals' then '/approvals' else '/tasks' end,e.exception_key
  from public.operational_exceptions e where e.owner_id is not null and e.status in ('open','acknowledged')
  on conflict(user_id,source_key) where source_key is not null do update set title=excluded.title,message=excluded.message,severity=excluded.severity,module=excluded.module,href=excluded.href,entity_type=excluded.entity_type,entity_id=excluded.entity_id;
  get diagnostics v_count=row_count; return v_count;
end;$$;