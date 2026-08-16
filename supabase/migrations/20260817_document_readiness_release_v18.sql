-- Consolidated repository migration for Document Readiness production release.
-- Production database received the same capability through migrations v16-v18.

create table if not exists public.document_requirement_rules (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('shipment','deal')),
  document_type text not null,
  gate text not null default 'operational' check (gate in ('commercial','booking','dispatch','customs','delivery','finance','operational','deal_execution')),
  modes text[] not null default '{}',
  requires_dg boolean not null default false,
  requires_temperature_controlled boolean not null default false,
  is_required boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 100,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists document_requirement_rules_entity_active_idx on public.document_requirement_rules(entity_type,active,sort_order);
alter table public.document_requirement_rules enable row level security;
drop policy if exists document_requirement_rules_select on public.document_requirement_rules;
create policy document_requirement_rules_select on public.document_requirement_rules for select to authenticated using (true);
drop policy if exists document_requirement_rules_controller_insert on public.document_requirement_rules;
create policy document_requirement_rules_controller_insert on public.document_requirement_rules for insert to authenticated with check (public.document_can_approve());
drop policy if exists document_requirement_rules_controller_update on public.document_requirement_rules;
create policy document_requirement_rules_controller_update on public.document_requirement_rules for update to authenticated using (public.document_can_approve()) with check (public.document_can_approve());
drop policy if exists document_requirement_rules_controller_delete on public.document_requirement_rules;
create policy document_requirement_rules_controller_delete on public.document_requirement_rules for delete to authenticated using (public.document_can_approve());

