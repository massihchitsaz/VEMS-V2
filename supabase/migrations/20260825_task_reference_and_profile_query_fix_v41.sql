alter table public.tasks add column if not exists entity_reference text;

create index if not exists ix_tasks_entity_link
  on public.tasks(entity_type, entity_id)
  where entity_id is not null;

create index if not exists ix_tasks_entity_reference
  on public.tasks(entity_reference)
  where entity_reference is not null;

comment on column public.tasks.entity_reference is
  'Human-readable internal or external reference such as quotation, shipment, customer or treasury reference; entity_id remains UUID linkage only.';
