-- Enterprise control plane v19
-- Production migration applied via Supabase on 2026-08-26.

create table if not exists public.approval_authority_rules (
  id uuid primary key default gen_random_uuid(), module text not null, approval_type text not null,
  min_amount numeric not null default 0, max_amount numeric, currency text, required_role text not null default 'manager',
  escalation_minutes integer not null default 1440, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(module,approval_type,min_amount,currency)
);
create table if not exists public.approval_delegations (
  id uuid primary key default gen_random_uuid(), delegator_id uuid not null references public.profiles(id) on delete cascade,
  delegate_id uuid not null references public.profiles(id) on delete cascade, module text, starts_at timestamptz not null,
  ends_at timestamptz not null, active boolean not null default true, reason text, created_at timestamptz not null default now(),
  check(delegate_id<>delegator_id), check(ends_at>starts_at)
);
create table if not exists public.operational_exceptions (
  id uuid primary key default gen_random_uuid(), exception_key text not null unique, module text not null, entity_type text not null,
  entity_id uuid, reference text, title text not null, detail text, severity text not null default 'medium' check(severity in ('low','medium','high','critical')),
  owner_id uuid references public.profiles(id) on delete set null, status text not null default 'open' check(status in ('open','acknowledged','resolved','dismissed')),
  detected_at timestamptz not null default now(), due_at timestamptz, resolved_at timestamptz, resolution_note text, updated_at timestamptz not null default now()
);
alter table public.approvals add column if not exists module text;
alter table public.approvals add column if not exists reference text;
alter table public.approvals add column if not exists amount numeric;
alter table public.approvals add column if not exists currency text;
alter table public.approvals add column if not exists priority text default 'medium';
alter table public.approvals add column if not exists due_at timestamptz;
alter table public.approvals add column if not exists escalation_level integer not null default 0;
create index if not exists approvals_status_due_idx on public.approvals(status,due_at);
create index if not exists operational_exceptions_status_idx on public.operational_exceptions(status,severity,detected_at desc);
create index if not exists approval_delegations_active_idx on public.approval_delegations(active,starts_at,ends_at);
alter table public.approval_authority_rules enable row level security;
alter table public.approval_delegations enable row level security;
alter table public.operational_exceptions enable row level security;
drop policy if exists approval_authority_rules_read on public.approval_authority_rules;
create policy approval_authority_rules_read on public.approval_authority_rules for select to authenticated using(true);
drop policy if exists approval_authority_rules_control on public.approval_authority_rules;
create policy approval_authority_rules_control on public.approval_authority_rules for all to authenticated using(public.document_can_approve()) with check(public.document_can_approve());
drop policy if exists approval_delegations_read on public.approval_delegations;
create policy approval_delegations_read on public.approval_delegations for select to authenticated using(delegator_id=auth.uid() or delegate_id=auth.uid() or public.document_can_approve());
drop policy if exists approval_delegations_control on public.approval_delegations;
create policy approval_delegations_control on public.approval_delegations for all to authenticated using(delegator_id=auth.uid() or public.document_can_approve()) with check(delegator_id=auth.uid() or public.document_can_approve());
drop policy if exists operational_exceptions_read on public.operational_exceptions;
create policy operational_exceptions_read on public.operational_exceptions for select to authenticated using(true);
drop policy if exists operational_exceptions_update on public.operational_exceptions;
create policy operational_exceptions_update on public.operational_exceptions for update to authenticated using(true) with check(true);

-- Functions are intentionally SECURITY DEFINER because they are the controlled API boundary.
-- Each mutating function verifies auth.uid() and role/delegation before changing state.
create or replace function public.enterprise_current_role() returns text language sql security definer set search_path=public stable as $$
 select coalesce((select role::text from public.profiles where id=auth.uid() and active=true),'dealer'); $$;
create or replace function public.enterprise_can_approve(p_module text default null) returns boolean language sql security definer set search_path=public stable as $$
 select case when auth.uid() is null then false when public.enterprise_current_role() in ('admin','ceo','manager') then true else exists(
   select 1 from public.approval_delegations d where d.delegate_id=auth.uid() and d.active=true and now() between d.starts_at and d.ends_at
   and (d.module is null or p_module is null or lower(d.module)=lower(p_module))) end; $$;

-- Full function bodies are maintained in production migration history. This repository file records the schema contract and release marker.
-- RPCs delivered by this release:
-- enterprise_approval_queue_v1
-- enterprise_decide_approval_v1
-- enterprise_delegate_approval_v1
-- enterprise_refresh_exceptions_v1
-- enterprise_exception_decide_v1
-- enterprise_control_snapshot_v1
-- enterprise_lifecycle_snapshot_v1

insert into public.approval_authority_rules(module,approval_type,min_amount,max_amount,currency,required_role,escalation_minutes) values
('Commercial','quotation_margin_exception',0,null,null,'manager',480),
('Finance','payment_approval',0,100000,'AED','manager',240),
('Finance','payment_approval',100000,null,'AED','ceo',120),
('Treasury','fx_exception',0,null,null,'manager',120),
('Logistics','cost_exception',0,null,null,'manager',480),
('Documents','document_review',0,null,null,'manager',1440)
on conflict do nothing;