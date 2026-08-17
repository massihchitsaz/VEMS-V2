-- Opportunity stage alignment v40
alter table public.opportunities drop constraint if exists opportunities_stage_check;
update public.opportunities set stage='quotation' where stage='proposal';
alter table public.opportunities add constraint opportunities_stage_check check (stage in ('lead','qualified','quotation','negotiation','approval','won','lost'));
