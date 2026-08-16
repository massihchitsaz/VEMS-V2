alter table public.inventory_events drop constraint if exists inventory_events_event_type_check;
alter table public.inventory_events add constraint inventory_events_event_type_check check (event_type = any (array['hold'::text,'release_hold'::text,'reservation_fulfilled'::text,'linkage_updated'::text]));