create or replace function public.document_readiness_v1(p_entity_type text,p_entity_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_mode text:=null; v_is_dg boolean:=false; v_temp boolean:=false; v_label text:=null; v_total integer:=0; v_ready integer:=0; v_items jsonb:='[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_entity_type not in ('shipment','deal') then raise exception 'Unsupported entity type'; end if;
  if p_entity_type='shipment' then
    select lower(coalesce(s.mode,'')),coalesce(s.is_dg,false),coalesce(s.temperature_controlled,false),s.shipment_no into v_mode,v_is_dg,v_temp,v_label from public.shipments s where s.id=p_entity_id;
  else
    select null,false,false,d.deal_no into v_mode,v_is_dg,v_temp,v_label from public.deals d where d.id=p_entity_id;
  end if;
  if v_label is null then raise exception 'Entity not found'; end if;
  with applicable as (
    select r.* from public.document_requirement_rules r where r.active and r.is_required and r.entity_type=p_entity_type
      and (cardinality(r.modes)=0 or v_mode=any(r.modes)) and (not r.requires_dg or v_is_dg) and (not r.requires_temperature_controlled or v_temp)
  ), evaluated as (
    select r.id rule_id,r.document_type,r.gate,r.notes,r.sort_order,d.id document_id,d.status document_status,d.expiry_date,d.version,
      case when d.id is null then 'missing' when d.status='approved' and d.expiry_date is not null and d.expiry_date<current_date then 'expired'
           when d.status='approved' then 'ready' when d.status='under_review' then 'under_review' when d.status='rejected' then 'rejected'
           when d.status='draft' then 'draft' else coalesce(d.status,'missing') end readiness_state
    from applicable r left join lateral (
      select x.* from public.documents x where x.entity_type=p_entity_type and x.entity_id=p_entity_id
        and lower(coalesce(x.document_type,''))=lower(r.document_type) and coalesce(x.status,'draft') not in ('superseded','cancelled')
      order by coalesce(x.version,1) desc,coalesce(x.updated_at,x.created_at) desc nulls last limit 1
    ) d on true
  )
  select count(*),count(*) filter(where readiness_state='ready'),coalesce(jsonb_agg(jsonb_build_object('rule_id',rule_id,'document_type',document_type,'gate',gate,'state',readiness_state,'document_id',document_id,'document_status',document_status,'expiry_date',expiry_date,'version',version,'notes',notes) order by sort_order,document_type),'[]'::jsonb)
  into v_total,v_ready,v_items from evaluated;
  return jsonb_build_object('entity_type',p_entity_type,'entity_id',p_entity_id,'label',v_label,'mode',nullif(v_mode,''),'is_dg',v_is_dg,'temperature_controlled',v_temp,
    'required_count',v_total,'ready_count',v_ready,'missing_count',(select count(*) from jsonb_array_elements(v_items) j where j->>'state'='missing'),
    'blocked_count',(select count(*) from jsonb_array_elements(v_items) j where j->>'state'<>'ready'),'completion_percent',case when v_total=0 then 0 else round((v_ready::numeric/v_total::numeric)*100,0) end,
    'gate_status',case when v_total=0 then 'not_configured' when v_ready=v_total then 'ready' else 'blocked' end,'items',v_items);
end;$$;

create or replace function public.document_readiness_overview_v2(p_limit_each integer default 100)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_shipments jsonb; v_deals jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select coalesce(jsonb_agg(x.payload order by x.sort_at desc),'[]'::jsonb) into v_shipments from (
    select public.document_readiness_v1('shipment',s.id) payload,coalesce(s.updated_at,s.created_at,now()) sort_at from public.shipments s order by coalesce(s.updated_at,s.created_at,now()) desc limit greatest(1,least(p_limit_each,200))
  ) x;
  select coalesce(jsonb_agg(x.payload order by x.sort_at desc),'[]'::jsonb) into v_deals from (
    select public.document_readiness_v1('deal',d.id) payload,coalesce(d.updated_at,d.created_at,now()) sort_at from public.deals d order by coalesce(d.updated_at,d.created_at,now()) desc limit greatest(1,least(p_limit_each,200))
  ) x;
  return jsonb_build_object('shipments',v_shipments,'deals',v_deals);
end;$$;

create or replace function public.document_requirement_save_v1(p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_entity text; v_doc text; v_modes text[];
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.document_can_approve() then raise exception 'Only document controllers can configure requirement rules'; end if;
  v_entity:=lower(trim(coalesce(p_payload->>'entity_type',''))); v_doc:=trim(coalesce(p_payload->>'document_type',''));
  if v_entity not in ('shipment','deal') then raise exception 'Invalid entity type'; end if; if v_doc='' then raise exception 'Document type is required'; end if;
  select coalesce(array_agg(lower(value)),'{}') into v_modes from jsonb_array_elements_text(coalesce(p_payload->'modes','[]'::jsonb)); v_id:=nullif(p_payload->>'id','')::uuid;
  if v_id is null then
    insert into public.document_requirement_rules(entity_type,document_type,gate,modes,requires_dg,requires_temperature_controlled,is_required,active,sort_order,notes,created_by)
    values(v_entity,v_doc,coalesce(nullif(p_payload->>'gate',''),'operational'),v_modes,coalesce((p_payload->>'requires_dg')::boolean,false),coalesce((p_payload->>'requires_temperature_controlled')::boolean,false),coalesce((p_payload->>'is_required')::boolean,true),coalesce((p_payload->>'active')::boolean,true),coalesce((p_payload->>'sort_order')::integer,100),nullif(p_payload->>'notes',''),auth.uid()) returning id into v_id;
  else
    update public.document_requirement_rules set entity_type=v_entity,document_type=v_doc,gate=coalesce(nullif(p_payload->>'gate',''),'operational'),modes=v_modes,requires_dg=coalesce((p_payload->>'requires_dg')::boolean,false),requires_temperature_controlled=coalesce((p_payload->>'requires_temperature_controlled')::boolean,false),is_required=coalesce((p_payload->>'is_required')::boolean,true),active=coalesce((p_payload->>'active')::boolean,true),sort_order=coalesce((p_payload->>'sort_order')::integer,100),notes=nullif(p_payload->>'notes',''),updated_at=now() where id=v_id;
    if not found then raise exception 'Requirement rule not found'; end if;
  end if; return v_id;
end;$$;

create or replace function public.document_requirement_set_active_v1(p_rule_id uuid,p_active boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.document_can_approve() then raise exception 'Only document controllers can configure requirement rules'; end if;
  update public.document_requirement_rules set active=p_active,updated_at=now() where id=p_rule_id; if not found then raise exception 'Requirement rule not found'; end if;
end;$$;

revoke all on function public.document_readiness_v1(text,uuid) from public,anon;
revoke all on function public.document_readiness_overview_v2(integer) from public,anon;
revoke all on function public.document_requirement_save_v1(jsonb) from public,anon;
revoke all on function public.document_requirement_set_active_v1(uuid,boolean) from public,anon;
grant execute on function public.document_readiness_v1(text,uuid) to authenticated;
grant execute on function public.document_readiness_overview_v2(integer) to authenticated;
grant execute on function public.document_requirement_save_v1(jsonb) to authenticated;
grant execute on function public.document_requirement_set_active_v1(uuid,boolean) to authenticated;

insert into public.document_requirement_rules(entity_type,document_type,gate,modes,requires_dg,sort_order,notes)
select * from (values
 ('shipment','Commercial Invoice','customs','{}'::text[],false,10,'VTC operational baseline; configurable by document controllers.'),
 ('shipment','Packing List','customs','{}'::text[],false,20,'VTC operational baseline; configurable by document controllers.'),
 ('shipment','Bill of Lading','dispatch',array['sea','ocean'],false,30,'Applies to sea/ocean shipments.'),
 ('shipment','Air Waybill','dispatch',array['air'],false,30,'Applies to air shipments.'),
 ('shipment','DG Declaration','dispatch','{}'::text[],true,40,'Applies only when shipment is marked DG.'),
 ('shipment','MSDS/SDS','dispatch','{}'::text[],true,50,'Applies only when shipment is marked DG.'),
 ('deal','Contract / Agreement','deal_execution','{}'::text[],false,10,'VTC deal-control baseline; configurable by document controllers.'),
 ('deal','Commercial Invoice','finance','{}'::text[],false,20,'VTC deal-control baseline; configurable by document controllers.')
) seed(entity_type,document_type,gate,modes,requires_dg,sort_order,notes)
where not exists(select 1 from public.document_requirement_rules r where r.entity_type=seed.entity_type and lower(r.document_type)=lower(seed.document_type) and r.gate=seed.gate and r.modes=seed.modes and r.requires_dg=seed.requires_dg);
