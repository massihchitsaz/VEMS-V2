alter table public.inventory_events add column if not exists metadata jsonb not null default '{}'::jsonb;
create index if not exists inventory_events_metadata_gin_idx on public.inventory_events using gin(metadata);
